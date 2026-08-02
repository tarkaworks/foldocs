---
title: MDX files
description: Add deterministic component composition without evaluating arbitrary JavaScript.
icon: code-xml
---

# MDX files

`.mdx` pages use the deterministic Foldocs compiler. JSX-shaped component nodes
are recorded in the typed AST and resolved by the Foldkit renderer.

## Supported model

Literal attributes, inline components, block components, and nested Markdown are
supported. Imports, exports, spread attributes, and JavaScript expressions are
rejected because they would make indexing and static serialization ambiguous.

## Component registry

Built-in documentation components are available automatically. Add application
components through `MdxComponents` and keep every renderer deterministic.

## Error locations

Unsupported nodes report the source file and line when positional information is
available. Run `foldocs check` in CI to compile the full corpus, not only pages
visited during development.
