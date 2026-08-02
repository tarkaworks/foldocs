---
title: Vite
description: Compile Foldocs content and generate a static Foldkit site with the Vite plugin.
---

# Vite

`@foldocs/vite` is the production integration for Foldocs MDX. It discovers
content, creates typed virtual modules, watches files in development, and emits
the static documentation site.

## Installation

```npm
npm install foldocs foldkit effect
npm install --save-dev @foldocs/vite @foldkit/vite-plugin vite typescript
```

## Configure Vite

```ts
import { defineConfig } from 'vite'

import { foldkit } from '@foldkit/vite-plugin'
import { foldocs } from '@foldocs/vite'

import docs from './foldocs.config.js'

export default defineConfig({
  plugins: [foldocs(docs), foldkit()],
})
```

Keep `foldocs()` before the Foldkit plugin so content modules and prerender hooks
are available to the application pipeline.

## Configure the content root

```ts
import { defineConfig } from 'foldocs'

export default defineConfig({
  site: { title: 'Acme Docs' },
  content: { dir: 'content/docs' },
})
```

`content.dir` is resolved from the Vite project root. `.md` and `.mdx` files are
compiled; `meta.json` files define navigation; sibling assets are copied to the
matching public path.

## Generated output

The plugin emits prerendered HTML, lazy page chunks, per-page Markdown, search
indexes, sitemap and LLM resources, plus optional RSS and social images. These
artifacts come from the same manifest, so routing and published metadata cannot
drift apart.

## Development updates

Vite watches the content root. Editing a document clears its compiler cache and
invalidates the virtual manifest without restarting the server.
