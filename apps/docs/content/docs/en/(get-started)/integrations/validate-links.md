---
title: Validate links
description: Catch broken local links, duplicate routes, and invalid pages in CI.
icon: check
---

# Validate links

The Foldocs CLI compiles every page and validates local navigation before the
production build.

```bash
pnpm foldocs check . --content content/docs --base-path /docs --locales en,es --fallback-locale en
```

## What is checked

- Markdown and MDX compilation errors
- duplicate routes
- links to missing pages
- heading fragments that do not exist
- missing locale pages that require fallback

## CI policy

Run validation before Vite. A warning can describe a locale fallback, but broken
routes and invalid content should fail the workflow. Test a deep prerendered URL
after the build to verify the hosting rewrite configuration too.
