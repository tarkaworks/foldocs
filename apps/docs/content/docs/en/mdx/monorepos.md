---
title: Monorepos
description: Build one or more Foldocs sites from workspace content without generated workspace entries.
---

# Monorepos

Foldocs works in package-manager workspaces through ordinary Vite project roots
and content adapters. It does not add a second workspace abstraction on top of
the monorepo.

## One documentation site

Keep one `foldocs.config.ts` in the docs application. `content.dir` resolves from
that application's Vite root, while adapters can read or generate content from
other workspace packages.

```text
apps/docs/
  content/docs/
  foldocs.config.ts
  vite.config.ts
packages/
  api/
  ui/
```

## Multiple sources

Use a named `ContentAdapter` for each external collection that needs its own
fetching or transformation logic. All returned pages still join one route and
navigation manifest.

## Multiple documentation sites

When packages require independent sites, give each site its own Vite application
and Foldocs configuration. Shared presets can be ordinary TypeScript modules in
a workspace package.

## Build caching

Declare content folders and generator inputs in the workspace task graph so the
package manager invalidates documentation builds when upstream sources change.
Foldocs itself caches page compilation within the active Vite process and does
not write generated collection entry files into the repository.
