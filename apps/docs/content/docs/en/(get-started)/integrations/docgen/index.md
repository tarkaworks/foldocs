---
title: Language references
description: Generate API reference pages from TypeScript declarations and Python modules.
index: true
---

# Language references

Foldocs includes focused generators for TypeScript and Python. Each generator
extracts public declarations and writes ordinary documentation files instead of
introducing a second rendering system.

## Available generators

- `@foldocs/typescript` documents exported types, interfaces, functions, and
  compile options from TypeScript sources.
- `@foldocs/python` documents public modules, classes, functions, and signatures.

## Generation workflow

Generate into a dedicated reference directory, review the result, and run
`foldocs check`. Use stable source paths and avoid mixing handwritten files into
the generated directory so stale files can be removed safely.

## Custom prose

Keep conceptual guidance in handwritten pages and link to generated API pages.
Reference generation is best at exact signatures; it should not replace examples,
architecture decisions, or migration guidance.
