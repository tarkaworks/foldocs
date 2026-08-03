---
title: Generate a file tree
description: Turn a real directory into a Foldocs Files component.
---

# Generate a file tree

```bash
pnpm foldocs tree ./src ./content/tree.mdx
```

The output contains nested `Files`, `Folder`, and `File` components. Directories
are listed first and entries are sorted deterministically. Hidden files and
`node_modules` are excluded by default; pass `--hidden` when they are relevant.

## Typed output

An output ending in `.tsx` receives a serializable `BlockComponent` tree instead
of MDX. This is useful for content adapters and generated documents that operate
directly on Foldocs' typed AST.
