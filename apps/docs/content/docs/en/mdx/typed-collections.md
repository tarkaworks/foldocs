---
title: Typed collections
description: Preserve and validate custom frontmatter for product-specific content types.
---

# Typed collections

Foldocs validates the standard page fields and preserves every additional
frontmatter key under `frontmatter.data`.

```md
---
title: Authentication
product: identity
stability: stable
owners:
  - platform
---
```

## Define a collection

```ts
import { defineCollection, parseCollectionFrontmatter } from '@foldocs/content'

const guides = defineCollection({
  name: 'guides',
  directory: 'content/guides',
  parse: value => GuideMetadata.parse(value),
})

const metadata = parseCollectionFrontmatter(guides, page.frontmatter)
```

The parser can be an Effect Schema decoder, Standard Schema validator, or a
project-owned function. The headless `loader<Page>()` remains generic over each
page's compiled data, so collection-specific output stays typed end to end.
