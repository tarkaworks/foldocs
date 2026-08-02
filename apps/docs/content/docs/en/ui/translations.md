---
title: UI translations
description: Localize navigation, search, page actions, pagination, and accessibility labels.
---

# UI translations

Foldocs keeps interface translations separate from page content. Every locale can
override labels while unspecified values fall back to the default English pack.

## Language packs

`@foldocs/language` includes Spanish, Simplified Chinese, and Traditional Chinese
packs. A pack combines locale metadata with a complete `UiTranslations` value.

```ts
import { spanish } from '@foldocs/language'

const languages = [spanish()]
```

## Custom translations

Provide the same keys used by `UiTranslations`: search states, theme names,
mobile navigation, Markdown actions, pagination, and footer labels. Use
`interpolateTranslation` for values that include dynamic text.

## Direction

Locale configuration includes `dir`. The docs shell mirrors sidebars, chevrons,
padding, and page navigation when a right-to-left locale is active.
