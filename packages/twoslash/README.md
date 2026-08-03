# Foldocs Twoslash

TypeScript Twoslash-powered Shiki highlighting for Foldocs code blocks.

## Installation

```bash
pnpm add -D @foldocs/twoslash
```

## Usage

```ts
import { createTwoslashHighlighter } from '@foldocs/twoslash'
import { foldocs } from '@foldocs/vite'

foldocs({ highlightCode: createTwoslashHighlighter() })
```

Import `@foldocs/twoslash/twoslash.css` when using the renderer outside the default Foldocs styles.

## Documentation

[Read the Foldocs documentation](https://foldocs.vercel.app/en/docs/markdown/twoslash).

## License

[MIT](https://github.com/tarkaworks/foldocs/blob/main/LICENSE)
