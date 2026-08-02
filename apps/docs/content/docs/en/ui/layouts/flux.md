---
title: Flux layout
description: Use a more expressive shell while retaining the Foldocs navigation model.
---

# Flux layout

The `flux` preset uses stronger surfaces and spacing for documentation sites that
need a more branded presentation.

```ts
export default defineConfig({
  layout: { preset: 'flux' },
})
```

## Content compatibility

Changing presets does not change routes, navigation, Markdown components, search
documents, or generated static HTML semantics. A page can move between presets
without rewriting content.

## Customize

Target `[data-layout="flux"]` in a project-owned layout stylesheet for additions
that should not affect other presets.
