---
title: Syntax highlighting
description: Use the built-in Shiki pipeline or inject a custom highlighter.
---

# Syntax highlighting

Foldocs creates highlighted HTML during compilation and stores it with the code
block node. This keeps Shiki out of the browser path for ordinary pages.

The default themes are `github-light` and `github-dark`. CSS variables select
the correct token colors without recompiling the document when the reader
changes theme.

## Custom engines

`CompileOptions.highlightCode` accepts an asynchronous `CodeHighlighter`.
Return HTML for languages your integration owns and `undefined` to use the
built-in Shiki behavior.

## Compiler information

Use `@foldocs/twoslash` when code blocks need TypeScript diagnostics and hover
information. It is intentionally separate from baseline syntax highlighting so
sites that do not need a TypeScript compiler do not pay its build cost.
