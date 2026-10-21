#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)/../certs"
mkdir -p "$DIR"

KEY="$DIR/localhost.key"
CRT="$DIR/localhost.crt"

echo "Generating self-signed cert to $DIR"
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$KEY" -out "$CRT" -days 365 -subj "/CN=localhost"

echo "Done:"
echo " - $KEY"
echo " - $CRT"
