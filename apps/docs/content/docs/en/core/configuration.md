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
  basePath: '/docs',
  layout: { preset: 'docs' },
  seo: {
    author: { type: 'Person', name: 'Ada', url: 'https://example.com/ada' },
    publisher: { name: 'Acme', url: 'https://example.com' },
  },
})
```

## Search metadata and structured data

The resolved `seo` configuration controls the page-title template, author,
publisher, Twitter accounts, crawler directives, and JSON-LD. Production pages
receive route-specific canonical URLs, locale alternates, Open Graph and Twitter
images, Schema.org `WebSite`, `WebPage`, `Article`/`TechArticle`, `ImageObject`, and
`BreadcrumbList` nodes. Foldocs also emits `robots.txt` and sitemap `lastmod`
values when `site.baseUrl` and `sitemap` are enabled.

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

## Full reference

This page covers the settings authors reach for most often. For the complete,
generated shape of every field, its type, and its default, read the
[`FoldocsConfig`](/en/docs/typescript/foldocs-config) and
[`ResolvedFoldocsConfig`](/en/docs/typescript/resolved-foldocs-config)
reference pages, generated directly from `packages/core/src/config.ts` on
every build.
