---
title: Content sources
description: Implement the small typed contract used by local files, remote MDX, and CMS adapters.
icon: files
---

# Content sources

`@foldocs/content` defines the build-time content boundary independently of Vite
or the UI package.

## Types

- `ContentFile` contains a stable path and source text.
- `ContentAdapter` loads a collection of files.
- `ContentSource<Data>` exposes typed records to adapter implementations.
- `PageFrontmatter`, `TocItem`, and `PageMetadata` are Effect schemas.

## Define an adapter

```ts
import { defineContentAdapter } from '@foldocs/content'

export const adapter = defineContentAdapter('release-notes', async () => files)
```

## Validation

Decode unknown records at the adapter boundary. The Vite integration then rejects
unsafe paths, duplicate ownership, and content that cannot compile.
