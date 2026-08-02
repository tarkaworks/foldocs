---
title: Glass layout
description: Use translucent surfaces for a visually layered documentation shell.
icon: panels-top-left
---

# Glass layout

The `glass` preset adds translucent surfaces and layered borders while retaining
the same semantic docs structure.

```ts
export default defineConfig({
  layout: { preset: 'glass' },
})
```

## Contrast

Test light and dark themes against the actual page background. Translucency must
not reduce text, focus-ring, active-navigation, or code-block contrast.

## Performance

Keep backdrop effects constrained to stable surfaces. Avoid animating blur or
large translucent regions during scroll.
