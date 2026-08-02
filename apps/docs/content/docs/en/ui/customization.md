---
title: Customization
description: Own theme and layout overrides without forking Foldocs UI.
---

# Customization

Prefer stable classes, `data-layout`, and theme variables over selectors that
depend on deeply nested generated markup.

## Generate owned files

```sh
pnpm foldocs customize all
```

The command creates project-owned theme, layout, and MDX component entry points
under `src/foldocs`. Existing files are preserved unless `--force` is passed.

## Theme variables

Override variables such as `--fd-primary`, `--fd-background`,
`--fd-sidebar-width`, and `--fd-toc-width` in the generated theme file. Keep
light and dark values together so prerendered pages retain the correct initial
palette.

## Custom icons

Page and folder icons use Lucide names by default. Supply SVG overrides through
`site.icons` when a product needs its own icon system.
