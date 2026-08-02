---
title: Cloudflare with Alchemy
description: Deploy a generated Foldocs project to Cloudflare Workers static assets.
---

# Cloudflare with Alchemy

## Generated infrastructure

Select Cloudflare when creating the application:

```sh
pnpm create foldocs@latest my-docs --deployment cloudflare
```

This adds `alchemy.run.ts`, `.env.example`, the `alchemy` development dependency,
and scripts for Cloudflare development, deployment, and teardown. Projects
created without this option contain none of those files or package entries.

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
