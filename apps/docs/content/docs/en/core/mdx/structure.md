---
title: Document structure
description: Reuse compiled headings and plain text for search, navigation, and exports.
---

# Document structure

`CompiledPage` contains the normalized document, frontmatter, table of contents,
original source, and a plain-text projection. Foldocs produces these values once
instead of running independent Remark plugins for every downstream feature.

```ts
const page = await compile(source, { filePath })

page.document
page.frontmatter
page.toc
page.plainText
page.source
```

## Search

The Vite layer converts final manifest entries into `SearchDocument` records.
Headings keep their stable fragments, while `plainText` supplies provider-neutral
content for local or hosted indexes.

## Other consumers

The same AST drives HTML rendering, `.md` routes, RSS, EPUB generation, Open
Graph metadata, link validation, and prerendering. A source adapter therefore
only needs to return content—it does not implement each output separately.
