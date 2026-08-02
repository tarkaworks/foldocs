---
title: Directives and islands
description: Validate Markdown directives and MDX component boundaries at compile time.
---

# Directives and islands

Container and leaf directives compile to typed block components. MDX flow and
text elements use the same component model, so `.md` and `.mdx` can share view
implementations.

```md
:::Aside{type="warning" title="Before you continue"}
Back up the existing configuration.
:::
```

## Foldkit Markdown

For `.md` files, configure island schemas through the official
`@foldkit/markdown/vite` options exposed as `CompileOptions.markdown`. Unknown
islands or invalid attributes fail compilation with a source line.

## MDX

MDX preserves component names and string attributes in the deterministic AST.
Register block and inline renderers through `MarkdownViewOptions.components`;
unregistered components fail visibly rather than executing arbitrary code.
