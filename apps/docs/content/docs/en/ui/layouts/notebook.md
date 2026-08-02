---
title: Notebook layout
description: Use a calmer reading-focused shell for guides and knowledge bases.
---

# Notebook layout

The `notebook` preset reduces the visual weight of navigation and gives the main
article a reading-oriented rhythm.

```ts
export default defineConfig({
  layout: { preset: 'notebook' },
})
```

## Best fit

Use Notebook for conceptual guides, internal handbooks, and documentation where
readers move sequentially more often than they jump between reference pages.

## Shared behavior

Search, locale routing, theme selection, page actions, static output, and the
mobile navigation dialog are identical to the default preset.
