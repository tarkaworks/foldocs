---
title: Docs layout
description: Use the balanced three-column documentation shell.
icon: panels-top-left
---

# Docs layout

The `docs` preset is the default. It combines a package selector and navigation
sidebar, a bounded article column, and a fixed-width table of contents.

```ts
export default defineConfig({
  layout: { preset: 'docs' },
})
```

## Viewport behavior

The header and documentation frame fill the first viewport. The left navigation
scrolls independently while its root selector remains pinned. The full-width
footer enters only after the document reaches its end.

## Best fit

Choose this preset for product and API documentation with a deep navigation tree
and meaningful page headings.
