---
title: Typesense
description: Index Foldocs pages in Typesense and query them with a scoped client.
icon: search
---

# Typesense

`@foldocs/search-typesense` includes an indexer, synchronization helper, and
browser search adapter.

## APIs

- `createTypesenseSearchIndexer` converts Foldocs documents into collection data.
- `syncTypesenseSearch` synchronizes the collection.
- `createTypesenseSearchClient` queries the collection through `SearchClient`.

## Schema

Index the URL, title, description, headings, body, locale, and documentation root.
Treat URL as the stable identity and make locale filterable.

## Keys

Generate a scoped search key for the browser. Keep collection-management keys in
CI and rotate them independently of the deployed site.
