---
title: Navigation
description: Build sidebars, root tabs, route groups, page context, and pagination.
---

# Navigation

Foldocs derives a typed navigation tree from page metadata and directory
`meta.json` files. The same tree powers the desktop sidebar, mobile navigation,
breadcrumbs, previous and next links, and documentation root switcher.

## Static groups and folders

Entries such as `---Writing---` are non-collapsible section labels. A directory
entry is a collapsible folder and can define `title`, `description`, `icon`,
`pages`, and `defaultOpen` in its own `meta.json`.

## Documentation roots

Set `root: true` on a folder to make it an isolated documentation area. Roots
appear in the switcher above the sidebar and keep their own navigation and pager
scope. This is useful for product docs, API references, or versioned manuals.

## Active items

Page activity uses exact URLs. A folder remains a neutral disclosure while one
of its children is active; the child receives the primary foreground,
background, icon color, and nested guide segment.
