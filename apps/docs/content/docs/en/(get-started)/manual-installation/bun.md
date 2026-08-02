---
title: Bun
description: Install Foldocs in an existing Foldkit application with Bun.
---

# Bun

Install runtime packages:

```sh
bun add foldocs foldkit effect @effect/platform-browser
```

Install the build integrations:

```sh
bun add --dev @foldocs/vite @foldkit/vite-plugin vite typescript
```

Run `bunx vite` after adding the Foldocs and Foldkit plugins to `vite.config.ts`.
