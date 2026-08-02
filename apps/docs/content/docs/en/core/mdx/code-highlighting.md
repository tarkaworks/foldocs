---
title: Code highlighting
description: Highlight code with Shiki or provide an asynchronous custom highlighter.
---

# Code highlighting

Foldocs highlights fenced code during compilation with Shiki's GitHub light and
dark themes. Highlighted HTML contains accessible visual line numbers without
injecting numbers into copied source text.

## Custom highlighter

Pass `highlightCode` when another service or language engine should own the
output:

```ts
import { type CodeHighlighter, compile } from 'foldocs-mdx'

const highlightCode: CodeHighlighter = async input => {
  if (input.language !== 'custom') return undefined
  return renderCustomLanguage(input.value)
}

await compile(source, { filePath, highlightCode })
```

Returning `undefined` falls back to the built-in highlighter. Set `highlight:
false` when the consumer only needs the normalized AST.

Twoslash is provided separately by `@foldocs/twoslash` for compiler-powered
TypeScript hovers.
