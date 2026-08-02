---
title: Performance
description: Keep compilation deterministic, page modules lazy, and browser bundles small.
icon: rocket
---

# Performance

Foldocs performs expensive content work during the Vite build and keeps the
browser runtime focused on navigation and interaction.

## Build-time work

Parsing, schema validation, heading extraction, syntax highlighting, Markdown
serialization, search document generation, and prerendering happen before
deployment.

## Lazy pages

The manifest stores serializable page metadata eagerly. Compiled page modules are
loaded only for the active route, so adding documentation does not place the full
corpus in the initial JavaScript bundle.

## Search loading

Local search indexes are emitted per locale and fetched on the first search. A
reader who never opens search does not download the corpus.

## Measure production output

Track the main application chunk, the largest page chunk, locale index size, and
prerender duration. A content increase should primarily affect static assets, not
the initial runtime.
