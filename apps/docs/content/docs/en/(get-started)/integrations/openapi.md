---
title: OpenAPI
description: Generate an API reference from OpenAPI or Swagger documents.
---

# OpenAPI

`@foldocs/openapi` accepts OpenAPI 3.x and Swagger YAML or JSON from disk, a URL,
or memory. It generates operation pages, request parameters, schemas, examples,
responses, code samples, and navigation metadata.

```sh
foldocs-openapi openapi.yaml content/docs/en/api /en/docs/api
```

Run generation before `vite build` and commit the output when reviewable API
changes are valuable. The parser and source specification remain build-only.
