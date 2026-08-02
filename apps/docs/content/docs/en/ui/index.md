---
title: Foldocs UI
description: Foldkit-native layouts and documentation views without a React runtime.
icon: album
---

# Foldocs UI

`foldocs-ui` contains the visual layer used by every generated site. It renders
with Foldkit HTML builders, composes stateful controls from `@foldkit/ui`, and
keeps documentation state in the application's Effect program.

## Exports

| Export                | Responsibility                               |
| --------------------- | -------------------------------------------- |
| `foldocs-ui/layout`   | Documentation and landing-page layouts       |
| `foldocs-ui/markdown` | Deterministic Markdown and MDX AST rendering |
| `foldocs-ui`          | Combined public entry point                  |

## Runtime contract

The package does not mount a second UI framework. Buttons, menus, disclosures,
and dialogs use Foldkit components, while generic interface icons come from the
framework-neutral `lucide` package.

## Start here

- Use [Component library](/en/docs/ui/component-library) for the supported
  documentation primitives.
- Use [Theme](/en/docs/ui/theme) for colors, dimensions, and initial dark mode.
- Use [Layouts](/en/docs/ui/layouts) to understand the available page shells.
- Use [Navigation](/en/docs/ui/navigation) for folders, roots, and page context.
- Use [Search UI](/en/docs/ui/search) and
  [UI translations](/en/docs/ui/translations) for application behavior.
- Use [Customization](/en/docs/ui/customization) before overriding package CSS.
