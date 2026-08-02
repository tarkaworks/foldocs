---
title: Code highlighting
description: Configure Shiki or a compiler-aware highlighter without changing the AST.
icon: sparkles
---

# Code highlighting

The default compiler can render code with Shiki. A custom `highlightCode`
function can return trusted highlighted HTML for each block while preserving the
original value, language, metadata, and source path.

```ts
const highlightCode = async ({ value, language }) => {
  if (language !== 'ts') return undefined
  return highlightTypeScript(value)
}
```

Returning `undefined` falls back to the standard highlighter. The original code
always remains available for copy controls, Markdown output, search, and tests.

## Twoslash

Use `@foldocs/twoslash` for compiler-powered TypeScript hover information. Keep
it opt-in for explicit blocks so ordinary snippets stay fast to build.

## Trusted markup

Highlighters run during compilation. Their HTML is stored separately from the
original source, which remains the value used by copy controls and serializers.

## Failure fallback

Unknown grammars and highlighter errors fall back to escaped plain code rather
than preventing the rest of the documentation corpus from building.
