---
title: Ask AI
description: Add a provider-neutral embedded documentation assistant without exposing secrets.
---

# Ask AI

Enable the built-in assistant button with one serializable option:

```ts
export default defineConfig({
  ai: { endpoint: '/api/ai' },
})
```

Generated entry points create the browser client automatically. Fully static
sites can leave `ai` disabled and continue using the Open menu links for ChatGPT,
Claude, Scira AI, Cursor, and Grok.

## Server handler

Keep the API key in a serverless function, Worker, or application server:

```ts
import { createAiHandler, openAiCompatible } from '@foldocs/ai'

export default createAiHandler({
  provider: openAiCompatible({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'your-model',
  }),
})
```

The same OpenAI-compatible adapter works with Groq, OpenRouter, and self-hosted
compatible endpoints through `baseUrl`.

## Documentation context

Requests contain conversation messages, locale, pathname, and the current page's
title, description, canonical URL, and extracted plain text. Use the optional
`enrich` hook to add local search or vector-retrieved sources before calling the
provider. Responses can include source links that render beneath the answer.

## Security

Never configure provider credentials in the browser client. Apply normal rate
limits, authentication, abuse controls, and request-size limits at the endpoint.
