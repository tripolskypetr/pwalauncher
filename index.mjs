#!/usr/bin/env node

import { createProxyMiddleware } from "http-proxy-middleware";
import { createRequire } from 'module'

import "babel-polyfill";

import https from 'https';
import http from 'http';
import path from 'path';

import express from "express";
import cors from "cors";
import nocache from 'nocache';
import jwt from "jsonwebtoken";
import { default as anywhere } from "express-cors-anywhere";

const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
const [configPath = "./sample/pwalauncher.js"] = args;

const config = require(configPath);
config.port = config.port ?? 80;

const app = express();

console.log(anywhere)

app.use(nocache());
app.use(cors());
app.use(express.static(path.join(process.cwd(), 'wwwroot')));
app.use("/cors-anywhere", anywhere.default());

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
    app.use(
        `/${port}`,
        createProxyMiddleware({
            target: `http://127.0.0.1:${port}`,
            changeOrigin: true,
            ws: true,
            pathRewrite: (path) => {
                return path.replace(`/${port}`, '');
            },
        })
    );
});

app.get("*", function (_, res) {
    res.sendFile(path.join(process.cwd(), "./wwwroot/index.html"));
});

process.on('uncaughtException', console.log);
process.on('unhandledRejection', console.log);

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
