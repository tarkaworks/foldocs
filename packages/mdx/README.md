# Foldocs MDX

Compile Markdown and deterministic MDX into typed, serializable Foldocs documents.

## Installation

```bash
pnpm add foldocs-mdx effect
```

## Usage

```ts
import { compile } from 'foldocs-mdx'

const page = await compile('# Hello')
```

The compiler includes frontmatter, GFM, directives, math, Shiki highlighting, typed islands, reusable includes, and document plugins.

## Documentation

[Read the Foldocs documentation](https://foldocs.vercel.app/en/docs/mdx).

## License

[MIT](https://github.com/tarkaworks/foldocs/blob/main/LICENSE)
