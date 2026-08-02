---
title: MDX pipeline
description: Compile Markdown and MDX into a deterministic, validated document model.
index: true
---

# MDX pipeline

Fumadocs exposes many individual Remark and Rehype plugins from its Core
package. Foldocs provides the equivalent documentation pipeline as one ordered
compiler in `foldocs-mdx`, with `.md` parsing delegated to official
`@foldkit/markdown` APIs.

## Processing order

1. Decode YAML frontmatter with Effect Schema.
2. Parse Markdown or MDX into a normalized Foldocs AST.
3. Generate stable heading IDs and table-of-contents entries.
4. Expand package-install commands and enrich local images.
5. Highlight code or call the configured custom highlighter.
6. Produce plain text for search and source Markdown for LLM routes.

The output is serializable and independent from the browser renderer.

## Public API

```ts
import { compile, documentToMarkdown } from 'foldocs-mdx'

const page = await compile(source, { filePath })
const markdown = documentToMarkdown(page.document)
```

See the dedicated [Foldocs MDX reference](/en/docs/mdx) for AST and compiler
types.
