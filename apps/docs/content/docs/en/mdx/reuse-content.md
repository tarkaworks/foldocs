---
title: Reuse content
description: Include Markdown, MDX, code files, regions, sections, and headings without duplicating source.
---

# Reuse content

Foldocs expands includes at build time, records the dependency in the compiler
pipeline, and rejects recursive include cycles.

## Include a document

```mdx
<include>./shared/introduction.mdx</include>
```

Frontmatter is removed from included documents. Relative includes resolve from
the current page, while `cwd` resolves from the configured project root.

```mdx
<include cwd>content/shared/compatibility.md</include>
```

## Include code

```mdx
<include lang="ts" meta='title="config.ts"'>
  ../../../src/config.ts
</include>
```

Use a fragment to select a named code region, an HTML/Markdown section, or a
heading and its body:

```mdx
<include lang="ts">../../../src/config.ts#public-api</include>
<include>./guide.md#deployment</include>
```

Supported region markers include `#region`, `<section id="...">`, directive
sections, and heading slugs.

## Reuse presentation

For shared interactive behavior, use a registered Foldkit component instead of
a textual include. Components remain typed and portable across prerendered HTML,
search, Markdown routes, and other consumers.
