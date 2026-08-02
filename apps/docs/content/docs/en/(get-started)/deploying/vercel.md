---
title: Vercel
description: Publish Foldocs static output on Vercel without purchasing a custom domain.
---

# Vercel

## Project settings

Import the repository, use `pnpm build` as the build command, and set the output
directory to `apps/docs/dist` for this monorepo or `dist` for a generated app.

## Static routing

No serverless function is required. Keep clean URLs enabled and avoid a catch-all
rewrite to `/index.html`; Vercel can serve the directory-index files emitted by
Foldocs directly.

## Canonical origin

Set `site.baseUrl` to the assigned `*.vercel.app` URL so canonical links,
sitemap entries, social images, and LLM sources all use the deployed origin.
