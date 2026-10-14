#!/usr/bin/env bash
# Builds the static prototype into dist/ (committed, so Vercel serves it without a build step).
set -euo pipefail
cd "$(dirname "$0")"
rm -rf dist && mkdir -p dist/assets
bun build src/main.tsx --outdir dist/assets --entry-naming app.js --minify --target browser \
  --define 'process.env.NODE_ENV="production"'
cp public/* dist/
cp src/styles.css dist/assets/app.css
echo "Built dist/"
