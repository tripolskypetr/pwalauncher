#!/usr/bin/env bash
rm -rf ssl
mkdir -p ssl
cd ssl
IP="127.0.0.1"
echo "subjectAltName = IP:$IP" >> extfile.cnf
openssl genrsa -out test.key 2048
openssl req -new -key test.key -out test.csr
openssl x509 -req -days 3650 -in test.csr -signkey test.key -out test.crt -extfile extfile.cnf
openssl pkcs12 -inkey test.key -in test.crt -export -out test.pfx
cd ..
