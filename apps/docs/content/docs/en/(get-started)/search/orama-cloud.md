---
title: Orama Cloud
description: Search a hosted Orama index while keeping the Foldocs provider contract.
---

# Orama Cloud

`@foldocs/search-orama-cloud` provides a browser client and build-time indexer for
Orama Cloud.

## Integration pieces

- `createOramaCloudSearchClient` queries the hosted index from the site.
- `createOramaCloudSearchIndexer` maps Foldocs documents for ingestion.
- `syncOramaCloudSearch` performs a complete synchronization.

## Credentials

Expose only the search credential intended for browsers. Keep write credentials
in CI and scope them to the documentation index.

## Deployment order

Build the Foldocs search documents, synchronize the hosted index, then deploy the
site. Store the indexed revision so a failed deployment cannot point users at a
newer, incompatible corpus.
