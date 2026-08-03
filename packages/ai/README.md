# Foldocs AI

Effect-native, provider-neutral AI client and server helpers for Foldocs.

## Installation

```bash
pnpm add @foldocs/ai effect
```

## Usage

Create a server-side handler without exposing provider credentials:

```ts
import { createAiHandler, openAiCompatible } from '@foldocs/ai'

export default createAiHandler({
  provider: openAiCompatible({
    apiKey: process.env.AI_API_KEY!,
    model: 'your-model',
  }),
})
```

## Documentation

[Read the Foldocs documentation](https://foldocs.vercel.app/en/docs/integrations/ai).

## License

[MIT](https://github.com/tarkaworks/foldocs/blob/main/LICENSE)
