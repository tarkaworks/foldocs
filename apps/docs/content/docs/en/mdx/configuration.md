---
title: Configuration
description: Configure Foldocs content globally and extend its deterministic compilation pipeline.
---

# Configuration

Foldocs separates serializable site configuration from build-time compiler and
renderer extensions.

## Site configuration

Create `foldocs.config.ts` with `defineConfig`:

```ts
import { defineConfig } from 'foldocs'

export default defineConfig({
  site: {
    title: 'Acme Docs',
    description: 'Documentation for Acme.',
  },
  content: {
    dir: 'content/docs',
    lastModified: 'git',
  },
  prerender: true,
  markdown: true,
  llms: true,
})
```

This object controls content discovery, locales, routes, navigation layout,
publishing output, search, and metadata.

## Compiler options

Build-time extensions belong on the Vite plugin because they can contain
functions and Foldkit views:

```ts
foldocs({
  ...docs,
  components: mdxComponents,
  islands: markdownIslands,
  markdownOptions: { islands: markdownIslandDefinitions },
  highlightCode: createTwoslashHighlighter(),
})
```

| Option            | Purpose                                          |
| ----------------- | ------------------------------------------------ |
| `components`      | Render deterministic MDX component nodes         |
| `islands`         | Render typed `@foldkit/markdown` directives      |
| `markdownOptions` | Validate `.md` directive schemas at compile time |
| `highlightCode`   | Replace or extend build-time code highlighting   |

## Deterministic preset

Foldocs has one documentation-oriented compiler preset: frontmatter, GFM,
headings, tables, math, Mermaid, safe links, code highlighting, package-manager
commands, and typed components. It does not expose arbitrary remark or rehype
plugin arrays because executable tree transforms would weaken portable output
and consistent static rendering.

## Per-page configuration

Page-specific behavior is expressed through validated
[frontmatter](/en/docs/mdx/frontmatter). Compiler functions and component
registries remain global so the same source always produces the same document
across search, HTML, Markdown, and LLM output.
