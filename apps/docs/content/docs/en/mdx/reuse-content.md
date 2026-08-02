---
title: Reuse content
description: Share typed presentation and generated source without hidden textual includes.
---

# Reuse content

Fumadocs MDX includes a textual `<include>` transform. Foldocs deliberately uses
typed components and content adapters instead, keeping dependencies visible and
every input valid before prerendering.

## Reuse presentation

Define a deterministic MDX component when several pages share the same visual or
semantic pattern:

```mdx
<Compatibility runtime="Node.js 24" status="supported" />
```

Register its Foldkit renderer once through `components`. Literal attributes stay
in the portable AST and remain available to HTML, Markdown, and search consumers.

## Reuse generated content

When multiple pages share source data, generate complete Markdown files or
return virtual files from a `ContentAdapter`. This is appropriate for API
references, release notes, and CMS records.

## Reuse code examples

Keep executable examples in checked source files and generate documentation from
them during the adapter or code-generation step. The resulting page remains a
self-contained build input rather than reading arbitrary files during render.

## Why there is no include tag

Implicit includes introduce dependency graphs, region-marker conventions, and
watch invalidation outside the page manifest. Foldocs does not currently expand
`<include>` or `:::include` directives. A future implementation would need cycle
detection, path confinement, dependency watching, and portable serialization
before it could be enabled safely.
