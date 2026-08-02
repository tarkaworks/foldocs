---
title: GitHub Flavored Markdown
description: Use tables, task lists, strikethrough, and autolinks in portable pages.
---

# GitHub Flavored Markdown

Foldocs supports the portable GitHub Flavored Markdown constructs used in
technical documentation.

## Tables

```md
| Package       | Purpose             |
| ------------- | ------------------- |
| `foldocs`     | Application runtime |
| `foldocs-mdx` | Content compiler    |
```

## Task lists

Task markers are preserved as semantic list state even though standard `.md`
files are validated through official `@foldkit/markdown`.

```md
- [x] Configure content
- [ ] Deploy the preview
```

## Portability

Prefer GFM when content must remain useful on GitHub, in `.md` endpoints, and in
LLM exports. Use MDX components only when the visual structure adds real value.
