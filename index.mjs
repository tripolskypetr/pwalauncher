#!/usr/bin/env node

import { createProxyMiddleware } from "http-proxy-middleware";
import { serializeError } from 'serialize-error';
import { createRequire } from 'module'

import https from 'https';
import http from 'http';
import path from 'path';
import fs from 'fs';

import pinoExpress from "pino-express";

import express from "express";
import nocache from 'nocache';
import jwt from "jsonwebtoken";
import pino from 'pino';

const portLogger = pino({
    transport: {
        target: 'pino/file',
        options: { destination: 'info.txt' }
    },
    formatters: {
        log: (obj) => ({
            _SOURCE: "PORT",
            ...obj
        }),
    }
});

const proxyLogger = pino({
    transport: {
        target: 'pino/file',
        options: { destination: 'info.txt' }
    },
    formatters: {
        log: (obj) => ({
            _SOURCE: "PROXY",
            ...obj
        }),
    }
});

const corsLogger = pino({
    transport: {
        target: 'pino/file',
        options: { destination: 'info.txt' }
    },
    formatters: {
        log: (obj) => ({
            _SOURCE: "CORS",
            ...obj
        }),
    }
});

const fileLogger = pino({
    transport: {
        target: 'pino/file',
        options: { destination: 'info.txt' }
    },
    formatters: {
        log: (obj) => ({
            _SOURCE: "FILE",
            ...obj
        }),
    }
});

const errorLogger = pino({
    transport: {
        target: 'pino/file',
        options: { destination: 'error.txt' }
    },
    formatters: {
        log: (obj) => ({
            _SOURCE: "ERROR",
            ...obj
        }),
    }
});

const httpLogger = pino({
    transport: {
        target: 'pino/file',
        options: { destination: 'log.txt' }
    },
    formatters: {
        log: (obj) => ({
            _SOURCE: "HTTP",
            ...obj
        }),
    }
});

const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
const [configPath = "./pwalauncher.config.js"] = args;

if (!fs.existsSync(configPath)) {
    console.log(`${path.resolve(process.cwd(), configPath)} not found`);
    console.log('Prese read the manual: https://github.com/react-declarative/pwalauncher');
    console.log();
    process.exit(-1);
}

const config = require(configPath);
config.port = config.port ?? 80;

const app = express();

app.use(pinoExpress(httpLogger));
app.use(nocache());

app.options('*', (req, res) => {
    res.setHeader(`Access-Control-Allow-Origin`, req.headers.origin || req.hostname || '*');
    res.setHeader("Access-Control-Allow-Headers", req.headers['access-control-request-headers'] || "*");
    res.setHeader(`Access-Control-Allow-Methods`, `GET,POST,PUT,PATCH,DELETE`);
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.sendStatus(200);
});

app.use("/cors/", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Credentials", true);
    res.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
    const url = req.url.replace('/', '');
    corsLogger.info(`RESTREAM url=${url} date=${new Date().toString()}`);
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (!buffer.length) {
            throw new Error('empty buffer')
        }
        res.status(200).send(buffer);
    } catch (error) {
        corsLogger.error(`RESTREAM url=${url}`, error);
        res.status(200).json({ error: true });
    }
});

if (config.jwtSecret) {
    config.ports?.forEach((port) => {
        app.use(`/${port}`, (req, res, next) => {
            const authorizationHeader = req.headers && 'Authorization' in req.headers ? 'Authorization' : 'authorization';
            if (req.headers && req.headers[authorizationHeader]) {
                const [scheme, credentials] = req.headers[authorizationHeader].split(' ');
                if (/^Bearer$/i.test(scheme)) {
                    if (jwt.verify(credentials, config.jwtSecret)) {
                        next();
                        return;
                    }
                }
            }
            res.status(401).json({ error: 'jwt' });
        });
    })
}

config.ports?.forEach((port) => {
    const middleware = createProxyMiddleware({
        target: `http://127.0.0.1:${port}`,
        changeOrigin: true,
        ws: true,
        logger: portLogger,
        pathRewrite: (path, req) => {
            return path.replace(`/${port}`, '');
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
        target: link.replace(endpoint, ''),
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

app.use((req, res, next) => {
    fileLogger.info(req.url);
    next();
}, express.static(path.join(process.cwd(), 'wwwroot')));

app.get("*", (req, res) => {
    fileLogger.error(req.url);
    res.sendFile(path.join(process.cwd(), "./wwwroot/index.html"));
});

app.use((error, req, res, next) => {
    errorLogger.error(serializeError(error));
    res.status(500).json({
        error: true,
    });
})

process.once('uncaughtException', (error) => {
    errorLogger.error(serializeError(error))
});

process.once('unhandledRejection', (error) => {
    throw error;
});


if (config.ssl) {
    https.createServer({
        key: config.ssl.key,
        cert: config.ssl.cert,
        requestCert: true,
        rejectUnauthorized: true
    }, app).listen(443).addListener('listening', () => {
        console.log('Server started: PORT=443 SSL');
    });
}

if (config.port) {
    http.createServer(app).listen(config.port).addListener('listening', () => {
        console.log(`Server started PORT=${config.port}`);
    });
}
