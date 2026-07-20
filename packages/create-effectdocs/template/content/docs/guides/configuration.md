---
title: Configuration
description: Customize your Effectdocs site from one typed config file.
order: 3
---

# Configuration

Edit `effectdocs.config.ts` to change the site identity and content paths.

## Site metadata

Set `site.baseUrl` to the production origin so canonical URLs and the generated
`sitemap.xml` are correct.

## AI-readable output

Effectdocs emits both `llms.txt`, a compact page index, and `llms-full.txt`, a
complete Markdown corpus. Set `llms: false` only if you do not want these assets.

## Frontmatter

Use `order`, `label`, `hidden`, `draft`, `tags`, and `keywords` to control page
metadata without maintaining a separate sidebar file.
