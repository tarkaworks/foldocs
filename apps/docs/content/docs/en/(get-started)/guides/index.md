---
title: Guides
description: Practical recipes for adapting Foldocs to a production application.
icon: book
index: true
---

# Guides

These guides cover changes that cross content, styling, build output, and the
Foldkit runtime. Complete the Quick Start first so the generated app
and content pipeline are available.

## Choose a guide

- **Customize the UI** for brand tokens, project-owned renderers, and layouts.
- **Static output** for deployment and route verification.
- **Access control** for placing authentication in front of static docs.
- **Export an EPUB** for an offline release artifact from the same page AST.
- **Export PDF documents** with the print-ready generated-site script.
- **Publish an RSS feed** directly from the localized page manifest.
- **Import an Obsidian vault** for authoring with wiki links and embeds.
- **Build with remote content** for CMS and repository-backed documentation.

Treat copied customization files as application code: keep them reviewed,
tested, and synchronized with framework upgrades intentionally.

## Apply changes safely

Start with configuration and theme tokens. Generate owned source only when the
desired behavior cannot be expressed through public options and classes.

## Verify the result

Every guide ends at the same production boundary: validate content, build the
static site, and test a direct nested-route request against the preview server.
