---
title: AsyncAPI
description: Generate channel, operation, and message documentation from AsyncAPI.
---

# AsyncAPI

`@foldocs/asyncapi` supports AsyncAPI 2 channel operations and AsyncAPI 3
operations. It emits deterministic pages for messages, payload and header
schemas, examples, bindings, and navigation metadata.

```sh
foldocs-asyncapi asyncapi.yaml content/docs/en/events /en/docs/events
```

Treat generated documentation as part of the build graph. A schema change should
regenerate pages before link checks, search indexing, and prerendering run.
