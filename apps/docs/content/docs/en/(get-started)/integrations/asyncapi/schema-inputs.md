---
title: Schema inputs
description: Load AsyncAPI documents from objects, local files, or remote URLs at build time.
---

# AsyncAPI schema inputs

`@foldocs/asyncapi` accepts a document object, filesystem path, `file:` URL, or
HTTP URL. All loading and parsing occurs before the site bundle is produced.

## Local file

```ts
import { generateFiles } from '@foldocs/asyncapi'

await generateFiles({
  input: './contracts/asyncapi.yaml',
  output: './content/docs/en/events',
})
```

## Remote URL

```ts
await generateFiles({
  input: new URL('https://events.example.com/asyncapi.json'),
  output: './content/docs/en/events',
})
```

Fetch failures and invalid documents stop generation. Keep authenticated schema
loading in a trusted build environment.

## In-memory document

```ts
import { generateAsyncApiFiles } from '@foldocs/asyncapi'

const files = generateAsyncApiFiles(document, {
  title: 'Acme events',
  baseUrl: '/en/docs/events',
})
```

Use this form when a registry client or another build step already owns schema
loading.

## Validation boundary

Inputs must contain an AsyncAPI version plus `info.title` and `info.version`.
Operations from AsyncAPI 3 documents are preferred; AsyncAPI 2 channel
operations are normalized into the same generated model.
