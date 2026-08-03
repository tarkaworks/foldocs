# Foldocs Vite

Vite plugin for Foldocs content compilation, routes, SEO assets, search indices, and static output.

## Installation

```bash
pnpm add -D @foldocs/vite
```

## Usage

```ts
import { defineConfig } from 'vite'

import { foldocs } from '@foldocs/vite'

export default defineConfig({
  plugins: [foldocs({ site: { title: 'My docs' } })],
})
```

## Documentation

[Read the Foldocs documentation](https://foldocs.vercel.app/en/docs/mdx/vite).

## License

[MIT](https://github.com/tarkaworks/foldocs/blob/main/LICENSE)
