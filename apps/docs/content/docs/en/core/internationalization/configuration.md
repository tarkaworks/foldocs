---
title: Locale configuration
description: Define locale names, directions, route parsing, and interface translations.
---

# Locale configuration

Configure locales in `foldocs.config.ts`:

```ts
i18n: {
  parser: 'dir',
  defaultLocale: 'en',
  fallbackLocale: 'en',
  hideLocale: 'never',
  locales: [
    { locale: 'en', name: 'English', dir: 'ltr' },
    { locale: 'ar', name: 'العربية', dir: 'rtl' },
  ],
}
```

Each locale can override `UiTranslations`. Missing values fall back to the
built-in English model, so partial translation objects remain safe.

## Parsers

`dir` reads locale directories such as `en/setup.md`. `dot` reads suffixes such
as `setup.es.md` and treats the unsuffixed file as the default locale.

## Text direction

The resolved locale direction is applied before the application renders.
Logical CSS properties keep sidebars, pagination arrows, nested guides, and
menus correct in right-to-left layouts.
