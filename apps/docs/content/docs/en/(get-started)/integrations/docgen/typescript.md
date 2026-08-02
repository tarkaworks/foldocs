---
title: TypeScript
description: Generate reference pages from exported TypeScript declarations.
icon: code-xml
---

# TypeScript

`@foldocs/typescript` extracts public declarations and generates one or more
reference pages.

```ts
import { generateFiles } from '@foldocs/typescript'

await generateFiles({
  input: ['./src/index.ts'],
  output: './content/docs/en/reference',
  packageName: '@example/sdk',
})
```

## Public surface

Generate from package entrypoints rather than every source file. That keeps
internal helpers out of the docs and makes the reference match what consumers
can import.

## Release workflow

Run generation after type-checking and fail CI on uncommitted generated changes
when reference files are versioned.
