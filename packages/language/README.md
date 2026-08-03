# Foldocs Language

Ready-to-use locale and UI translation packs for Foldocs.

## Installation

```bash
pnpm add -D @foldocs/language
```

## Usage

```ts
import { defineConfig } from 'foldocs'

import { spanish } from '@foldocs/language'

export default defineConfig({
  i18n: {
    defaultLocale: 'en',
    locales: [{ locale: 'en', name: 'English' }, spanish()],
  },
})
```

French, German, Japanese, Korean, Portuguese, Arabic, and Chinese packs are also included.

## Documentation

[Read the Foldocs documentation](https://foldocs.vercel.app/en/docs/internationalization/translations).

## License

[MIT](https://github.com/tarkaworks/foldocs/blob/main/LICENSE)
