---
title: Mixedbread
description: Add semantic hosted search through the Foldocs provider interface.
---

# Mixedbread

`@foldocs/search-mixedbread` provides semantic search and ingestion adapters while
keeping provider-specific types outside the Foldkit application.

## APIs

- `createMixedbreadSearchClient` maps hosted results to `SearchResult`.
- `createMixedbreadSearchIndexer` prepares documentation records.
- `syncMixedbreadSearch` synchronizes a complete source corpus.

## Chunking

Start with one record per heading section. Preserve the page URL and heading ID so
every result opens at the source paragraph rather than only at the page root.

## Observability

Record the indexed revision, document count, rejected records, and synchronization
duration. Search should remain debuggable even though ingestion is external.
