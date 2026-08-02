---
title: Remote MDX
description: Load trusted Markdown or MDX at build time with Effect error handling.
---

# Remote MDX

`@foldocs/mdx-remote` loads trusted Markdown or MDX from a URL and exposes it as
a Foldocs content source.

## Create a source

```ts
import { createRemoteContentSource } from '@foldocs/mdx-remote'

const source = createRemoteContentSource({
  name: 'remote-docs',
  url: new URL('https://content.example.com/docs.json'),
})
```

The loader reports network, decoding, and content failures through Effect. Handle
those failures in the build program and do not silently publish an incomplete
documentation set.

## Security boundary

Remote MDX is compiled, not evaluated as arbitrary application JavaScript.
Component expressions and spread attributes remain unsupported. Only fetch from
trusted endpoints, pin revisions where possible, and keep credentials out of the
browser bundle.

## Caching

Cache by revision or response validator in CI. A deterministic cache key prevents
the same commit from producing different static output on later rebuilds.
