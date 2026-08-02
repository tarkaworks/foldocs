---
title: Trieve
description: Connect Foldocs search and ingestion to a Trieve dataset.
icon: search
---

# Trieve

`@foldocs/search-trieve` adapts a Trieve dataset to the common Foldocs search
contracts.

## APIs

- `createTrieveSearchClient` maps Trieve hits into Foldocs results.
- `createTrieveSearchIndexer` prepares build output for ingestion.
- `syncTrieveSearch` synchronizes the complete documentation corpus.

## Dataset design

Keep product documentation in a dedicated dataset and store canonical URL,
locale, section, and release as metadata. That prevents results from unrelated
content products entering the docs search dialog.

## Failure policy

Fail the indexing job on partial ingestion and retain the last known-good dataset
until the matching site deployment succeeds.
