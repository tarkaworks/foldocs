---
title: BaseHub
description: Convert BaseHub query results into deterministic documentation files.
---

# BaseHub

`@foldocs/basehub` accepts a project-supplied query function and maps its result
into the Foldocs content contract.

## Define the mapping

```ts
import { createBaseHubContentSource } from '@foldocs/basehub'

const source = createBaseHubContentSource({
  query: () => client.query({ documentation: { __args: { first: 100 } } }),
  select: result => result.documentation.items,
  map: entry => ({ path: `${entry.slug}.md`, source: entry.body }),
})
```

## Keep output stable

Sort records, normalize slugs, and reject duplicate paths before compilation.
Store the BaseHub token only in the build environment and use a pinned schema so
content-model changes fail clearly during CI.
