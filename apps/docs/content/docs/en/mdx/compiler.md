---
title: Compiler
description: Compile content with frontmatter, typed islands, and optional highlighting.
icon: code-xml
---

# Compiler

The asynchronous `compile` function accepts source text and returns a
`CompiledPage` containing frontmatter, document blocks, table-of-contents data,
source, and plain text.

```ts
import { compile } from 'foldocs-mdx/compiler'

const page = await compile(source, {
  filePath: 'content/docs/en/guides/setup.md',
  highlight: true,
})
```

## Deterministic MDX

Literal JSX-style component attributes are supported. Spread attributes and
JavaScript expressions are rejected because they cannot be indexed or
prerendered deterministically. Interactive behavior belongs in a typed Foldkit
component model.

## Safety

The compiler rejects unsafe URL schemes and includes file and line information
in authoring errors when source positions are available.

## Compiler output

Each compiled page contains decoded frontmatter, a typed document, a stable
table of contents, plain search text, and the original Markdown source.
