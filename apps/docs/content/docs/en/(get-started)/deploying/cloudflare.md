---
title: Cloudflare with Alchemy
description: Deploy a generated Foldocs project to Cloudflare Workers static assets.
---

# Cloudflare with Alchemy

## Generated infrastructure

Generated projects include `alchemy.run.ts` and scripts for development,
deployment, and teardown.

## Deploy

```sh
cp .env.example .env
pnpm deploy
```

Authenticate Cloudflare through your local environment or CI and set an Alchemy
password for encrypted state. The included Worker serves static assets with SPA
fallback disabled, preserving directory routes and real not-found responses.

## One-click deployment

For one-click deployment, publish the project to GitHub and point Cloudflare's
deploy button at that repository. Store `CLOUDFLARE_API_TOKEN`,
`ALCHEMY_PASSWORD`, and remote-state credentials as encrypted variables.
