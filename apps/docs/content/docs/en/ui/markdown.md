---
title: Markdown rendering
description: Render Foldocs AST nodes with Foldkit Markdown views and project components.
icon: file-text
---

# Markdown rendering

`renderMarkdown` accepts Foldocs' deterministic document AST and a Foldkit HTML
builder. Standard text, emphasis, lists, and blockquotes reuse official
`@foldkit/markdown` views; Foldocs enriches code blocks, tables, headings, page
links, and documentation components.

## Options

`MarkdownViewOptions` supports typed Foldkit islands, custom inline and block
components, and copy-code messages. Unknown components render a safe semantic
fallback instead of evaluating arbitrary JavaScript.

```ts
import { inertHtml as h } from 'foldkit/html'
import type { MdxComponents } from 'foldocs-ui'

export const components: MdxComponents = {
  inline: {
    ProductName: (_component, content) => h.strong([], content),
  },
}
```

## Agent output

The same AST is serialized by `foldocs-mdx` for `.md` routes and LLM corpus
files, keeping browser content and agent-readable content aligned.

## Default components

Callouts, cards, steps, tabs, accordions, file trees, badges, headings, code
blocks, and tables have built-in Foldkit renderers and theme-aware CSS.
