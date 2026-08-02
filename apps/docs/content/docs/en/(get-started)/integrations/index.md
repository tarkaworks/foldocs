---
title: Integrations
description: Generate and import documentation without coupling provider SDKs to the browser.
index: true
---

# Integrations

## Build-time boundaries

Foldocs integrations are build-time boundaries. They produce ordinary Markdown,
deterministic MDX, assets, or validated content files that enter the same compiler
as local documentation.

## Browser bundle

This keeps OpenAPI parsers, CMS clients, language compilers, and provider
credentials out of the browser bundle. Generated pages automatically participate
in navigation, locale fallback, search, Markdown output, LLM files, the sitemap,
and prerendering.

## Available integrations

- [Content sources](/en/docs/integrations/content) cover local files, remote MDX,
  Sanity, BaseHub, and Obsidian.
- [OpenAPI](/en/docs/integrations/openapi) and
  [AsyncAPI](/en/docs/integrations/asyncapi) generate contract references.
- [Language references](/en/docs/integrations/docgen) generate TypeScript and
  Python API pages.
- [Feedback](/en/docs/integrations/feedback) posts page ratings to your own
  endpoint without prescribing an analytics provider.
- [Social images](/en/docs/integrations/social-images) generate static Open
  Graph images and metadata for every route.
- [LLM output](/en/docs/integrations/llms) emits page Markdown and corpus files.
- [Link validation](/en/docs/integrations/validate-links) checks the merged
  content graph before deployment.
