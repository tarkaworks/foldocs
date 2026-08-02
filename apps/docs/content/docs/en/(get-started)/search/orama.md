---
title: Orama
description: Use Foldocs' zero-configuration local full-text search provider.
icon: search
---

# Orama

`@foldocs/search-orama` is the default search provider. The production build
emits a locale-specific JSON index, and the browser loads it only after the first
search interaction.

## Configure local search

```ts
import { orama } from '@foldocs/search-orama'

const search = orama({ tolerance: 1 })
```

## Best fit

Use local Orama for small and medium documentation sites that do not require an
external indexing service. It keeps credentials, ingestion jobs, and recurring
provider costs out of the deployment.

## Production checks

Inspect the generated `search-index.json`, verify one result in every locale, and
make sure the index is cached as a static asset rather than embedded in the main
JavaScript chunk.
