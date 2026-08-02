---
title: Publishing features
description: Configure RSS, generated social images, last-updated dates, feedback, banners, and PDF export.
order: 8
tags:
  - deployment
  - metadata
---

# Publishing features

Foldocs emits production metadata and feeds during the same static build as the
documentation routes.

## Feeds and social metadata

Use [RSS feeds](/en/docs/guides/rss) when readers or release tooling need a
machine-readable stream of documentation updates. Use
[social images](/en/docs/integrations/social-images) to emit page-specific Open
Graph and Twitter preview metadata.

## Last-updated dates

Filesystem pages use their latest Git commit by default and fall back to the
file modification time. Remote adapters can provide an ISO `lastModified`
timestamp.

```ts
content: {
  lastModified: 'git', // 'filesystem' or false
}
```

## Announcement banner

```ts
banner: {
  id: 'v1-release',
  content: 'Version 1 is available.',
  href: '/docs/releases/v1',
  variant: 'rainbow',
}
```

An `id` persists dismissal in local storage.

## Page feedback

The [feedback integration](/en/docs/integrations/feedback) documents the request
contract, endpoint security, and the submitting, success, and failure states.

## PDF export

Generated projects include print styles and `pnpm docs:pdf`. Follow the
[PDF export guide](/en/docs/guides/export-pdf) for browser installation, route
selection, and automated output.
