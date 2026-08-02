#!/usr/bin/env bash
set -euo pipefail

directories=(apps/docs/src packages/*/src)

pnpm exec madge \
  --circular \
  --extensions ts \
  --exclude '\.d\.ts$' \
  --no-spinner \
  --ts-config tsconfig.base.json \
  "${directories[@]}"

echo "No circular dependencies found."
