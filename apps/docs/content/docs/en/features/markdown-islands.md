---
title: Markdown and typed islands
description: Use the official Foldkit Markdown pipeline with Foldocs enrichment.
order: 3
tags:
  - markdown
  - foldkit
  - islands
---

# Markdown and typed islands

Foldocs uses `@foldkit/markdown` as the parser and schema boundary for every
`.md` page. Its CommonMark and GFM nodes become the canonical document, then
Foldocs adds frontmatter, stable heading IDs, syntax highlighting, table of
contents data, search text, navigation, and static Markdown output.

:::Aside{type="tip"}
This callout is an official Foldkit Markdown island. Its name and `type`
attribute were validated during this site's build before the Foldocs renderer
used the project-owned `Aside` view.
:::

Define island attributes with Effect Schema and pass them to the Vite plugin:

```ts
import { islandsFor } from "@foldkit/markdown";
import { Schema as S } from "effect";
import { inertHtml as h } from "foldkit/html";

export const markdownIslandDefinitions = {
  Aside: S.Struct({
    type: S.optionalKey(S.Literals(["info", "tip", "warning"])),
  }),
};

export const markdownIslands = islandsFor(markdownIslandDefinitions, {
  Aside: (attributes, content) =>
    h.aside(
      [h.Class(`fd-callout fd-callout-${attributes.type ?? "info"}`)],
      content,
    ),
});
```

```ts
foldocs({
  ...docs,
  components: mdxComponents,
  markdownOptions: { islands: markdownIslandDefinitions },
});
```

Pass `markdownIslands` to `createDocsProgram({ islands })`. The same schemas
therefore validate at build time and decode attributes before the typed runtime
view runs.

Use `.mdx` when inline component syntax is necessary. Foldocs keeps that path
deterministic: component attributes must be literal strings, while JavaScript
expressions, module code, raw HTML, and unsafe URL schemes fail compilation.
GFM task lists remain a small Foldocs extension because the current official
Foldkit Markdown vocabulary intentionally rejects them.
