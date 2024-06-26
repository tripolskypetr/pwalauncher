# pwalauncher

> The microservice bootstrap for PWA with [serverless functions](https://appwrite.io/docs/products/functions)

## Usage

```bash
npm install -g pwalauncher
pwalauncher # Will share `wwwroot` subfolder with static assets and redirect to `index.html` if 404
```

## Benefits

1. **Free SSL Certificate obuse**

Create a [ZeroSSL](https://zerossl.com/) 90-days sertificate for single domain and multiply it to several websites shared on different ports

2. **Port forward over SSL**

Forwarding `https://example.com/8081` to `http://localhost:8081`. Both websoket and http forwarding are supported

3. **JWT Validation for each forwarded port**

While forwarding to `http://localhost:8081` the `pwalauncher` can intercept `Authorization: Bearer <token>` header and validate the token. The UI can sign a token every 10 seconds to avoid DDOS

4. **CRA-like API proxy**

Request to `https://example.com/v1` can be forwarded to `https://cloud.appwrite.io/v1`

4. **Cors-everywhere like file download proxy**

Fetch from `https://example.com/cors/http://filedownload.com/demo.mp3` will download `http://filedownload.com/demo.mp3` ignoring mixed content and cord origin policy

5. **Mutal SSL auth on a server side**

A self-signed SSL certificate installed localy can be used to restrict access to application authorisation with second layer of authentification

## Ecosystem

This tool is extreamly powerfull with [PM2](https://pm2.keymetrics.io/). The `pm2` should be used for *instantiation* while `pwalauncher` used as *easy-config reverse-proxy*

```bash
pm2 start ecosystem.config.js
pm2 list
pm2 save
pm2 monit
pm2 stop service
pm2 kill
```

The [tmux](https://github.com/tmux/tmux) also can be used to start microservices in `debug` mode with direct stdin/stdout pipe

```bash
tmux kill-session
tmux
tmux attach
Ctrl + B + D
Ctrl + B + C
Ctrl + B + P
Ctrl + B + N
```

The `pwalaunch` used single argument if you want to use different name of config.

```bash
pwalaunch launcher.config.json
```

## Configutation

```javascript
const fs = require('fs');

module.exports = {
    ports: [
        8081,
        8082,
        8083,
        8084,
        8085,
        8086,
        8087,
        8088,
        8089,
        8090,
    ],
    proxy: [
        {
            path: 'v1',
            link: 'http://127.0.0.1:8080/v1'
        }
    ],
    ssl: {
        key: fs.readFileSync('./ssl/private.key', 'utf8'),
        cert: fs.readFileSync('./ssl/certificate.crt', 'utf8'),
    },
    sslPort: 444,
    sslVerify: true,
    jwtSecret: "TEST",
    cookieSecret: true, // { key: "test", value: "1", }
    cookieSecretAllowed: ['/', '/index.html', '/favicon.ico'],
    ipBlacklist: ["95.173.136.72"],
    port: 80,
    redirectHttps: false,
    wwwroot: "build"
};
```

## Self-signed SSL Setup

If you getting trouble while trying to setup self-signed ssl, check the [3rdparty folder](./3rdparty/). The `SSLCertificateMaker.exe` will help you create root certificate (CA) for client devices and self-signed children (CERT) for the server. The `CertTrustManager.exe` will help you create a one-button setup file for root certificate (CA), to create that file right click on CertTrustManager window. 

![screenshot](./docs/screenshot.png)

P.S. If you choose wrong certificate in modal run `chrome://restart` to choose It again or use Edge
