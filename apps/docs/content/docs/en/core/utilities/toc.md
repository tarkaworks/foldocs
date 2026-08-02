---
title: Extract table of contents
description: Read normalized headings without parsing rendered HTML.
---

# Extract table of contents

`compile` returns table-of-contents data directly on `CompiledPage.toc`. No DOM,
React tree, or second Markdown pass is required.

```ts
import { compile } from 'foldocs-mdx'

const page = await compile(source, { filePath })

for (const item of page.toc) {
  console.log(item.depth, item.title, `#${item.id}`)
}
```

Only levels two through four are included. The page title remains the single
primary heading and is rendered separately by the documentation layout.
