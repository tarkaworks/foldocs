---
title: Notion
description: Import a Notion data source through the official client at build time.
order: 7
tags:
  - CMS
  - Notion
---

# Notion

The built-in `notion` adapter queries the current Notion data-source API and
turns pages and nested blocks into deterministic MDX. The Notion SDK remains a
build-time dependency of your application.

## Configure the adapter

```ts
import { defineConfig, notion } from 'foldocs'

import { Client } from '@notionhq/client'

const client = new Client({ auth: process.env.NOTION_TOKEN })

export default defineConfig({
  site: { title: 'Product docs' },
  content: {
    sources: [
      notion({
        client,
        dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
        properties: {
          title: 'Name',
          slug: 'Slug',
          description: 'Description',
          tags: 'Tags',
          locale: 'Locale',
        },
      }),
    ],
  },
})
```

## Supported blocks

Paragraphs, headings, lists, tasks, quotes, callouts, code, equations, images,
bookmarks, dividers, toggles, and recursively nested children are converted.
`last_edited_time` becomes the page's last-updated and RSS timestamp.

## Production notes

Run the adapter during the static build, keep the integration token in the
deployment provider's secret store, and prefer durable public image URLs.
Notion's temporary file URLs can expire after the build.
