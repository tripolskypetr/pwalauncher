#!/bin/bash

SERVER_DOMAIN="knt.uz"

# Generate a CA certificate and private key
openssl req -new -x509 -days 365 -nodes -out ca.crt -keyout ca.key -subj "/CN=$SERVER_DOMAIN"

# Generate a server certificate signing request (CSR)
openssl req -new -nodes -out cert.csr -keyout cert.key -subj "/CN=$SERVER_DOMAIN"

# Sign the CSR with the CA key to generate the server certificate
openssl x509 -req -in cert.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out cert.crt -days 365

# Remove the CSR file
rm cert.csr

echo "Certificates generated: ca.crt, cert.crt, cert.key"
