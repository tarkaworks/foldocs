---
title: Content sources
description: Load local Markdown, remote MDX, CMS records, and Obsidian vaults through one deterministic pipeline.
index: true
---

# Content sources

Foldocs keeps content acquisition separate from compilation. A source produces
typed files, and the same compiler then validates frontmatter, creates routes,
extracts headings, and builds search documents.

## Choose a source

- **Local Markdown and MDX** are the default and require no adapter.
- **Remote MDX** loads a trusted repository or content endpoint at build time.
- **Sanity and BaseHub** map CMS records through `@foldocs/content`.
- **Obsidian** converts wiki links, embeds, and vault assets into portable files.

## Adapter contract

All external sources implement `ContentAdapter`, which returns stable paths and
UTF-8 content. Keep authentication in the build environment and return only the
fields needed to create documentation pages.

```ts
import { defineContentAdapter } from '@foldocs/content'

export const content = defineContentAdapter('release-notes', async () => [
  { path: 'index.md', source: '# Docs' },
])
```

## Production rule

Pin remote revisions, fail the build when a source cannot be read, and validate
links after all sources are merged. That makes a deployment reproducible even
when the source system changes independently.
