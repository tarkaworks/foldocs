---
title: Configuration
description: Configure Foldocs content and extend its deterministic compilation pipeline.
---

# Configuration

Foldocs separates serializable site configuration from build-time compiler and
renderer extensions.

## Site configuration

```ts
import { defineConfig } from 'foldocs'

export default defineConfig({
  site: { title: 'Acme Docs' },
  content: { dir: 'content/docs', lastModified: 'git' },
  prerender: true,
  markdown: true,
  llms: true,
})
```

## Compiler extensions

The Vite plugin accepts Remark plugins, typed document transforms, include
settings, Foldkit Markdown islands, custom component views, and a highlighter.

```ts
foldocs({
  ...docs,
  remarkPlugins: defaults => [...defaults, remarkMyPlugin],
  documentPlugins: [page => ({ ...page, source: normalize(page.source) })],
  include: { cwd: process.cwd() },
  components: mdxComponents,
  islands: markdownIslands,
  markdownOptions: { islands: markdownIslandDefinitions },
  highlightCode: createTwoslashHighlighter(),
})
```

`documentPlugins` operate on Foldocs' serializable document rather than an HTML
tree. This preserves the same output for the Foldkit UI, static pages, search,
Markdown routes, and LLM files.

## MDX module syntax

Import declarations are accepted so authored pages can use familiar component
imports; rendering is still resolved by the configured Foldkit registry. JSON
literal expressions and spreads are serialized. Runtime JavaScript expressions
remain rejected because they cannot be safely prerendered or indexed.
