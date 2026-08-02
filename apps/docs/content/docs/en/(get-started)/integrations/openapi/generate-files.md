---
title: Generate OpenAPI files
description: Configure stable paths and regeneration for OpenAPI reference pages.
---

# Generate OpenAPI files

Use `generateFiles` when generated documentation should be written to disk and
tracked with a manifest.

```ts
import { generateFiles } from '@foldocs/openapi'

await generateFiles({
  input: './openapi.json',
  output: './content/docs/en/api',
  basePath: '/en/docs/api',
})
```

## Regeneration

Run the generator whenever the contract changes. The manifest identifies files
owned by the generator, allowing stale operations to be removed without touching
handwritten content outside the output directory.

## CI order

Generate references, run `foldocs check`, build the static site, and test one
deep operation URL against the preview server. This catches schema, navigation,
and hosting failures before deployment.
