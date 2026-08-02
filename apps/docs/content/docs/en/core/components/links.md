---
title: Links
description: Render internal routes, external destinations, and heading fragments safely.
---

# Links

The Markdown view distinguishes documentation routes from external URLs.
Internal links use the Foldocs navigation action so the current manifest entry,
sidebar, pager, and table of contents update together.

## External destinations

Absolute HTTP and protocol-relative URLs render with safe external-link
attributes. The Open menu and social links use the same browser action rather
than executing navigation during view construction.

## Heading fragments

Links such as `[Configuration](#configuration)` target the stable IDs generated
by the compiler. `foldocs check` validates fragments against the compiled table
of contents before deployment.

## Custom Markdown views

Pass component renderers through `MarkdownViewOptions` when an MDX island needs
application-specific link behavior. Plain Markdown links remain handled by
`renderMarkdown`.
