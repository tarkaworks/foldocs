---
title: Custom search provider
description: Implement a provider without coupling Foldocs UI to an SDK.
icon: wrench
---

# Custom search provider

Implement `SearchClient` when an existing provider package does not fit the
deployment.

```ts
import type { SearchClient } from '@foldocs/search'

export const search: SearchClient = {
  provider: 'custom',
  search: (query, options = {}) =>
    Effect.tryPromise(() => queryApi(query, options.limit ?? 12)),
}
```

## Result contract

Return stable URLs, titles, optional descriptions, excerpts, and scores. The UI
owns keyboard navigation and rendering; the client owns transport, provider
errors, and result normalization.

## Optional indexing

Implement `SearchIndexer` when CI should synchronize documents. Keep indexing
code in the build environment so provider administration credentials never enter
the browser bundle.
