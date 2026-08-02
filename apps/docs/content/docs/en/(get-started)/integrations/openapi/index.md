---
title: OpenAPI
description: Generate deterministic API reference pages from an OpenAPI document.
index: true
---

# OpenAPI

`@foldocs/openapi` accepts a JSON object, local file, URL, or serialized OpenAPI
document and turns operations into normal Foldocs pages. Generated files use the
same navigation, search, Markdown, and static output pipeline as authored pages.

## Install

```bash
pnpm add -D @foldocs/openapi
```

## Generation modes

- `generateOpenApiFiles` returns an in-memory file list for custom build tools.
- `generateFilesOnly` writes pages without starting another process.
- `generateFiles` writes pages and records a manifest for safe regeneration.

## Stable output

Set an explicit output directory and base route. Commit generated files when
reviewable diffs matter, or generate them in CI when the schema is already
versioned and immutable.
