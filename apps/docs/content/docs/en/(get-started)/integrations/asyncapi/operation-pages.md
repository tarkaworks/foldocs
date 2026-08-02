---
title: Operation pages
description: Understand the static event-reference pages generated from AsyncAPI operations.
---

# AsyncAPI operation pages

Each publish or subscribe operation becomes a deterministic documentation page.
The output uses the normal Foldocs content pipeline instead of mounting a
separate client-side reference application.

## Operation identity

Explicit operation identifiers produce stable filenames. When an identifier is
missing, the generator derives one from the action and channel and resolves
duplicates deterministically.

## Channel information

Generated pages show the operation action, channel address, description, and
tags available in the document.

## Messages and payloads

Message names, descriptions, headers, payload schema fields, inferred examples,
and protocol bindings are normalized into headings, tables, and code blocks.
Local component references are resolved before rendering.

## AsyncAPI versions

AsyncAPI 3 operations and AsyncAPI 2 `publish` or `subscribe` channel entries are
both supported and produce the same page shape.

## Static behavior

Generated operation pages work with local search, locale routing, Markdown
content negotiation, LLM output, navigation metadata, and static prerendering
without shipping the AsyncAPI parser to readers.
