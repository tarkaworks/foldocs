---
title: Search contract
description: Use provider-neutral clients, indexers, documents, and errors.
icon: search
---

# Search contract

`@foldocs/search` keeps search behavior independent of UI and provider SDKs.

## Browser contract

`SearchClient.search` accepts a query and options and returns an Effect containing
normalized `SearchResult` values. Provider failures use `SearchError`, allowing
the layout to render one consistent error state.

## Build contract

`SearchIndexer` accepts generated `SearchDocument` records. Use
`createSearchIndexer` for an Effect-based implementation and
`syncSearchDocuments` for deterministic synchronization.

## Documents

Each document contains its canonical URL, title, description, body, locale, and
optional structured metadata. Generate documents from the final merged page
manifest so local and remote content remain searchable together.

## Excerpts

The `excerpt` helper creates a bounded text fragment around a match when a
provider does not return one.

## Provider guides

- [Orama local search](/en/docs/search/orama)
- [FlexSearch local search](/en/docs/search/flexsearch)
- [Algolia](/en/docs/search/algolia)
- [Typesense](/en/docs/search/typesense)
- [Orama Cloud](/en/docs/search/orama-cloud)
- [Trieve](/en/docs/search/trieve)
- [Mixedbread](/en/docs/search/mixedbread)
- [Custom providers](/en/docs/search/custom)

Provider packages implement the same `SearchClient` and optional indexing
contracts, so switching providers does not change the layout.
