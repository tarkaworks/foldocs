---
title: Internationalization
description: Resolve locale UI, content fallback, and stable translated routes.
index: true
---

# Internationalization

Foldocs treats localization as part of content discovery rather than request
middleware. The same resolved locale model drives URLs, navigation, search,
prerendering, Markdown routes, and interface labels.

## Content parser

Use locale directories by default:

```ts
i18n: {
  parser: 'dir',
  defaultLocale: 'en',
  locales: [
    { locale: 'en', name: 'English' },
    { locale: 'es', name: 'Español' },
  ],
}
```

This reads `content/docs/en/setup.md` and `content/docs/es/setup.md`. Set
`parser: 'dot'` to use `setup.md` for the default locale and `setup.es.md` for
Spanish instead.

## Locale prefixes

`hideLocale: 'never'` prefixes every locale. `default-locale` keeps the default
locale at `/docs` while other locales remain at `/es/docs`. `always` is only
valid for a single-locale static application because two translated files
cannot own the same output URL.

Locale configuration defines a code, display name, text direction, and optional
interface translation overrides. Missing labels fall back to Foldocs defaults.

## Content fallback

When a translated page is missing, the configured fallback locale supplies its
content while the requested locale keeps its own URL and navigation metadata.
This lets teams translate progressively without generating broken routes.

## Translation keys

Pages share a translation key derived from their path after locale and route
groups are removed. The Vite plugin uses that key for alternate links, search
indexes, `.md` routes, and prerender output.

## Right-to-left support

Set `dir: "rtl"` on a locale. Sidebar borders, logical padding, chevrons, page
context, and pagination use logical directions rather than hard-coded left and
right placement.
