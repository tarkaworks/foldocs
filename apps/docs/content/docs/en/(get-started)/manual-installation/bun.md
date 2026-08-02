---
title: Install with Bun
description: Install Foldocs in an existing Foldkit application with Bun.
---

# Install with Bun

## Runtime packages

Install runtime packages:

```sh
bun add foldocs foldkit effect @effect/platform-browser
```

## Build packages

Install the build integrations:

```sh
bun add --dev @foldocs/vite @foldkit/vite-plugin vite typescript
```

## Start Vite

Run `bunx vite` after adding the Foldocs and Foldkit plugins to `vite.config.ts`.
