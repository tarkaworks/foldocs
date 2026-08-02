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

Generated projects are host-neutral by default. Choose a provider during
scaffolding only when you want its deployment files:

```sh
pnpm create foldocs@latest my-docs --deployment vercel
pnpm create foldocs@latest my-docs --deployment cloudflare
```

Omit `--deployment` to receive no provider-specific dependency, script, or
configuration. Any static host can still publish `dist` later.

## Platform guides

Use the Cloudflare guide for the optional Alchemy integration, the Vercel guide
for zero-function static deployment, or Static hosting for any CDN that supports
directory index files.

## Verify production output

Open a nested route directly, request its sibling `.md` resource, and confirm an
unknown route produces a real 404 before promoting a deployment.
