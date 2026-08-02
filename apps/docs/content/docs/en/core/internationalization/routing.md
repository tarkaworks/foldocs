---
title: Locale routing
description: Generate locale-aware routes, fallbacks, and alternate links without middleware.
---

# Locale routing

Foldocs resolves locale URLs at build time. It does not require the request
middleware used by server-rendered React frameworks.

## Prefix behavior

- `hideLocale: 'never'` prefixes every locale.
- `hideLocale: 'default-locale'` omits only the default locale prefix.
- `hideLocale: 'always'` is valid for a single-locale static site.

Use `localizedPathname`, `stripLocalePrefix`, `localeFromPathname`, and
`localeHomePath` when an integration needs the same routing rules.

## Missing translations

Pages share a translation key derived from their path after route groups and
locale markers are removed. When a translation is missing, Foldocs can render
fallback content at the requested locale URL while retaining the requested
language's navigation and alternate-link metadata.

## Static parameters

The Vite plugin already knows every locale/page pair and emits each final route.
There is no `generateStaticParams` or middleware configuration to maintain.
