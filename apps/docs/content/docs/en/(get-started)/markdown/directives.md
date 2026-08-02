---
title: Markdown directives
description: Add typed Foldkit islands to standard Markdown without arbitrary evaluation.
icon: code-xml
---

# Markdown directives

Directives let `.md` pages opt into typed Foldkit islands while remaining valid
portable Markdown.

## Block directive

```md
:::note{tone="info"}
This content is validated before it reaches the renderer.
:::
```

## Schema validation

Define the allowed directive names and attributes in the Markdown island
registry. Unknown directives, invalid attributes, and unsafe URLs fail during
compilation with a source location.

## Choose directives or MDX

Use directives for a small vocabulary shared with non-MDX tooling. Use `.mdx`
when nested component composition is clearer. Both paths produce the same typed
Foldocs AST and static output.
