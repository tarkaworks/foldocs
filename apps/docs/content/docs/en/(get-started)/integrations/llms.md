---
title: LLM output
description: Publish agent-readable page Markdown and complete documentation corpora.
---

# LLM output

Every page has a sibling `.md` URL and supports Markdown content negotiation.
The page toolbar provides Copy Markdown, View as Markdown, and shortcuts for
opening the canonical page in supported assistants.

Builds also emit `llms.txt`, a compact linked index, and `llms-full.txt`, a
complete corpus. Localized projects receive per-locale versions that respect
fallback pages and canonical URLs.

Disable `markdown` or `llms` only when policy requires it. If documentation is
private, protect these routes with the same access controls as page HTML and
search indexes.
