#!/bin/bash
# Run this on Ubuntu to build the Linux binary
# Prerequisites: sudo apt install golang gcc libgtk-3-dev libayatana-appindicator3-dev

CGO_ENABLED=1 go build -ldflags="-s -w" -o dist/net-linux-amd64 .
echo "Built: dist/net-linux-amd64"
