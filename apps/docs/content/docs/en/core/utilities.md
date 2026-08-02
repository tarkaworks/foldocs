---
title: Utilities
description: Resolve locale-aware routes and locate pages without depending on the UI.
---

# Utilities

Foldocs Core exports small helpers used by the application runtime and available
to integrations.

## Locale routing

- `localeFromPathname` reads a configured locale prefix.
- `stripLocalePrefix` returns the locale-independent path.
- `localizedPathname` creates a route for a target locale.
- `localeHomePath` creates the locale landing route.

## Manifest lookup

- `findPageByUrl` resolves a canonical route.
- `findPageBySlug` resolves a content slug.
- `adjacentPages` returns previous and next entries in navigation order.

## Translation interpolation

`interpolateTranslation` replaces named values in UI translation templates while
keeping the translation model separate from rendering.

All helpers are deterministic and side-effect free, making them safe in build
plugins, tests, and Foldkit update functions.
