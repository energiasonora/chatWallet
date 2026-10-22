#!/usr/bin/env bash
set -e; cd "$(dirname "$0")"
[ -d node_modules ] || npm ci
node build.mjs
