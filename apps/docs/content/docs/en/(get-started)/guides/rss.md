---
title: RSS feed
description: Emit localized RSS feeds from the same manifest used by navigation and search.
tags:
  - deployment
  - RSS
---

# RSS feed

Foldocs can generate RSS 2.0 feeds during the static build. Feed entries come
from the typed page manifest, so titles, descriptions, canonical URLs, locales,
and last-modified dates stay aligned with the rendered documentation.

## Enable RSS

Configure a public site URL and enable `rss`:

```ts title="foldocs.config.ts"
import { defineConfig } from 'foldocs'

export default defineConfig({
  site: {
    title: 'Acme documentation',
    baseUrl: 'https://docs.example.com',
  },
  rss: true,
})
```

`site.baseUrl` is required because RSS entries need absolute links. Foldocs emits
a build warning and skips the feed when it is missing.

## Customize the feed

```ts title="foldocs.config.ts"
rss: {
  path: 'updates.xml',
  title: 'Acme documentation updates',
  description: 'New and revised product documentation.',
}
```

The default path is `rss.xml`, and the default title is the site title.

## Localized feeds

With directory-based internationalization, the default locale is emitted at
`/rss.xml` and additional locales at paths such as `/es/rss.xml`. Each feed only
contains pages resolved for that locale.

## Discovery metadata

Every prerendered page includes an `application/rss+xml` alternate link to its
locale's feed. Feed items use page `lastModified` values when available.
