---
title: Search
description: Local search by default and a provider-neutral path to hosted search.
order: 3
tags:
  - search
---

# Search

Foldocs uses Orama for zero-config local full-text search. The index is created
from the same typed page manifest used by navigation and routing. Production builds
emit a per-locale `search-index.json`; the browser fetches it only on the first
search, so the full corpus is not part of the initial JavaScript bundle.

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
- [x] Lazy per-locale static search indexes
- [x] Stale-result protection while typing
- [x] Search titles, descriptions, content, and tags
- [x] Separate hosted adapter packages for Algolia, Orama Cloud, Mixedbread, Typesense, and Trieve
- [x] Server/CI ingestion from the generated static corpus
- [x] Full replacement semantics and duplicate-document validation
- [x] Arrow-key selection, Enter navigation, Escape handling, and live result counts
- [ ] Provider-defined result grouping

## Use a hosted provider

Create the provider client and pass it to the same program factory. Search-only
browser credentials are acceptable for providers designed for them; keep admin keys
and ingestion credentials on a server or in CI.

```ts
import { createAlgoliaSearchClient } from "@foldocs/search-algolia";
import { createDocsProgram } from "foldocs";

const search = createAlgoliaSearchClient({
  client: algolia,
  indexName: "docs",
});

const program = createDocsProgram({ manifest, site: siteConfig, search });
```

## Synchronize the hosted index

Production builds emit `dist/<locale>/search-index.json`. Load one or more of
those snapshots on a server or in CI, then pass the combined corpus to a provider
indexer. The sync contract validates duplicate IDs and URLs, orders the snapshot
deterministically, and returns an Effect report with document and locale counts.

```ts
import { createAlgoliaSearchIndexer } from "@foldocs/search-algolia";
import { loadSearchDocuments } from "@foldocs/search/sync";
import { syncSearchDocuments } from "@foldocs/search";
import { Effect } from "effect";

const en = await Effect.runPromise(
  loadSearchDocuments("dist/en/search-index.json"),
);
const es = await Effect.runPromise(
  loadSearchDocuments("dist/es/search-index.json"),
);

const indexer = createAlgoliaSearchIndexer({
  client: algoliaAdmin,
  indexName: "docs",
});

const report = await Effect.runPromise(
  syncSearchDocuments(indexer, [...en, ...es]),
);
```

Algolia configures searchable/faceted attributes before `replaceAllObjects`.
Orama Cloud uses a transaction, and Typesense clears then imports the complete
snapshot while checking per-row failures. Mixedbread and Trieve accept a private
`replace` callback so their SDK, CLI, and credentials remain completely outside the
browser bundle. `syncSearchIndex()` combines loading and synchronization when a
single generated snapshot is enough.
