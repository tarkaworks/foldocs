---
title: Frontmatter
description: Validate author-controlled metadata with the shared Effect schema.
icon: settings
---

# Frontmatter

Every page begins with YAML frontmatter decoded by `PageFrontmatter` from
`@foldocs/content`.

```yaml
---
title: Configure search
description: Select and deploy a Foldocs search provider.
icon: search
label: Search
order: 4
keywords: [search, indexing]
tags: [framework]
---
```

## Supported fields

`title` is required. Optional fields include `description`, `icon`, `label`,
`order`, `index`, `draft`, `hidden`, `keywords`, `tags`, and `socialImage`.

## Folder index pages

Set `index: true` on an index page when it should own the linked folder row in
navigation. Child pages display the folder label as context; the index page does
not repeat its own label above the title.

## Validation

Unknown value types fail compilation with the source file. Keep application-only
data in a custom content adapter rather than weakening the shared schema.
