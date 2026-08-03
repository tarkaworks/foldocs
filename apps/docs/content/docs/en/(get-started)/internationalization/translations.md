---
title: Interface translations
description: Translate built-in labels while preserving complete locale defaults.
---

# Interface translations

## Partial UI dictionaries

Each locale may provide partial `ui` strings. Foldocs merges them with the
English defaults so newly introduced labels never render empty after an upgrade.

## Product terminology

The `@foldocs/language` package provides maintained locale helpers for Spanish,
Simplified and Traditional Chinese, French, German, Japanese, Korean,
Portuguese, and Arabic. You can also
define project terminology directly when product names or editorial language
need a custom translation.

```ts
import { composeTranslations, french } from '@foldocs/language'

const productFrench = {
  ...french(),
  ui: composeTranslations(french().ui, {
    documentation: 'Centre de connaissances',
  }),
}
```

Later layers win, so presets and project overrides compose in any order without
discarding unrelated labels.

## Navigation metadata

Translate content frontmatter and folder `meta.json` files independently. A
fallback page can therefore appear under a localized sidebar label even while
its body is awaiting translation.
