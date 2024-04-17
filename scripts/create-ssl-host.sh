#!/bin/sh
rm -rf ssl
mkdir ssl
cd ssl
HOST="test1.com"
echo "[req]
default_bits  = 2048
distinguished_name = req_distinguished_name
req_extensions = req_ext
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
countryName = XX
stateOrProvinceName = N/A
localityName = N/A
organizationName = Self-signed certificate
commonName = PWALAUNCHER: Self-signed certificate

[req_ext]
subjectAltName = @alt_names

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = www.$HOST
DNS.2 = $HOST
" > san.cnf

openssl req -x509 -nodes -days 730 -newkey rsa:2048 -keyout test.key -out test.crt -config san.cnf
openssl pkcs12 -inkey test.key -in test.crt -export -out test.pfx
rm san.cnf

cd ..
