---
title: Export PDF
description: Export print-ready documentation pages with the generated Playwright script.
tags:
  - deployment
  - PDF
---

# Export PDF

Every generated Foldocs application includes print styles and a Playwright-based
PDF script. The export runs against the built site, so it captures the same
prerendered content that is deployed.

## Build and preview

```bash
pnpm build
pnpm preview
```

The script uses `http://localhost:4173` by default. Set
`FOLDOCS_PDF_BASE_URL` when the preview uses another origin.

## Install Chromium

Install the browser once for the current Playwright version:

```bash
pnpm exec playwright install chromium
```

## Export the sitemap

With the preview server running, export every route listed in `sitemap.xml`:

```bash
pnpm docs:pdf
```

Files are written to `pdfs/`. Change the destination with
`FOLDOCS_PDF_OUTPUT=artifacts/docs`.

## Export selected routes

Pass paths after the command to avoid exporting the entire site:

```bash
pnpm docs:pdf /en/docs /en/docs/deploying /en/docs/guides
```

## Print behavior

The default stylesheet hides the header, sidebars, page actions, pager, footer,
feedback controls, and search overlay. Tabs and accordion panels are expanded so
their content is present in the PDF.

## Continuous integration

Run PDF export after the static build and upload `pdfs/` as an artifact. Keep the
preview process private to the CI job; no public deployment is required.
