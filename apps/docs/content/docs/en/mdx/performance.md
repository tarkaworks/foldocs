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

## Development server

The Vite plugin caches compiled pages and invalidates only the changed document.
The virtual manifest keeps page metadata available to navigation while each page
body remains a dynamic import. Large documentation sets therefore do not enter
the initial client graph as one eager module.

## Lazy pages

The manifest stores serializable page metadata eagerly. Compiled page modules are
loaded only for the active route, so adding documentation does not place the full
corpus in the initial JavaScript bundle.

## Search loading

Local search indexes are emitted per locale and fetched on the first search. A
reader who never opens search does not download the corpus.

## Images

Local image dimensions are extracted while compiling so the rendered document
can reserve space before an image loads. Content assets are copied to stable
static paths; no image decoder ships to the browser.

## Production builds

Production compiles the corpus once, emits route chunks and static resources,
then prerenders final HTML. The active page module is preloaded before the
Foldkit runtime adopts that HTML, avoiding a loading-state flash during initial
navigation.

## Measure production output

Track the main application chunk, the largest page chunk, locale index size, and
prerender duration. A content increase should primarily affect static assets, not
the initial runtime.
