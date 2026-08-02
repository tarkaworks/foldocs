---
title: Components and islands
description: Add deterministic components and stateful Foldkit Markdown islands.
icon: blocks
---

# Components and islands

Foldocs supports two complementary extension points.

## Deterministic components

MDX component nodes are compiled into the portable AST. Register an inline or
block renderer through `MdxComponents` to control their HTML output.

## Typed islands

Official `@foldkit/markdown` islands validate directive names and attributes at
compile time and attach Foldkit views at render time. Use islands when a content
feature owns state or messages.

## Authoring boundary

Keep data in literal attributes and content in Markdown. Avoid arbitrary module
execution in documentation files so search, prerendering, `.md` routes, and LLM
corpora all see the same document.
