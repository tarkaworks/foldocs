---
title: Navigation views
description: Render pages, folders, root selectors, and page context consistently.
---

# Navigation views

The UI consumes the typed tree produced by `foldocs-core`. Static separators,
page links, collapsible folders, and documentation roots remain distinct rather
than being inferred from presentation styles.

## Sidebar rhythm

Rows use a single two-pixel parent gap. Page and folder rows do not add their
own vertical margins, so adjacent items never double the intended spacing.
Nested content keeps the same clickable width while its label is indented.

## Linked folders

Set `index: true` on a folder's `index.md` to render a linked folder label with
a separate disclosure control. The folder page remains navigable while child
pages can be expanded or collapsed independently.

## Documentation roots

Folders with `root: true` appear in the package selector. Only the active root's
sidebar tree and pager sequence are displayed.
