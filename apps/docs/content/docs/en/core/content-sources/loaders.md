---
title: Source loaders
description: Query static or runtime content through a framework-independent API.
---

# Source loaders

`foldocs-core/source` exposes the headless source API used by routers, custom
layouts, tests, and non-Vite applications.

## Static loader

```ts
import { defineStaticSource, loader } from 'foldocs-core/source'

const source = defineStaticSource(files)
const docs = loader({ source, baseUrl: '/docs' })

docs.getPage(['guides', 'installation'])
docs.getPages('en')
docs.getPageTree('en')
docs.generateParams()
```

Metadata files and pages share an in-memory storage boundary. Loader plugins can
transform storage before navigation is built or transform the completed page
tree without coupling the source to Foldkit.

## Dynamic loader

```ts
import { dynamicLoader } from 'foldocs-core/source'

const docs = dynamicLoader({ files: loadFromDatabase })
await docs.get()
docs.invalidate()
await docs.revalidate()
```

Runtime sources are cached until explicitly invalidated. A failed revalidation
does not leave a rejected promise permanently cached.

## Serializable trees

Use `serializePageTree()` when a server needs to send navigation to a client. The
result contains only serializable page metadata and navigation nodes.
