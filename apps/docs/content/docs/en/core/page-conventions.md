---
title: Page conventions
description: Map files, route groups, frontmatter, and metadata files to stable documentation routes.
---

# Page conventions

Foldocs discovers Markdown and MDX from the configured content directory and
turns every accepted file into a typed manifest entry. Routing remains a build
concern: the generated application receives canonical URLs instead of reading
the filesystem in the browser.

## Pages and slugs

| Source path                         | Default slug             |
| ----------------------------------- | ------------------------ |
| `en/index.mdx`                      | `/en/docs`               |
| `en/guides/index.md`                | `/en/docs/guides`        |
| `en/guides/deploy.md`               | `/en/docs/guides/deploy` |
| `en/(get-started)/installation.mdx` | `/en/docs/installation`  |

An `index` file owns its directory route. Parenthesized route groups organize
content without contributing a URL segment.

## Page metadata

Frontmatter controls the page tree and generated metadata:

```yaml
---
title: Deploy to production
description: Publish a static Foldocs site.
label: Deployment
icon: cloud-upload
order: 4
keywords:
  - hosting
  - static output
---
```

`draft` and `hidden` pages are excluded from visible navigation. Set `index:
true` when a page should become its parent folder's clickable row.

## Folder metadata

Place `meta.json` inside a directory to configure the folder:

```json
{
  "title": "Manual installation",
  "description": "Add Foldocs to an existing application",
  "icon": "wrench",
  "defaultOpen": false,
  "pages": ["index", "pnpm", "npm", "bun"]
}
```

Use `---Label---` entries for static section headings and `...` to include
unlisted files. Set `root: true` to turn the folder into an isolated
documentation root in the sidebar selector.

## Locales

The directory parser reads `content/docs/<locale>`. The dot parser instead uses
suffixes such as `guide.es.md`. Both produce the same translation keys, alternate
links, search records, and static output.

## Validation

The Vite plugin rejects duplicate URLs, unsafe adapter paths, invalid
frontmatter, and pages that fail compilation. `foldocs check` additionally
validates local links and heading fragments.
