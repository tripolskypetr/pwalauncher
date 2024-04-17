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
        key: fs.readFileSync('./ssl/test.key', 'utf8'),
        cert: fs.readFileSync('./ssl/test.crt', 'utf8')
    },
    jwtSecret: "TEST",
    port: 80
};
