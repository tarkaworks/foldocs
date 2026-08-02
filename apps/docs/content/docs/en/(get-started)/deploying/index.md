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
