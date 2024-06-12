#!/usr/bin/env node

import { createProxyMiddleware } from "http-proxy-middleware";
import { serializeError } from "serialize-error";
import { createRequire } from "module";

import * as uuid from "uuid";

import https from "https";
import http from "http";
import path from "path";
import tls from "tls";
import fs from "fs";

import pinoExpress from "pino-express";
import cookieParser from "cookie-parser";

import express from "express";
import nocache from "nocache";
import jwt from "jsonwebtoken";
import pino from "pino";

const require = createRequire(import.meta.url);

const randomString = () => {
  const buffer = Buffer.alloc(16);
  uuid.v4({}, buffer);
  const str = buffer.toString("hex");
  return str.slice(Math.floor(Math.random() * 10), str.length);
};

const portLogger = pino({
  transport: {
    target: require.resolve('./logger.mjs'),
    options: { filename: "port.txt" },
  },
  formatters: {
    log: (obj) => ({
      _SOURCE: "PORT",
      ...obj,
    }),
  },
});

const proxyLogger = pino({
  transport: {
    target: require.resolve('./logger.mjs'),
    options: { filename: "proxy.txt" },
  },
  formatters: {
    log: (obj) => ({
      _SOURCE: "PROXY",
      ...obj,
    }),
  },
});

const corsLogger = pino({
  transport: {
    target: require.resolve('./logger.mjs'),
    options: { filename: "cors.txt" },
  },
  formatters: {
    log: (obj) => ({
      _SOURCE: "CORS",
      ...obj,
    }),
  },
});

const fileLogger = pino({
  transport: {
    target: require.resolve('./logger.mjs'),
    options: { filename: "file.txt" },
  },
  formatters: {
    log: (obj) => ({
      _SOURCE: "FILE",
      ...obj,
    }),
  },
});

const errorLogger = pino({
  transport: {
    target: require.resolve('./logger.mjs'),
    options: { filename: "error.txt" },
  },
  formatters: {
    log: (obj) => ({
      _SOURCE: "ERROR",
      ...obj,
    }),
  },
});

const httpLogger = pino({
  transport: {
    target: require.resolve('./logger.mjs'),
    options: { filename: "http.txt" },
  },
  formatters: {
    log: (obj) => ({
      _SOURCE: "HTTP",
      ...obj,
    }),
  },
});

const MAX_HTTP_AGENT_SOCKETS = 10_000;

const SECRET_COOKIE_OPTIONS = {
  maxAge: 1000 * 60 * 24 * 60,
  httpOnly: false,
  signed: false,
};

const args = process.argv.slice(2);
const [configPath = "./pwalauncher.config.cjs"] = args;
const modulePath = path.resolve(process.cwd(), configPath);

if (!fs.existsSync(require.resolve(modulePath))) {
  console.log(`${modulePath} not found`);
  console.log(
    "Prese read the manual: https://github.com/react-declarative/pwalauncher",
  );
  console.log();
  process.exit(-1);
}

const config = require(modulePath);
config.wwwroot = config.wwwroot ?? "wwwroot";
config.cookieSecretAllowed = config.cookieSecretAllowed ?? [
  "/",
  "/index.html",
  "/favicon.ico",
];
config.ipBlacklist = config.ipBlacklist ?? [];

const { SECRET_COOKIE_KEY, SECRET_COOKIE_VALUE } = typeof config.cookieSecret === 'object' ? {
  SECRET_COOKIE_KEY: config.cookieSecret.key,
  SECRET_COOKIE_VALUE: config.cookieSecret.value,
}: {
  SECRET_COOKIE_KEY: randomString(),
  SECRET_COOKIE_VALUE: randomString(),
};

const getSslArgs = () => ({
  key: config.ssl.key,
  cert: config.ssl.cert,
  ca: config.ssl.ca,
});

const getSslSerial = () => {
  const socket = new tls.TLSSocket(null, getSslArgs());
  const cert = socket.getCertificate();
  socket.destroy();
  return cert.serialNumber;
};

const app = express();

app.use(pinoExpress(httpLogger));
app.use(cookieParser());
app.use(nocache());

{
  const validateBlacklist = (req, res, next) => {
    if (config.ipBlacklist.includes(req.ip)) {
      errorLogger.error({
        unauthirizedAccess: true,
        ip: req.ip,
      });
      res.status(404).send("Not found");
      return;
    }
    next();
  };
  app.get("*", validateBlacklist);
  app.post("*", validateBlacklist);
  app.put("*", validateBlacklist);
  app.patch("*", validateBlacklist);
  app.delete("*", validateBlacklist);
}

if (config.cookieSecret) {
  const validateCookie = (req, res, next) => {
    if (config.cookieSecretAllowed.includes(req.url)) {
      next();
      return;
    }
    if (req.cookies[SECRET_COOKIE_KEY] === SECRET_COOKIE_VALUE) {
      next();
      return;
    }
    errorLogger.error({
      unauthirizedAccess: true,
      ip: req.ip,
    });
    res.status(404).send("Not found");
  };
  app.get("*", validateCookie);
  app.post("*", validateCookie);
  app.put("*", validateCookie);
  app.patch("*", validateCookie);
  app.delete("*", validateCookie);
}

if (config.redirectHttps) {
  app.use("*", (req, res, next) => {
    if (req.protocol !== "https") {
      const url = new URL(req.url, "https://" + req.headers.host);
      const port = config.sslPort || 443;
      url.port = port;
      res.redirect(url.toString());
      return;
    }
    next();
  });
}

app.options("*", (req, res) => {
  res.setHeader(
    `Access-Control-Allow-Origin`,
    req.headers.origin || req.hostname || "*",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] || "*",
  );
  res.setHeader(`Access-Control-Allow-Methods`, `GET,POST,PUT,PATCH,DELETE`);
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.sendStatus(200);
});

app.use("/cors/", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
  const url = req.url.replace("/", "");
  corsLogger.info(`RESTREAM url=${url} date=${new Date().toString()}`);
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.length) {
      throw new Error("empty buffer");
    }
    res.status(200).send(buffer);
  } catch (error) {
    corsLogger.error(`RESTREAM url=${url}`, error);
    res.status(200).json({ error: true });
  }
});

if (config.jwtSecret) {
  config.ports?.forEach((port) => {
    const middleware = (req, res, next) => {
      const authorizationHeader =
        req.headers && "Authorization" in req.headers
          ? "Authorization"
          : "authorization";
      if (req.headers && req.headers[authorizationHeader]) {
        const [scheme, credentials] =
          req.headers[authorizationHeader].split(" ");
        if (/^Bearer$/i.test(scheme)) {
          try {
            if (jwt.verify(credentials, config.jwtSecret)) {
              next();
              return;
            }
          } catch (error) {
            errorLogger.error(serializeError(error));
          }
        }
      }
      res.status(404).send("Not found");
    };
    app.use(`/${port}`, middleware);
    app.use(`/${port}/*`, middleware);
  });
}

config.ports?.forEach((port) => {
  const middleware = createProxyMiddleware({
    target: `http://127.0.0.1:${port}`,
    agent: new http.Agent({
      maxSockets: MAX_HTTP_AGENT_SOCKETS,
    }),
    changeOrigin: true,
    ws: true,
    logger: portLogger,
    pathRewrite: (path, req) => {
      return path.replace(`/${port}`, "");
    },
    onError: (err, req, res) => {
      portLogger.warn(err);
      res.status(500).json({
        error: true,
      });
    },
  });
  app.use(`/${port}`, middleware);
  app.use(`/${port}/*`, middleware);
});

config.proxy?.forEach(({ path, link }) => {
  const endpoint = `/${path}`;
  const middleware = createProxyMiddleware({
    target: link.replace(endpoint, ""),
    agent: new http.Agent({
      maxSockets: MAX_HTTP_AGENT_SOCKETS,
    }),
    changeOrigin: true,
    ws: true,
    logger: proxyLogger,
    onError: (err, req, res) => {
      proxyLogger.warn(err);
      res.status(500).json({
        error: true,
      });
    },
  });
  app.use(endpoint, middleware);
  app.use(`${endpoint}/*`, middleware);
});

app.use(
  (req, res, next) => {
    fileLogger.info(req.url);
    next();
  },
  express.static(path.join(process.cwd(), config.wwwroot)),
);

app.get("*", (req, res) => {
  if (config.cookieSecretAllowed.includes(req.url)) {
    res.cookie(SECRET_COOKIE_KEY, SECRET_COOKIE_VALUE, SECRET_COOKIE_OPTIONS);
  }
  res.sendFile(path.join(process.cwd(), config.wwwroot, "index.html"));
});

app.use((error, req, res, next) => {
  errorLogger.error(serializeError(error));
  res.status(500).json({
    error: true,
  });
});

process.once("uncaughtException", (error) => {
  errorLogger.error(serializeError(error));
});

process.once("unhandledRejection", (error) => {
  throw error;
});

if (config.ssl) {
  const port = config.sslPort || 443;
  const serialNumber = getSslSerial();
  https
    .createServer(
      {
        ...getSslArgs(),
        rejectUnauthorized: false,
        requestCert: true,
      },
      config.sslVerify
        ? (req, res) => {
            const cert = req.socket.getPeerCertificate();
            if (!cert || !Object.keys(cert).length || cert?.serialNumber !== serialNumber) {
              res.writeHead(404);
              res.write("Not found");
              res.end();
              return;
            }
            return app(req, res);
          }
        : app,
    )
    .listen(port, "0.0.0.0")
    .addListener("listening", () => {
      console.log(`Server started: PORT=${port} SSL`);
    });
}

if (config.port) {
  http
    .createServer(app)
    .listen(config.port, "0.0.0.0")
    .addListener("listening", () => {
      console.log(`Server started: PORT=${config.port}`);
    });
}
