---
title: Python
description: Generate Markdown reference pages from public Python declarations.
---

# Python

`@foldocs/python` extracts modules, classes, functions, annotations, and
docstrings into normal Foldocs pages.

```ts
import { generateFiles } from '@foldocs/python'

await generateFiles({
  input: './python/example_sdk',
  output: './content/docs/en/python',
  packageName: 'example_sdk',
})
```

## Scope

Treat leading-underscore names as private and keep generated pages focused on the
supported package surface. Use handwritten guides for workflows that cross
several functions or require domain context.

## Verification

Regenerate on every release and run `foldocs check` to catch link collisions or
missing index pages before the static build.
