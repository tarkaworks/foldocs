---
title: Images
description: Enrich local images with dimensions and render an optional zoom preview.
---

# Images

When `filePath` is available, the compiler reads relative image assets and adds
their intrinsic width and height to the AST. Absolute URLs, root-relative paths,
and fragments are left untouched.

```md
![Navigation overview](./assets/navigation.png 'Navigation overview')
```

Intrinsic dimensions reserve layout space before the asset loads and reduce
cumulative layout shift.

## Zoom behavior

The default Markdown view renders eligible images as zoom triggers. The Foldocs
runtime owns the dialog state, Escape handling, backdrop action, and accessible
label. Custom views may ignore the dimensions or provide their own image
component.

## Portable output

Markdown serialization retains the authored URL, alt text, and optional title.
EPUB generation consumes the same normalized image node.
