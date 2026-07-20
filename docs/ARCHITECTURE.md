# Architecture

Effectdocs keeps authoring, compilation, runtime, UI, and integrations in separate
packages from the beginning. The default experience is opinionated, while the
package graph avoids making every user install every provider.

```text
Markdown / deterministic MDX
          │
          ▼
 effectdocs-mdx ──────► typed document AST
          │
          ▼
 @effectdocs/vite ────► virtual:effectdocs manifest ───► lazy page chunks
          │                                                │
          ├──► llms.txt / llms-full.txt / sitemap.xml       ▼
          │                                         effectdocs program
          │                                                │
          ▼                                                ▼
 eager metadata ─► navigation + local/hosted search ─► effectdocs-ui
                                                       Foldkit HTML
```

## Runtime

`createDocsProgram` produces the Effect Schema model and message union plus the
Foldkit `init`, `update`, `view`, and routing configuration. Page loading,
navigation, search, and theme persistence are Foldkit commands backed by Effect.

Only page metadata is eager. Compiled page bodies are imported by route, so adding
documents does not place the entire documentation corpus in the initial JavaScript
chunk. Local search uses the eager plain-text metadata and does not fetch page chunks.

## Content safety

Effectdocs supports Markdown, GFM, YAML frontmatter, directives, literal MDX
attributes, and registered components. Arbitrary MDX JavaScript expressions, ESM,
raw HTML, spread props, and unsafe URL schemes are rejected during compilation.
Interactive behavior belongs in typed Foldkit models and messages rather than code
executed from documentation files.

## Search

`@effectdocs/search` is a small Effect interface. The generated app constructs an
Orama index in the browser by default. FlexSearch is an alternative local engine.
Hosted adapters are separate packages, and `createDocsProgram({ search })` accepts
any of them without changing the docs runtime.

Provider admin keys and ingestion jobs must run on a server or in CI. Browser-side
adapters should receive search-only credentials or call a server endpoint; the
Trieve adapter deliberately accepts a callback to make that boundary explicit.
