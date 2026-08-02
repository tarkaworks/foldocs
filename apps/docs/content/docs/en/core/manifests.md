---
title: Page manifests
description: Look up pages and calculate adjacent documents from a typed manifest.
---

# Page manifests

A `PageManifestEntry<Page>` combines searchable metadata with a lazy module
loader. Production builds can therefore prerender route metadata without adding
every compiled page module to the initial browser chunk.

## Lookups

```ts
import { findPageBySlug, findPageByUrl } from 'foldocs-core/manifest'

const guide = findPageBySlug(manifest, 'guides/deploy')
const current = findPageByUrl(manifest, '/en/docs/guides/deploy/')
```

URL lookup normalizes trailing slashes and ignores query strings and fragments.

## Pagination

`adjacentPages` can use manifest order or the visible navigation tree. Passing
navigation ensures draft, hidden, locale, folder-index, and root boundaries are
the same in the sidebar and previous/next controls.

## Lazy content

Manifest entries keep serializable metadata eager and compiled page modules
lazy. Navigation and search can inspect the corpus without loading every page
body into the initial browser bundle.
