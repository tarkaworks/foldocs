---
title: Markdown files
description: Compile portable Markdown through official Foldkit Markdown validation.
icon: file-text
---

# Markdown files

Standard `.md` pages are parsed and validated through `@foldkit/markdown`. Foldocs
then normalizes the result into its shared typed AST for rendering, search, and
agent output.

## Supported authoring

Use headings, links, images, emphasis, lists, blockquotes, tables, fenced code,
task lists, and typed directives. Unsafe URL schemes and unknown island
attributes fail compilation.

## Why a shared AST

The browser renderer and Markdown serializer consume the same document. A page
cannot silently show one thing to readers and a different thing through its `.md`
route.

## Choose Markdown

Prefer `.md` for portable content and documentation that should remain useful in
GitHub or an editor without MDX support.
