# Foldocs Content

Typed content contracts, collections, and build-time source adapters for Foldocs.

## Installation

```bash
pnpm add @foldocs/content effect
```

## Usage

```ts
import { defineContentAdapter } from '@foldocs/content'

export const source = defineContentAdapter('example', async () => [
  { path: 'guide.md', source: '# Guide' },
])
```

## Documentation

[Read the Foldocs documentation](https://foldocs.vercel.app/en/docs/core/content-sources).

## License

[MIT](https://github.com/tarkaworks/foldocs/blob/main/LICENSE)
