---
title: Markdown
description: Author typed Markdown with FoldKit's official parser and Foldocs enrichment.
index: true
---

# Markdown

## Standard Markdown

Use `.md` for most documentation. Foldocs delegates parsing and schema validation
to `@foldkit/markdown`, then enriches its typed document with the metadata needed
for documentation routes, search, highlighted code, and static output.

The supported vocabulary includes CommonMark paragraphs, headings, emphasis,
links, images, lists, blockquotes, thematic breaks, fenced code, GFM tables,
strikethrough, and block island directives. Foldocs additionally preserves GFM
task lists as an explicit extension.

## Deterministic MDX

Use `.mdx` only for deterministic inline component syntax. JavaScript expressions,
module code, raw HTML, spread attributes, and unsafe URL schemes fail compilation.

## Generated document data

Both formats produce the same typed AST, table of contents, search text,
Markdown endpoint, and prerendered page output.
