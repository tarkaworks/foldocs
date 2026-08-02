---
title: Generate AsyncAPI files
description: Produce stable channel and operation pages from an AsyncAPI contract.
---

# Generate AsyncAPI files

Write generated event documentation into its own directory.

```ts
import { generateFiles } from '@foldocs/asyncapi'

await generateFiles({
  input: './asyncapi.json',
  output: './content/docs/en/events',
  basePath: '/en/docs/events',
})
```

## Naming

Provide operation identifiers in the source contract whenever possible. Stable
identifiers create stable filenames, links, and search records even when a human
title changes.

## CI order

Validate the contract, generate files, run `foldocs check`, and build. Never let
a failed generator fall back to stale output from a previous deployment.
