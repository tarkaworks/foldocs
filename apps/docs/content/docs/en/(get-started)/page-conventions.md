---
title: Page conventions
description: Control routes, metadata, ordering, drafts, and folder index pages.
---

# Page conventions

Every `.md` or `.mdx` file under a locale directory becomes a documentation
page. A file named `index.md` maps to its directory route; parenthesized folders
group source files without adding URL segments.

## Frontmatter

`title` is required unless the compiler can infer it from the first heading.
Use `description`, `label`, `icon`, `order`, `tags`, `keywords`, `draft`,
`hidden`, and `socialImage` to control metadata and discovery.

Conventional folder `index.md` files become folder links automatically. Use
`pagesIndex` when another page or external link should represent the folder.

## Ordering

Place a `meta.json` beside pages when alphabetical and frontmatter ordering are
not enough. Separator strings create static groups, while folder names create
sections.

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

## Complete page syntax

- `...` inserts every remaining page; `z...a` inserts them in reverse order.
- `!legacy` excludes a page.
- `...guides` extracts a folder's index and children into the current level.
- `./guides/start` addresses a nested page.
- `---[sparkles]Introduction---` adds an icon to a separator.
- `[Status](https://status.example.com)` adds a link.
- `[github][Source](https://github.com/acme/docs)` adds an icon and link.
- Prefix a link with `external:` to always open it externally.

Set `collapsible: false` to render a normal section without disclosure behavior,
or `defaultOpen: false` for a collapsed disclosure. `root: true` turns a folder
into a documentation selector tab.

## Folder index pages

Use `pagesIndex: "overview"` in `meta.json` to select a custom page. Folder rows
remain linked while disclosure behavior applies only to their children.
