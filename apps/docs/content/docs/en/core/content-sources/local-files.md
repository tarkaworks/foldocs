---
title: Local files
description: Compile Markdown and MDX from the configured content directory.
---

# Local files

Local files are the default Foldocs source. Configure the directory once and
the Vite plugin discovers pages, locale variants, folder metadata, and assets.

```ts
import { defineConfig } from 'foldocs'

export default defineConfig({
  content: {
    dir: 'content/docs',
  },
})
```

## Build output

Discovery produces typed page metadata and lazy compiled modules. Production
builds prerender canonical HTML, explicit Markdown assets, locale search
indexes, and configured feeds from the same manifest.

## Watching

During development, adding or changing content invalidates the generated
virtual modules. Navigation and routes update without maintaining a separate
content registry.
