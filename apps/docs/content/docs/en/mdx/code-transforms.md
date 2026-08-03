---
title: Code transforms
description: Generate synchronized JavaScript examples from TypeScript and customize highlighting.
---

# Code transforms

Add `showJs` to a TypeScript or TSX fence:

````md
```ts showJs title="client.ts"
const answer: number = 42
```
````

The Vite integration transpiles the example with TypeScript and emits persistent
TypeScript and JavaScript tabs. Both versions are highlighted by Shiki and use
the normal copy action.

## Shiki annotations

Foldocs enables line highlights, word highlights, diff lines, focus, and
error/warning notation through the official Shiki transformers. Consecutive code
fences with `tab="Label"` are grouped automatically.

## Custom highlighter

Use `highlightCode` for Twoslash or a project-specific highlighter. It receives
the source, language, metadata, and file path at build time.
