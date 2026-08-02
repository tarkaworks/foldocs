---
title: Type safety
description: Use shipped virtual-module declarations and Effect schemas without generated type files.
---

# Type safety

Foldocs ships its content and virtual-module types with the published packages.
It does not generate a `.source` directory or require a postinstall typegen step.

## Virtual module declarations

```json
{
  "compilerOptions": {
    "moduleResolution": "Bundler",
    "types": ["@foldocs/vite/client", "vite/client"]
  }
}
```

This types `manifest`, navigation, locale configuration, layout settings, search
index URLs, and other `virtual:foldocs` exports.

## Runtime schemas

`@foldocs/content` exports Effect schemas for `PageFrontmatter`, `PageMetadata`,
`TocItem`, and `ContentFile`. `foldocs-mdx/ast` exports schemas for `Document`,
every tagged node, and `CompiledPage`.

```ts
import { decodeCompiledPage } from 'foldocs-mdx/compiler'

const page = decodeCompiledPage(unknownValue)
```

Use decoders at network, cache, or plugin boundaries instead of asserting
untrusted values.

## Authoring validation

`foldocs check` compiles the complete content corpus, validates frontmatter and
typed islands, and reports source locations. Run it in CI alongside TypeScript
checking so content errors fail before deployment.

## Why no generated files?

The Foldocs page schema is intentionally stable and serializable. Project-specific
data belongs behind typed content adapters, so changing a provider does not
rewrite generated application imports.
