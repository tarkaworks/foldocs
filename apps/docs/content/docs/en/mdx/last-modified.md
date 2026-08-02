---
title: Last modified
description: Attach Git, filesystem, or provider timestamps to compiled page metadata.
---

# Last modified

Foldocs calculates a stable `lastModified` value while building the page
manifest. No separate MDX plugin is required.

## Git timestamps

```ts
export default defineConfig({
  content: {
    lastModified: 'git',
  },
})
```

Git is the default. Foldocs reads the most recent commit timestamp for each local
file and falls back to the filesystem timestamp for new or untracked content.

## Filesystem timestamps

Use `lastModified: 'filesystem'` when Git history is unavailable, or `false` to
disable local timestamp derivation.

## Remote timestamps

Adapters can provide an ISO-8601 `lastModified` value on each `ContentFile`. The
value joins the same `PageMetadata` field used by local content.

## Consumers

The docs layout formats the timestamp for the active locale. RSS feeds and other
static artifacts reuse it, so visible metadata and publishing output stay
consistent.
