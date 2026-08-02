---
title: Sanity
description: Map Sanity records into typed Foldocs content files.
---

# Sanity

`@foldocs/sanity` adapts a Sanity client to the `ContentSource` contract. Your
query remains project-owned; Foldocs only maps returned records into stable paths
and source strings.

## Configure the adapter

```ts
import { createSanityContentSource } from '@foldocs/sanity'

const source = createSanityContentSource({
  client,
  query: '*[_type == "documentation"]',
  map: record => ({
    path: `${record.slug}.md`,
    source: record.body,
  }),
})
```

## Production guidance

Use a read-only token in the build environment, order records explicitly, and
make `map` deterministic. Preview drafts in a separate deployment so
unpublished content cannot enter the production search index or `llms.txt`.
