---
title: Configuration
description: Decode and resolve a Foldocs application configuration.
---

# Configuration

`defineConfig` validates site, route, locale, search, landing, and layout
settings with Effect Schema. Resolution supplies defaults so the running
program does not branch on partially defined configuration.

```ts
import { defineConfig } from 'foldocs'

export default defineConfig({
  site: {
    title: 'My docs',
    baseUrl: 'https://docs.example.com',
  },
  docs: { basePath: '/docs' },
  layout: { preset: 'docs' },
})
```

## Site icons

`site.icons` maps frontmatter or `meta.json` icon names to trusted SVG strings.
Without an override, Foldocs resolves supported names from its tree-shaken
Lucide registry.

## Resolved values

Use the resolved configuration exposed by the generated application. It
contains normalized paths, complete interface translations, locale directions,
landing defaults, and the active layout preset.

## Validation errors

Configuration decoding reports the field path and expected value before the
application starts. Invalid locale, URL, layout, or content settings cannot
silently reach production.
