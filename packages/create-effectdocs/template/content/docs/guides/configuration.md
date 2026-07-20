---
title: Configuration
description: Customize your Effectdocs site from one typed config file.
order: 3
---

# Configuration

Edit `effectdocs.config.ts` to change the site identity and content paths.

## Site metadata

Set `site.baseUrl` to the production origin so canonical URLs, social image URLs,
and the generated `sitemap.xml` are correct. `description`, `keywords`, `favicon`,
`socialImage`, and `locale` provide the default document metadata without editing
`index.html`.

`logoText`, `badge`, and `tagline` customize the built-in Foldkit-style landing and
documentation shell. Add `githubUrl`, `discordUrl`, `xUrl`, or `npmUrl` to expose
the corresponding header and mobile-navigation links. With the default
`basePath: "/docs"`, Effectdocs owns `/` as the generated landing page; setting
`basePath: "/"` makes your root Markdown document the homepage instead.

## AI-readable output

Effectdocs emits both `llms.txt`, a compact page index, and `llms-full.txt`, a
complete Markdown corpus. Set `llms: false` only if you do not want these assets.

Every page is also emitted as processed Markdown by appending `.md` to its URL—for
example, `/docs/getting-started.md`. Effectdocs serves the same content when a
client requests the HTML route with `Accept: text/markdown`. Set `markdown: false`
to disable the per-page assets and page actions.

## Frontmatter

Use `order`, `label`, `hidden`, `draft`, `tags`, and `keywords` to control page
metadata.

## Sidebar structure

Add a `meta.json` file to any content directory to name the sidebar group,
choose its page order, and control whether it starts open:

```json
{
  "title": "Get started",
  "pages": ["index", "installation", "..."],
  "defaultOpen": true
}
```

Directories wrapped in parentheses are route groups. For example,
`content/docs/(get-started)/installation.mdx` is grouped under “Get started” in
the sidebar but still resolves to `/docs/installation`, following the Fumadocs
content convention.
