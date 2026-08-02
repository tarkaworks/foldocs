---
title: Layouts
description: Understand the docs and landing layout inputs and responsive behavior.
index: true
---

# Layouts

Foldocs provides `docsLayout` and `landingLayout`. The generated application
connects them to routing, search, themes, locale selection, and clipboard
effects, so most projects configure layouts rather than calling them directly.

## Documentation layout

`DocsLayoutOptions` contains the current page, navigation tree, root tabs,
adjacent pages, table of contents, locale links, theme state, and Foldkit action
messages. The default shell reserves one viewport for the header and three
documentation columns before the full-width site footer enters the scroll area.

## Presets

The `layout.preset` setting accepts `docs`, `notebook`, `flux`, or `glass`.
Presets share the same semantic navigation and content; only their visual shell
changes.

```ts
export default defineConfig({
  layout: { preset: 'docs' },
})
```

## Responsive behavior

On narrow screens the desktop sidebar becomes a Foldkit dialog and the table of
contents becomes a compact sticky disclosure. Focus is trapped while the dialog
is open and restored to its trigger when it closes.
