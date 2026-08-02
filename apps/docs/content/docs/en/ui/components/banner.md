---
title: Banner
description: Configure a site-wide announcement above the shared navigation.
---

# Banner

Foldocs banners are configured once for the application rather than repeated
inside individual MDX pages. They appear above the shared landing and docs
navigation.

## Configuration

```ts
import { defineConfig } from 'foldocs'

export default defineConfig({
  banner: {
    id: 'v1-release',
    content: 'Version 1 is available.',
    href: '/en/docs/releases/v1',
    variant: 'rainbow',
    dismissible: true,
  },
})
```

## Properties

| Property      | Type                 | Description                                |
| ------------- | -------------------- | ------------------------------------------ |
| `content`     | `string`             | Announcement text.                         |
| `href`        | `string`             | Optional destination for the announcement. |
| `variant`     | `default \| rainbow` | Visual treatment.                          |
| `dismissible` | `boolean`            | Whether the close action is shown.         |
| `id`          | `string`             | Persistence key for dismissed state.       |

Use a stable `id` when dismissal should survive navigation and later visits.
