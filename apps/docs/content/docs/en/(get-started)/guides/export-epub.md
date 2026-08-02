---
title: Export an EPUB
description: Package documentation into an offline EPUB with deterministic chapters and assets.
icon: book-open
---

# Export an EPUB

`@foldocs/epub` converts compiled Foldocs pages into an EPUB 3 archive. It uses
the same deterministic AST as the website, so headings, lists, tables, code,
links, and images remain portable.

## Export a content directory

```ts
import { exportDirectory } from '@foldocs/epub'

await exportDirectory({
  input: './content/docs/en',
  output: './dist/foldocs.epub',
  title: 'Foldocs documentation',
  identifier: 'https://foldocs.vercel.app/en/docs',
  author: 'Tarkaworks',
})
```

## Assets

Images are copied into the archive with their media types and page references
rewritten. Keep asset paths relative to the source page and avoid browser-only
components that cannot produce a readable static fallback.

## Release workflow

Generate the EPUB from the same commit as the website, validate the archive with
an EPUB checker, and publish both artifacts under one release identifier.
