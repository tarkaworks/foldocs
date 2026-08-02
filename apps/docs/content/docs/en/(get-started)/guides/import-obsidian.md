---
title: Import an Obsidian vault
description: Publish selected Obsidian notes as deterministic Foldocs pages.
icon: files
---

# Import an Obsidian vault

Use `@foldocs/obsidian` when authors work in Obsidian but the published result
must remain static, reviewable, and searchable.

## Generate content

```ts
import { generateVault } from '@foldocs/obsidian'

await generateVault({
  input: './vault/public',
  output: './content/docs/en/notes',
  title: 'Knowledge base',
})
```

## Conversion rules

Wiki links become relative Markdown links, embeds become assets, block IDs are
removed, and headings receive stable fragments. The generator writes a manifest
so stale generated files can be identified on the next run.

## Publishing boundary

Export from a dedicated public vault or allowlisted directory. Never depend on a
filename convention alone to keep private notes out of a production build.
