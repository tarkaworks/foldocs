---
title: Obsidian
description: Convert an Obsidian vault into portable Foldocs Markdown and assets.
icon: files
---

# Obsidian

`@foldocs/obsidian` converts wiki links, embeds, block references, and vault
assets into deterministic Markdown files.

## Generate a vault

```ts
import { generateVault } from '@foldocs/obsidian'

await generateVault({
  input: './notes',
  output: './content/docs/en/notes',
  title: 'Team notes',
})
```

The generator writes a manifest, copies non-Markdown assets, and rewrites links
relative to their generated pages. Hidden vault files are ignored.

## Review before publishing

Run generation before `foldocs check`, inspect link rewrites, and exclude private
notes at the source. The converter does not decide which vault content is safe to
publish.
