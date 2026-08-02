---
title: Search
description: Use zero-configuration local search or connect a hosted provider.
index: true
---

# Search

## Local default

The generated application uses Orama for browser-local full-text search. During
production builds Foldocs writes one `search-index.json` per locale; the browser
fetches the active index only when a search begins.

## Provider contract

Search is an Effect interface, so the documentation runtime does not depend on
a provider SDK. Replace the client without changing page discovery, navigation,
or the content model.

## Accessible dialog

The dialog uses FoldKit's accessible Dialog behavior, keyboard result navigation,
focus trapping, and focus restoration.
