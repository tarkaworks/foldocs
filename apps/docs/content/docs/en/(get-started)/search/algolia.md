---
title: Algolia
description: Synchronize Foldocs documents to Algolia and query them in the browser.
icon: search
---

# Algolia

`@foldocs/search-algolia` separates browser search from privileged indexing.

## APIs

- `createAlgoliaSearchClient` adapts an Algolia search-only client.
- `createAlgoliaSearchIndexer` prepares records for an index.
- `syncAlgoliaSearch` replaces the indexed Foldocs corpus deterministically.

## Record identity

Use the canonical page URL as the stable object identifier. Keep locale and
section metadata as filterable attributes so results can stay inside the active
documentation root.

## Security

Ship only a search-only key to the browser. The admin key belongs in the CI
environment and should be restricted to the documentation index.
