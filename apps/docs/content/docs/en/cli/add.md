---
title: Add components
description: Install editable Foldkit component views into your application.
---

# Add components

Use `add` when the built-in component works but your design requires owning its
renderer.

```bash
pnpm foldocs add callout cards files
```

The command writes `src/foldocs/installed-components.ts`. Pass its
`installedMdxComponents` registry to `createDocsProgram`, then edit normal
Foldkit views in your application.

## Available components

`callout`, `cards`, `files`, `tabs`, `accordion`, `steps`, `type-table`,
`graph`, and `story` are available. Use `--output` to choose another module and
`--force` to replace an existing generated registry.

## Built-ins remain the default

Installing is optional. Foldocs renders the complete built-in component set
without generating project files; `add` is an ownership and customization tool.
