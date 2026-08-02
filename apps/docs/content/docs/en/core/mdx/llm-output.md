---
title: LLM output
description: Generate canonical Markdown routes and aggregate indexes from compiled content.
---

# LLM output

Every documentation page can ship a sibling `.md` asset generated from the
compiled document model. The output removes frontmatter and duplicate page
titles while preserving authored code fences, links, lists, and component
fallbacks.

## Routes

- `/en/docs/configuration.md` returns one page as Markdown.
- `/llms.txt` provides a compact documentation index.
- `/llms-full.txt` provides the complete corpus when enabled.

Clients can also request the canonical page URL with a Markdown-preferred
`Accept` header. Static hosts remain supported because explicit `.md` files are
emitted during the build.

## Custom components

Known components serialize to useful Markdown representations. Application
islands should provide readable child content so the LLM output remains useful
without the interactive view.
