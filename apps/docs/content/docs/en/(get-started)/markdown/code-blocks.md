---
title: Code blocks
description: Highlight source at build time and add optional compiler information.
---

# Code blocks

Fenced code is highlighted during compilation with Shiki. The browser receives
finished markup, line-number metadata, and copy controls without loading a syntax
highlighter.

````md
```ts
const program = Effect.succeed('ready')
```
````

## Twoslash

Add `@foldocs/twoslash` to enable compiler-powered information for explicitly
marked TypeScript blocks. Keep ordinary code blocks on the faster Shiki path and
use Twoslash where hover types materially help readers.

If highlighting fails for an unknown grammar, Foldocs falls back to an escaped
plain code block rather than failing the entire document build.

## Copy behavior

The copy button always uses the original source, not highlighted HTML. Its label
stays stable while only the icon and accessible status change after copying.

## Build performance

Use ordinary Shiki for most blocks and reserve compiler-powered transforms for
examples where type information improves understanding.
