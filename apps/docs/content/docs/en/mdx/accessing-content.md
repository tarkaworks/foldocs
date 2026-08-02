---
title: Accessing content
description: Read typed page metadata and load compiled documents from the virtual manifest.
---

# Accessing content

The Foldocs Vite plugin exposes the complete site through `virtual:foldocs`.
Unlike separate server, browser, and dynamic collection entries, one serializable
manifest works in the Foldkit application and keeps page bodies lazy.

## Virtual entry module

```ts
import {
  basePath,
  i18n,
  manifest,
  navigation,
  searchIndexUrls,
  siteConfig,
} from 'virtual:foldocs'
```

Add `@foldocs/vite/client` to `compilerOptions.types` so TypeScript knows the
virtual module:

```json
{
  "compilerOptions": {
    "types": ["@foldocs/vite/client", "vite/client"]
  }
}
```

## Find a page

Manifest entries contain eager metadata and a lazy module loader.

```ts
import { findPageByUrl } from 'foldocs-core/manifest'
import { manifest } from 'virtual:foldocs'

const entry = findPageByUrl(manifest, '/docs/getting-started')

if (entry !== undefined) {
  console.log(entry.frontmatter.title)
  const { default: page } = await entry.load()
  console.log(page.document)
}
```

## Eager metadata

Navigation, page titles, descriptions, locale information, timestamps, table of
contents, and search text are serializable manifest fields. Reading them does not
load the compiled document body.

## Lazy document output

`entry.load()` imports only the selected route chunk and returns a
`CompiledPage`. Vite caches the module promise, so repeated access does not
compile or download the page again.

For lower-level lookups and pagination, continue with
[page manifests](/en/docs/core/manifests).
