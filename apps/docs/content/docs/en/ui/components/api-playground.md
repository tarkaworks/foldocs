---
title: API playground
description: Send generated OpenAPI examples and inspect responses inline.
---

# API playground

`@foldocs/openapi` emits this component automatically. It is also available to
hand-authored pages:

```mdx
<ApiPlayground
  id="health"
  method="GET"
  url="https://api.example.com/health"
  body=""
/>
```

The request URL and JSON body are editable before sending. The production
runtime executes the request through Effect, displays loading, error, status,
and response states, limits rendered response bodies, and respects browser
CORS. Avoid placing private credentials in MDX or browser-visible headers.

## AsyncAPI payloads

`AsyncApiPlayground` presents the generated channel, action, and example payload
with a copy action. Protocol-specific publishing remains application-owned so a
documentation page never opens an unauthenticated broker connection by default.
