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
const program = Effect.succeed("ready");
```
````

## Twoslash

Add `@foldocs/twoslash` to enable compiler-powered information for explicitly
marked TypeScript blocks. Keep ordinary code blocks on the faster Shiki path and
use Twoslash where hover types materially help readers.

If highlighting fails for an unknown grammar, Foldocs falls back to an escaped
plain code block rather than failing the entire document build.
