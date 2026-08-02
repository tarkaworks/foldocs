---
title: Navigation model
description: Build deterministic page trees, folder indexes, and documentation roots.
icon: book-open
---

# Navigation model

`buildNavigation` combines page metadata with directory `meta.json` records.
The result distinguishes pages, folders, and static separators with tagged
types.

## Folder metadata

```json
{
  "title": "Manual installation",
  "icon": "settings",
  "defaultOpen": false,
  "pages": ["index", "pnpm", "npm"]
}
```

An `index.md` with `index: true` becomes the folder link and is removed from its
child list. Flattening still includes it before the children, so search and
pagination retain the intended reading order.

## Root folders

Set `root: true` to isolate a package or version. `navigationForUrl` returns the
active root tree, while `navigationTabsForUrl` produces selector entries for all
available roots.

## Exact active state

Pages match exact normalized URLs. Folder disclosure state is independent from
page activity, preventing a parent folder from appearing selected when one of
its children is current.
