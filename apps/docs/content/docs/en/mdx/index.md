---
title: Foldocs MDX
description: Compile Markdown and deterministic MDX into a portable typed document.
icon: album
---

# Foldocs MDX

`foldocs-mdx` converts authored content into a typed AST that can be rendered by
Foldkit, indexed for search, serialized for LLMs, and prerendered without a React
runtime.

## Introduction

Foldocs MDX is the content-processing layer of Foldocs. It accepts local or
adapter-provided Markdown and deterministic MDX, validates every page at build
time, and produces serializable data rather than framework-specific component
modules.

## What is a content source?

A content source is a collection of `.md` and `.mdx` files. The default source is
the configured content directory; additional sources implement the small
`ContentAdapter` contract.

```ts
import { defineConfig } from 'foldocs'

export default defineConfig({
  site: { title: 'Acme Docs' },
  content: { dir: 'content/docs' },
})
```

All sources join the same typed manifest, navigation tree, search indexes, and
static output. Continue with [content sources](/en/docs/mdx/content-sources) or
[accessing content](/en/docs/mdx/accessing-content).

## Pipeline

1. Decode frontmatter with `@foldocs/content`.
2. Parse `.md` through official `@foldkit/markdown` support when configured.
3. Normalize Markdown and deterministic MDX into tagged block and inline nodes.
4. Generate heading identifiers, table-of-contents entries, and plain text.
5. Highlight code through the configured highlighter.

The browser never needs to parse source Markdown.

## Integration

- [Vite](/en/docs/mdx/vite) discovers files, emits lazy page modules, and
  prerenders the site.
- [Standalone compilation](/en/docs/mdx/runtime-compilation) compiles a document
  directly in Node.js or Bun.

Foldocs is built specifically for Foldkit and Vite, so it does not include a
Next.js adapter or a React collection macro.

## Built-in properties

Every compiled page exposes:

| Property      | Description                            |
| ------------- | -------------------------------------- |
| `frontmatter` | Validated author metadata              |
| `document`    | Portable tagged block and inline nodes |
| `toc`         | Stable heading identifiers and labels  |
| `plainText`   | Search-ready text                      |
| `source`      | Original authored Markdown or MDX      |

The Vite manifest adds routing metadata such as `slug`, `url`, `locale`,
`lastModified`, and a lazy `load()` function.

## Portable consumers

The same AST feeds Foldkit UI, search, Markdown serialization, LLM corpora,
EPUB export, and tests without coupling those consumers to the source parser.

## Deterministic components

Literal component attributes and children remain in the tree. Project renderers
can customize presentation while unsafe JavaScript expressions stay rejected.

## Customize the pipeline

Use `markdownOptions` for official `@foldkit/markdown` island schemas,
`highlightCode` for a build-time code highlighter, and `components` or `islands`
for rendering. The compiler intentionally does not accept arbitrary executable
remark or rehype plugins; see [configuration](/en/docs/mdx/configuration) for the
supported extension points.
