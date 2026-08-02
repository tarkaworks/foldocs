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
