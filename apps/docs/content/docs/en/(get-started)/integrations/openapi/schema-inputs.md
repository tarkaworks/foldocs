---
title: Schema inputs
description: Load OpenAPI documents from objects, local files, or remote URLs at build time.
---

# OpenAPI schema inputs

`@foldocs/openapi` accepts an in-memory document, a filesystem path, a `file:`
URL, or an HTTP URL. Loading and parsing happen in the build process; schemas and
credentials are not shipped to the browser.

## Local file

```ts
import { generateFiles } from '@foldocs/openapi'

await generateFiles({
  input: './contracts/openapi.yaml',
  output: './content/docs/en/api',
})
```

JSON and YAML documents are supported.

## Remote URL

```ts
await generateFiles({
  input: new URL('https://api.example.com/openapi.json'),
  output: './content/docs/en/api',
})
```

Remote responses must succeed and contain a valid OpenAPI or Swagger document.
Run generation in a trusted server or CI environment when authentication is
required.

## In-memory document

Use `generateOpenApiFiles` when another tool already loaded or transformed the
schema:

```ts
import { generateOpenApiFiles } from '@foldocs/openapi'

const files = generateOpenApiFiles(document, {
  title: 'Acme API',
  baseUrl: '/en/docs/api',
})
```

This synchronous API returns generated paths and source strings without writing
to disk.

## Validation boundary

Inputs must define `info.title`, `info.version`, `paths`, and either `openapi` or
`swagger`. Invalid documents fail generation rather than producing a partial
reference.
