---
title: Foldocs MDX
description: Compile Markdown and deterministic MDX into a portable typed document.
icon: album
---

# Foldocs MDX

`foldocs-mdx` converts authored content into a typed AST that can be rendered by
Foldkit, indexed for search, serialized for LLMs, and prerendered without a React
runtime.

## Pipeline

1. Decode frontmatter with `@foldocs/content`.
2. Parse `.md` through official `@foldkit/markdown` support when configured.
3. Normalize Markdown and deterministic MDX into tagged block and inline nodes.
4. Generate heading identifiers, table-of-contents entries, and plain text.
5. Highlight code through the configured highlighter.

The browser never needs to parse source Markdown.

## Portable consumers

The same AST feeds Foldkit UI, search, Markdown serialization, LLM corpora,
EPUB export, and tests without coupling those consumers to the source parser.

## Deterministic components

Literal component attributes and children remain in the tree. Project renderers
can customize presentation while unsafe JavaScript expressions stay rejected.
