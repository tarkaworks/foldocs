---
title: Frontmatter
description: Define page metadata once and reuse it across navigation, SEO, and search.
---

# Frontmatter

Frontmatter is parsed by Foldocs before the Markdown body enters the official
Foldkit parser. Source lines are preserved so compiler errors still point at the
correct location.

| Field              | Effect                                                 |
| ------------------ | ------------------------------------------------------ |
| `title`            | Page heading, browser title, and default sidebar label |
| `description`      | Search summary and description metadata                |
| `label`            | Optional shorter sidebar text                          |
| `icon`             | Built-in Lucide name or configured SVG name            |
| `order`            | Numeric fallback ordering                              |
| `index`            | Link this page from its folder row                     |
| `draft`            | Development-only page                                  |
| `hidden`           | Routable page excluded from navigation                 |
| `keywords`, `tags` | Discovery metadata                                     |
| `socialImage`      | Page-specific Open Graph image                         |

Unknown fields are rejected instead of being silently discarded.
