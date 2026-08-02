---
title: Search indexing
description: Keep local and hosted indexes synchronized with the same build snapshot.
---

# Search indexing

## Search documents

Every search document contains a stable id, URL, title, optional description,
plain text, locale, and tags. The compiler derives it from the same typed page
manifest used by routing and navigation.

## Local and hosted indexes

Local search consumes emitted JSON snapshots. Hosted index writers consume the
same files through `@foldocs/search/sync`, making provider migrations independent
from content compilation.

## Synchronize safely

Run synchronization in CI after the production build. Use replacement semantics
or an equivalent atomic strategy so removed pages do not remain searchable.
