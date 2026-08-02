---
title: Standalone compilation
description: Compile one Markdown or deterministic MDX document directly in Node.js or Bun.
---

# Standalone compilation

Use `foldocs-mdx/compiler` when a script, importer, test, or content adapter needs
the typed compiler without starting Vite.

## Node.js

```ts
import { compile } from 'foldocs-mdx/compiler'
import { readFile } from 'node:fs/promises'

const filePath = 'content/docs/reference.md'
const source = await readFile(filePath, 'utf8')
const page = await compile(source, { filePath })

console.log(page.frontmatter.title)
console.log(page.toc)
```

## Bun

The same API works in Bun. Source text can come from `Bun.file()`, an HTTP
response, a database, or any other build-time input.

```ts
import { compile } from 'foldocs-mdx/compiler'

const filePath = 'content/docs/reference.md'
const page = await compile(await Bun.file(filePath).text(), { filePath })
```

## Optional highlighting

Pass `highlight: true` to use the built-in Shiki highlighter, or provide
`highlightCode` for a compiler-aware integration such as `@foldocs/twoslash`.

## Scope

Standalone compilation returns one `CompiledPage`. It does not discover a site,
build navigation, or emit routes. Use the [Vite integration](/en/docs/mdx/vite)
for a complete documentation application.
