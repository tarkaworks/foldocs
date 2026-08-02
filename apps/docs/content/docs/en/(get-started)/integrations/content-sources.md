---
title: Content sources
description: Combine filesystem pages with remote or CMS-backed build-time content.
---

# Content sources

The filesystem is the default source. Add build-time `ContentAdapter` instances
for remote Markdown, Sanity, BaseHub, or project-specific repositories.

Each adapter returns a path, source text, and optional locale. Foldocs validates
paths, rejects duplicate route ownership, compiles remote pages into lazy virtual
modules, and includes them in the same metadata manifest as local files.

Fetch remote content during the build, not from page views. That preserves static
output, keeps tokens private, and makes a deployment an immutable snapshot.
