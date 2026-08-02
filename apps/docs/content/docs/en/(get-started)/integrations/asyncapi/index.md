---
title: AsyncAPI
description: Turn channels, messages, and operations into browsable event documentation.
index: true
---

# AsyncAPI

`@foldocs/asyncapi` parses an AsyncAPI contract and emits deterministic pages for
channels, messages, and operations. The output is plain Markdown or MDX, so it
works with search, locale routing, `.md` endpoints, and static prerendering.

## Install

```bash
pnpm add -D @foldocs/asyncapi
```

## What is generated

The generator creates an overview and one page per documented operation. Titles,
descriptions, tags, payload examples, and channel metadata are normalized before
writing files so repeated generation produces reviewable diffs.

## Validate the contract

Treat schema parsing failures as build failures. Generate into a dedicated
directory and run `foldocs check` afterward to catch broken links or route
collisions with handwritten pages.
