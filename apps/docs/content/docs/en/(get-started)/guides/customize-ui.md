---
title: Customize the UI
description: Change tokens and components without replacing the documentation runtime.
---

# Customize the UI

Start with `foldocs.config.ts`. Site identity, links, landing sections, footer
copy, layout preset, and project icons are configuration and survive package
upgrades without copied source.

## Theme tokens

Override Foldocs CSS variables after importing the preset. Keep light and dark
values together and verify foreground contrast against every surface.

```css
:root {
  --fd-accent-600: #6d5dfc;
  --fd-sidebar-width: 17rem;
}
```

## Owned components

Use `foldocs customize` when configuration is no longer enough. The command
copies selected theme, layout, or MDX component entry points into the project.
Run typecheck and visual tests after future Foldocs upgrades because copied
files no longer receive framework changes automatically.

## Validate overrides

Run type-checking, content validation, the production build, and visual browser
tests after changing owned CSS or renderers. Test light, dark, mobile, and
right-to-left layouts when those modes are enabled.
