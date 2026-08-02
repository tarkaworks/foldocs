---
title: Access control
description: Protect private documentation without moving authorization into page content.
---

# Access control

Foldocs emits static files, so access control belongs at the hosting edge. Put
Cloudflare Access, an authenticated reverse proxy, or an equivalent platform
policy in front of every HTML, Markdown, search-index, asset, and LLM route.

## Protect the complete corpus

Blocking only page HTML is insufficient. Search indexes and `llms-full.txt`
contain page text, while sibling `.md` routes expose individual documents.
Configure one policy for the whole deployment origin.

:::Aside{type="warning"}
Never embed provider administration keys or private CMS credentials in the
browser bundle. Remote content adapters run during builds; hosted search writers
belong in CI or a trusted server process.
:::
