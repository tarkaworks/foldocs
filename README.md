# Effectdocs

Effectdocs is a production documentation framework for Effect applications,
built with Foldkit. It provides typed Markdown and MDX content, filesystem
routing, accessible documentation layouts, local and hosted search adapters,
and static output for LLMs and search engines.

The repository is a pnpm monorepo. Package boundaries intentionally mirror the
separation of content, core, UI, integrations, and scaffolding found in
Fumadocs, while the runtime is exclusively Effect and Foldkit.

## Intended usage

```sh
pnpm create effectdocs@latest my-docs
cd my-docs
pnpm dev
```

The generated application uses local Orama search and a complete responsive
layout by default. There is no framework-selection prompt.

## Develop the monorepo

```sh
pnpm install
pnpm build
pnpm test
pnpm --filter effectdocs-docs dev
```

The dogfood site in `apps/docs` consumes the same public packages as a generated
application. Its production build verifies lazy page chunks, navigation, search,
syntax highlighting, `llms.txt`, `llms-full.txt`, and `sitemap.xml` together.

## Packages

- `effectdocs` — Foldkit application program and typed configuration
- `effectdocs-core` — manifests, navigation trees, and route helpers
- `effectdocs-mdx` — deterministic Markdown/MDX compiler and document AST
- `effectdocs-ui` — responsive documentation layout and MDX component renderer
- `@effectdocs/vite` — filesystem discovery, virtual manifest, HMR, and static assets
- `@effectdocs/content` — shared Effect Schema content contracts
- `@effectdocs/search` — provider-neutral Effect search interface
- `@effectdocs/search-orama` — default zero-config local search
- `@effectdocs/search-flexsearch` — optional local FlexSearch adapter
- `@effectdocs/search-algolia`, `@effectdocs/search-orama-cloud`,
  `@effectdocs/search-mixedbread`, `@effectdocs/search-typesense`, and
  `@effectdocs/search-trieve` — separately installable hosted adapters
- `@effectdocs/cli` — content compilation and local-link validation
- `create-effectdocs` — the prompt-free project generator

See [architecture](docs/ARCHITECTURE.md) and the explicit
[Fumadocs parity matrix](docs/PARITY.md).
