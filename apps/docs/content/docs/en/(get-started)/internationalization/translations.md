---
title: Interface translations
description: Translate built-in labels while preserving complete locale defaults.
---

# Interface translations

Each locale may provide partial `ui` strings. Foldocs merges them with the
English defaults so newly introduced labels never render empty after an upgrade.

The `@foldocs/language` package provides maintained locale helpers. You can also
define project terminology directly when product names or editorial language
need a custom translation.

Translate content frontmatter and folder `meta.json` files independently. A
fallback page can therefore appear under a localized sidebar label even while
its body is awaiting translation.
