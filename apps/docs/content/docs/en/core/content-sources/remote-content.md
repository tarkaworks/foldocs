---
title: Remote content
description: Fetch content at build time without leaking provider clients into the browser.
---

# Remote content

Adapters run during development and production builds, so CMS credentials and
SDKs stay outside the client bundle. They return portable `ContentFile` values
rather than provider-specific page objects.

## Included adapters

Foldocs includes packages for Notion, BaseHub, Sanity, Obsidian imports, and
remote MDX. OpenAPI, AsyncAPI, TypeScript, and Python generators can also emit
virtual documentation files.

## Revalidation model

Foldocs produces static output. A deployment rebuild, webhook, or scheduled job
refreshes remote content. The runtime does not fetch a mutable page tree after
hydration, which keeps routes and search indexes consistent.

## Failure behavior

Treat provider failures as build failures unless stale content is an explicit
part of your adapter. Avoid returning a partial corpus that would remove routes
without warning.
