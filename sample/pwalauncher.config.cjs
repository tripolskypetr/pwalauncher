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
        ca: fs.readFileSync('./ssl/ca_bundle.crt', 'utf8'),
    },
    http2Port: 443,
    sslPort: 444,
    sslRedirectPort: 444,
    sslVerify: false,
    jwtSecret: "TEST",
    cookieSecret: {
        key: "test",
        value: "1",
    },
    socketRestream: true,
    disableWs: true,
    cookieSecretAllowed: ['/', '/index.html', '/favicon.ico'],
    ipBlacklist: ["95.173.136.72"],
    port: 80,
    redirectHttps: false,
    wwwroot: "build"
};
