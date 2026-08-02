---
title: Content sources
description: Combine local Markdown and typed build-time adapters in one documentation manifest.
---

# Content sources

Foldocs treats the local content directory and remote providers as inputs to one
page collection. It does not generate multiple collection entry folders or
framework-specific component modules.

## Local content

```ts
export default defineConfig({
  content: {
    dir: 'content/docs',
  },
})
```

The directory can use locale folders, route groups in parentheses, index pages,
and `meta.json` navigation files. Every Markdown or MDX page is validated with
the shared Effect schemas.

## Adapter content

```ts
import { defineContentAdapter } from '@foldocs/content'

const releases = defineContentAdapter('releases', async () => [
  {
    path: 'releases/v1.mdx',
    source: '---\ntitle: Version 1\n---\n\n# Version 1',
    lastModified: '2026-08-03T00:00:00.000Z',
  },
])

export default defineConfig({
  content: { sources: [releases] },
})
```

Adapters may fetch a CMS, transform generated API data, or combine content from
another workspace. Provider SDKs remain in the build process and do not leak
into browser bundles.

## Validation contract

Adapter names must be unique and URL-safe. Paths cannot escape the virtual
source, locales must exist in the site configuration, and two sources cannot own
the same locale and route.

## Metadata files

`meta.json` is reserved for page-tree configuration; it is not a generic data
collection. Application data should use a normal typed module or a custom
adapter instead.

See the detailed [content source contract](/en/docs/core/content-sources) for
local, remote, and validation examples.
