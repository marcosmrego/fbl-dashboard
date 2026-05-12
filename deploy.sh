#!/usr/bin/env bash
set -e

# Build and run the dashboard container on the VPS

docker compose up -d --build

echo "Focus Blues Dashboard deployed and running."
