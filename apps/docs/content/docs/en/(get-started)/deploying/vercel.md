---
title: Vercel
description: Publish Foldocs static output on Vercel without purchasing a custom domain.
---

# Vercel

## Generate the integration

Select Vercel when creating the application:

```sh
pnpm create foldocs@latest my-docs --deployment vercel
```

This adds a minimal `vercel.json` that declares `dist` as the static output
directory. It deliberately does not override the build command, allowing Vercel
to detect Vite and run the package's existing `build` script.

Projects created without this option remain host-neutral and can still be
imported into Vercel later.

## Project settings

Import the generated repository with the Vite framework preset. Keep the default
build command and publish `dist`.

## Static routing

No serverless function is required. Keep clean URLs enabled and avoid a catch-all
rewrite to `/index.html`; Vercel can serve the directory-index files emitted by
Foldocs directly.

## Canonical origin

Set `site.baseUrl` to the assigned `*.vercel.app` URL so canonical links,
sitemap entries, social images, and LLM sources all use the deployed origin.
