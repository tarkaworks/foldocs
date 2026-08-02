---
title: Internationalization
description: Ship localized routes, navigation, search, metadata, and interface text.
icon: languages
index: true
---

# Internationalization

## Locale configuration

Enable i18n in `foldocs.config.ts` and create one content directory per locale.
Foldocs localizes landing pages, documentation routes, navigation, search indexes,
Markdown output, LLM files, canonical alternates, and interface labels from the
same configuration.

```ts
i18n: {
  defaultLocale: "en",
  fallbackLocale: "en",
  locales: [
    { locale: "en", name: "English" },
    { locale: "es", name: "Español" },
  ],
}
```

## Content fallback

Missing translated pages use the fallback source while retaining the requested
locale URL. This allows teams to publish translations incrementally.

## Localized output

Navigation, search indexes, Markdown endpoints, LLM files, and canonical
alternates are generated independently for each configured locale.
