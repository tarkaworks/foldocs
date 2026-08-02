---
title: Markdown serialization
description: Turn the compiled document back into portable agent-readable Markdown.
---

# Markdown serialization

`documentToMarkdown` serializes the deterministic AST used by the browser into
portable Markdown.

```ts
import { documentToMarkdown } from 'foldocs-mdx'

const source = documentToMarkdown(page.document, {
  baseUrl: 'https://foldocs.vercel.app',
})
```

## Component fallbacks

Callouts become Markdown admonition blockquotes, cards become linked headings,
and other components retain their readable text. Browser-only decoration is not
included.

## Absolute links

Set `baseUrl` to convert root-relative links into production URLs for `.md`
responses and LLM corpora.

## Shared output

The Vite integration uses this serializer for page `.md` routes, `llms.txt`, and
`llms-full.txt`, keeping all agent-facing surfaces aligned.
