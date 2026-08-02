---
title: Twoslash
description: Add compiler-aware TypeScript information to highlighted code blocks.
---

# Twoslash

`@foldocs/twoslash` creates a `CodeHighlighter` that enriches TypeScript examples
with compiler diagnostics and hover information.

## Configure the highlighter

```ts
import { createTwoslashHighlighter } from '@foldocs/twoslash'

const highlightCode = createTwoslashHighlighter({
  compilerOptions: { strict: true },
})
```

Pass the highlighter to the MDX compiler or Vite integration. Ordinary languages
continue through Shiki.

```ts twoslash
const locales = ['en', 'es'] as const
type Locale = (typeof locales)[number]

const activeLocale: Locale = 'en'
activeLocale
```

## Keep examples reproducible

Pin TypeScript and dependency versions, include only the declaration files the
example needs, and treat unexpected diagnostics as build failures. Compiler-aware
examples should change in the same review as the API they document.
