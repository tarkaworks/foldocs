---
title: Local Markdown
description: Use the zero-configuration content source built into Foldocs.
---

# Local Markdown

Local `.md` and `.mdx` files are the default content source. Place them under
`content/docs/<locale>` and let filenames, folders, and `meta.json` determine
routes and navigation.

## Directory contract

```text
content/docs/en/
├── index.mdx
├── meta.json
└── guides/
    ├── index.md
    └── meta.json
```

Use `index.md` for a folder landing page. Parenthesized folders organize source
without adding a URL segment, which is useful for package roots and large docs.

## Build behavior

The Vite plugin watches local content in development. Production builds compile
the same files, emit static HTML, generate `.md` routes, and include pages in the
locale search index.

## When to use it

Prefer local files when documentation changes should be reviewed with code. Move
to an adapter only when another system is the source of truth.
