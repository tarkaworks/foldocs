---
title: Search
description: Local search by default and a provider-neutral path to hosted search.
order: 3
tags:
  - search
---

# Search

Effectdocs uses Orama for zero-config local full-text search. The index is created
from the same typed page manifest used by navigation and routing.

## Provider contract

Search is an Effect interface, so hosted providers do not leak their SDKs into the
Foldkit program.

```ts
interface SearchClient {
  readonly provider: string;
  readonly search: (
    query: string,
    options?: SearchOptions,
  ) => Effect.Effect<ReadonlyArray<SearchResult>, SearchError>;
}
```

## Current behavior

- [x] Orama local full-text search
- [x] Stale-result protection while typing
- [x] Search titles, descriptions, content, and tags
- [x] Separate hosted adapter packages for Algolia, Orama Cloud, Mixedbread, Typesense, and Trieve
- [ ] Keyboard selection and result grouping

## Use a hosted provider

Create the provider client and pass it to the same program factory. Search-only
browser credentials are acceptable for providers designed for them; keep admin keys
and ingestion credentials on a server or in CI.

```ts
import { createAlgoliaSearchClient } from "@effectdocs/search-algolia";
import { createDocsProgram } from "effectdocs";

const search = createAlgoliaSearchClient({
  client: algolia,
  indexName: "docs",
});

const program = createDocsProgram({ manifest, site: siteConfig, search });
```
