---
title: Graph view
description: Show outgoing documentation references and backlinks.
---

# Graph view

```mdx
<GraphView />
```

Foldocs extracts authored links during compilation and builds the current page's
outgoing and backlink graph from the manifest. The component is static,
keyboard-accessible, and requires no client graph library.

## Link resolution

Relative links resolve against the current documentation URL. Duplicate edges
are collapsed, external links are ignored, and every graph node links to the
canonical page route.
