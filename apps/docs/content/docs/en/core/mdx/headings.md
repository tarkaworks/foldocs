---
title: Headings
description: Generate stable fragments and serializable table-of-contents data.
---

# Headings

The compiler assigns GitHub-compatible IDs with `github-slugger`. Duplicate
headings receive stable numeric suffixes, and inline formatting contributes its
plain text to the slug.

## Table of contents

Headings at levels two through four become `TocItem` records on the compiled
page. The desktop TOC, mobile disclosure, inline TOC, search structure, and link
checker all consume this same array.

```ts
const page = await compile('## Installation\n\n### pnpm')

page.toc
// [
//   { id: 'installation', title: 'Installation', depth: 2 },
//   { id: 'pnpm', title: 'pnpm', depth: 3 },
// ]
```

## Page title

Frontmatter `title` is preferred. When it is absent, the first authored heading
becomes the title; compilation fails when neither is available.
