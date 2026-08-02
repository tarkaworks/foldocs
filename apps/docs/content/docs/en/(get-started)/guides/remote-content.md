---
title: Build with remote content
description: Fetch CMS or repository content without giving up static output.
---

# Build with remote content

Remote content should enter Foldocs before compilation. That preserves static
HTML, local search documents, `.md` routes, and a complete `llms.txt` corpus.

## Build sequence

1. Fetch content with a `ContentAdapter`.
2. Normalize every record into a stable path and UTF-8 source.
3. Merge remote and filesystem files.
4. Reject duplicate ownership.
5. Compile, validate links, index, and prerender.

## Cache by revision

Use a CMS revision, Git commit, or response validator as the cache key. Store the
resolved revision with the deployment so a page can be traced back to its source.

## Failure behavior

Do not silently build without remote pages. Retry transient requests through
Effect, then fail the build with the source name and revision when recovery is
not possible.
