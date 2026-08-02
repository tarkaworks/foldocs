---
title: Search providers
description: Choose between local engines and optional hosted search adapters.
---

# Search providers

Orama is the default local engine and needs no account. FlexSearch is available
as another local implementation. Optional packages integrate Algolia, Orama
Cloud, Typesense, Trieve, and Mixedbread through the shared Effect contract.

## Credential boundary

The browser should receive only search-only credentials or call a private
endpoint. Administrative keys and corpus replacement operations belong in CI or
a server process.

Choose hosted search when the corpus is too large for a browser index, analytics
or typo behavior is a product requirement, or multiple sites need a shared index.

## Local providers

[Orama](/en/docs/search/orama) and
[FlexSearch](/en/docs/search/flexsearch) keep the complete query path in the
browser and require no remote account. The locale index is fetched only when
search is opened.

## Hosted providers

[Algolia](/en/docs/search/algolia),
[Orama Cloud](/en/docs/search/orama-cloud),
[Typesense](/en/docs/search/typesense),
[Trieve](/en/docs/search/trieve), and
[Mixedbread](/en/docs/search/mixedbread) adapters implement the same Effect
interface while keeping administrative synchronization in CI. Implement a
[custom provider](/en/docs/search/custom) when an existing package does not fit
the deployment.
