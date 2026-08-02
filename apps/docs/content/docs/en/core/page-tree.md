---
title: Page tree
description: Understand the typed separators, pages, folders, and root tabs used by Foldocs.
---

# Page tree

Foldocs turns filesystem pages and `meta.json` files into a typed
`ReadonlyArray<NavigationNode>`.

## Node types

- `NavigationSeparator` labels a group without creating a route.
- `NavigationPage` points to one compiled page.
- `NavigationFolder` contains children and may include an index page.

Folders marked `root` become documentation tabs in the selector above the
sidebar. Parenthesized source folders do not contribute a URL segment.

## Build and flatten

`buildNavigation` creates the tree from the page manifest and metadata map.
`flattenNavigation` produces the ordered page list used for previous and next
links.

## Active roots

`navigationForUrl` returns the tree for the active documentation root, while
`navigationTabsForUrl` describes every selectable root and its current state.
