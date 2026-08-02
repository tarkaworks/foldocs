---
title: Breadcrumbs
description: Derive page context from the same typed tree used by the sidebar.
---

# Breadcrumbs

`navigationContextForUrl` returns the ancestor folder labels for a canonical
page URL. It ignores static separators and treats a folder index as the folder
destination rather than repeating the folder label.

```ts
import { navigationContextForUrl } from 'foldocs-core'

const labels = navigationContextForUrl(navigation, currentUrl)
// ['Guides', 'Deployment']
```

## Default layout

`docsLayout` calls this helper automatically and renders the result above the
page title. Repeated adjacent labels are collapsed, so an index page does not
produce duplicate context.

## Custom views

For a custom Foldkit layout, render the returned labels as text or map the
ancestor folders from your `NavigationNode` tree when every breadcrumb also
needs a link. Keep the current page title as the document's single `h1`.
