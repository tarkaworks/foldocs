---
title: Deploying
description: Publish the prerendered Foldocs output to any static-capable platform.
icon: rocket
index: true
---

# Deploying

Foldocs production output is a static directory. Every route has complete HTML,
so deployment requires an asset host rather than a long-running application
server.

## Before deployment

Set the canonical `site.baseUrl`, run `pnpm build`, and inspect at least one
nested route from `dist`. Configure the host to serve directory index files and
keep SPA fallback disabled; unknown routes should return a real 404.

The generated project includes Alchemy for Cloudflare, while Vercel and other
static hosts can publish `dist` directly.

## Platform guides

Use the Cloudflare guide for the generated Alchemy configuration, the Vercel
guide for zero-function static deployment, or Static hosting for any CDN that
supports directory index files.

## Verify production output

Open a nested route directly, request its sibling `.md` resource, and confirm an
unknown route produces a real 404 before promoting a deployment.
