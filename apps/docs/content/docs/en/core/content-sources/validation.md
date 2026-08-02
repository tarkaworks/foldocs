---
title: Source validation
description: Validate adapter output, frontmatter, routes, and links before deployment.
---

# Source validation

Unknown data is decoded at package boundaries with Effect Schema. Adapter files
must contain a safe relative path, source text, and optional locale or ISO
last-modified value.

## Compile-time checks

The Vite integration rejects:

- absolute or parent-traversing virtual paths;
- duplicate file ownership and duplicate canonical URLs;
- invalid frontmatter values;
- unsupported Markdown or MDX nodes;
- unknown configured islands;
- routes that collide after locale and group normalization.

## Repository checks

Run `pnpm foldocs check` to compile the corpus and validate local links and
heading fragments. Use the same command in CI so remote and local sources are
checked before the static build is published.
