---
title: Table of contents
description: Use compiled heading data with active-anchor observation and accessible navigation.
---

# Table of contents

Every compiled page contains a serializable `toc` array:

```ts
type TocItem = {
  readonly id: string
  readonly title: string
  readonly depth: number
}
```

The same data powers the desktop sidebar, mobile disclosure, and `InlineTOC`
MDX component.

## Active headings

The Foldocs runtime observes rendered heading elements and updates
`activeTocId`. `docsLayout` marks the matching link as active and keeps fragment
navigation inside the application program.

## Selecting an item

`DocsLayoutActions.selectToc(id)` is the only action a custom layout needs. The
runtime updates the URL fragment, scrolls the matching heading into view, and
preserves keyboard focus behavior without a document reload.

## Authoring rules

The compiler creates GitHub-compatible unique IDs, including suffixes for
duplicate headings. Use heading levels in order and rely on `page.toc` instead
of parsing rendered HTML.
