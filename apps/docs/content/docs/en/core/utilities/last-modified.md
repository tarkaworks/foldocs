---
title: Last modified
description: Derive page timestamps from Git, the filesystem, or remote source metadata.
---

# Last modified

Configure how local pages receive `PageMetadata.lastModified`:

```ts
export default defineConfig({
  content: {
    lastModified: 'git',
  },
})
```

`git` uses the most recent commit timestamp for each file. Filesystem mode uses
the file modification time, and `false` disables derivation. Remote adapters can
provide an ISO timestamp on each `ContentFile`.

The default layout formats this value for the current locale. RSS and other
static outputs reuse the same timestamp.
