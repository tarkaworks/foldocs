---
title: Search indexing
description: Keep local and hosted indexes synchronized with the same build snapshot.
---

# Search indexing

## Search documents

Every heading becomes a structured search document with a stable page id,
section id, hash URL, page title, section title, navigation breadcrumbs, locale,
tags, and linearized section text. Pages without headings receive one page-level
record. The compiler derives all records from the same typed manifest used by
routing and navigation.

## Local and hosted indexes

Local search consumes emitted JSON snapshots. Hosted index writers consume the
same files through `@foldocs/search/sync`, making provider migrations independent
from content compilation.

## Synchronize safely

Run synchronization in CI after the production build. Use replacement semantics
or an equivalent atomic strategy so removed pages do not remain searchable.
