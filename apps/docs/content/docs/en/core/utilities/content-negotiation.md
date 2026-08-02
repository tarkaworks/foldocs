---
title: Content negotiation
description: Serve canonical HTML and Markdown representations from static output.
---

# Content negotiation

Foldocs always emits explicit `.md` assets, which work on static hosts without
request middleware. Development and compatible runtimes can additionally inspect
the `Accept` header with `isMarkdownPreferred` from `@foldocs/vite`.

```ts
import { isMarkdownPreferred } from '@foldocs/vite'

isMarkdownPreferred('text/markdown, text/html;q=0.8')
// true
```

`pageUrlFromMarkdownPath` resolves an explicit Markdown asset to its canonical
page URL, while `markdownAssetPath` performs the inverse mapping.

## Static hosts

Prefer linking LLM clients to `.md`, `/llms.txt`, or `/llms-full.txt`. Header
negotiation is an enhancement and is not required for Vercel, Cloudflare, or any
other static deployment target.
