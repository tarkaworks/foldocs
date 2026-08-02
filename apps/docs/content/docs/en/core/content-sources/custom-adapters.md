---
title: Custom adapters
description: Supply virtual Markdown or MDX files from a service, database, or generator.
---

# Custom adapters

A custom source implements the small `ContentAdapter` contract from
`@foldocs/content`:

```ts
import { defineContentAdapter } from '@foldocs/content'

export const releases = defineContentAdapter('releases', async () => [
  {
    path: 'en/releases/1.0.md',
    source: '---\ntitle: Version 1.0\n---\n\n## Changes',
    lastModified: '2026-08-03T00:00:00.000Z',
  },
])
```

Register adapters in `content.sources`. Returned paths are virtual paths
relative to the documentation directory and pass through the same compiler as
local files.

## Stable ownership

Give every adapter a unique name and every returned file a stable path. The
build rejects duplicate paths or URLs instead of allowing source order to
silently decide which page wins.
