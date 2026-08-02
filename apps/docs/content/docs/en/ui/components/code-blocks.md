---
title: Code blocks
description: Render highlighted code with metadata, line numbers, and a stable copy action.
---

# Code blocks

Fenced code is highlighted during compilation and emitted as static HTML. The
copy button changes only its icon after success, preventing text-driven layout
shift.

## Language and metadata

````md
```ts title="foldocs.config.ts" {2}
export default defineConfig({
  layout: { preset: 'docs' },
})
```
````

The language selects a Shiki grammar. Metadata can describe a title, emphasized
lines, or Twoslash behavior when the compiler highlighter is configured.

## Accessibility

Keep the original source as text in the DOM. Highlighting spans are decorative,
and the copy button retains an accessible name after its visual icon changes.
