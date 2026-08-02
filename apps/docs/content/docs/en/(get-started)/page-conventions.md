---
title: Page conventions
description: Control routes, metadata, ordering, drafts, and folder index pages.
icon: file-text
---

# Page conventions

Every `.md` or `.mdx` file under a locale directory becomes a documentation
page. A file named `index.md` maps to its directory route; parenthesized folders
group source files without adding URL segments.

## Frontmatter

`title` is required unless the compiler can infer it from the first heading.
Use `description`, `label`, `icon`, `order`, `tags`, `keywords`, `draft`,
`hidden`, and `socialImage` to control metadata and discovery.

Set `index: true` on a folder's `index.md` to link the collapsible folder row to
that page. Its remaining files render as children beneath the Disclosure.

## Ordering

Place a `meta.json` beside pages when alphabetical and frontmatter ordering are
not enough. Separator strings create static groups, while folder names create
collapsible sections.

```json
{
  "pages": [
    "---Introduction---",
    "index",
    "manual-installation",
    "---Writing---",
    "page-conventions",
    "markdown"
  ]
}
```
