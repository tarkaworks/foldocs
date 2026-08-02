---
title: FlexSearch
description: Run a compact local search index with a provider-compatible client.
---

# FlexSearch

`@foldocs/search-flexsearch` implements the Foldocs search contract with a local
FlexSearch index.

```ts
import { flexsearch } from '@foldocs/search-flexsearch'

const search = flexsearch({ tokenize: 'forward' })
```

## When to choose it

Use FlexSearch when a local index is preferred and its tokenization or ranking
fits the content better than the default provider. No hosted ingestion service is
required.

## Measure the trade-off

Compare compressed index size, first-search latency, and result quality using the
same document corpus. Keep the index lazy-loaded so switching providers does not
change initial page performance.
