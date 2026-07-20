# Foldocs

Foldocs is a production documentation framework for Foldkit applications,
with Effect powering the runtime. It provides typed Markdown and MDX content, filesystem
routing, accessible documentation layouts, local and hosted search adapters,
and static output for LLMs and search engines.

The repository is a pnpm monorepo. Package boundaries intentionally mirror the
separation of content, core, UI, integrations, and scaffolding found in
Fumadocs, while the application framework is Foldkit and the runtime is Effect.

## Intended usage

```sh
pnpm create foldocs@latest my-docs
cd my-docs
pnpm dev
```

The generated application uses local Orama search and a complete responsive
layout by default, including keyboard search, active desktop/mobile tables of
contents, the Foldkit website's cream/charcoal visual system, a separate generated
landing page, collapsible navigation, code copy controls, flash-free three-way
theming, route-specific metadata, and fully rendered static HTML for every route.
Every page also has an appended `.md` URL plus
Copy Markdown and View as Markdown actions. There is no framework-selection prompt.
Fumadocs-style `meta.json` files and parenthesized route groups provide explicit
sidebar labels, ordering, and default-open behavior without changing public URLs.
Root folders become localized layout tabs, providing isolated product sections
and partial version trees with correctly scoped sidebars and pagination.
The `docs`, `notebook`, `flux`, and `glass` presets keep that behavior while
changing the composition, and `foldocs customize all` copies project-owned theme,
layout, and typed MDX component entry points for deeper customization.
Generated projects are multilingual from the start: content lives under
`content/docs/<locale>`, routes use `/<locale>/docs`, and the shell includes a
locale switcher, localized search, fallback documents, and translated UI labels.
Typed Spanish and Simplified/Traditional Chinese presets are available from
`@foldocs/language`.

```ts
i18n: {
  defaultLocale: "en",
  fallbackLocale: "en",
  locales: [
    { locale: "en", name: "English" },
    { locale: "es", name: "Español", ui: { search: "Buscar" } },
  ],
}
```

## Develop the monorepo

```sh
pnpm install
pnpm build
pnpm test
pnpm --filter foldocs-docs dev
```

The dogfood site in `apps/docs` consumes the same public packages as a generated
application. Its production build verifies lazy page chunks, navigation, lazy
per-locale search indexes, syntax highlighting, prerendered route HTML, `llms.txt`,
`llms-full.txt`, and `sitemap.xml` together.
Compiler-only Markdown and Shiki dependencies stay out of the browser bundle.
The build additionally verifies that processed per-page Markdown assets are emitted
at paths such as `/en/docs/getting-started.md`. Localized builds also emit
`/<locale>/llms.txt`, `/<locale>/llms-full.txt`, `hreflang`/`x-default` sitemap
entries, and runtime alternate links.

## Packages

- `foldocs` — Foldkit application program and typed configuration
- `foldocs-core` — manifests, navigation trees, and route helpers
- `foldocs-mdx` — deterministic Markdown/MDX compiler and document AST
- `@foldocs/openapi` — OpenAPI/Swagger operation-page and navigation generator
- `@foldocs/asyncapi` — AsyncAPI channel/message page and navigation generator
- `@foldocs/typescript` and `@foldocs/python` — managed language API generators
- `@foldocs/twoslash` — build-time TypeScript hovers and diagnostics for Shiki
- `@foldocs/epub` — EPUB 3 export from the deterministic document model
- `@foldocs/obsidian` — managed Obsidian vault-to-MDX migration with attachments
- `@foldocs/language` — typed Spanish and Simplified/Traditional Chinese UI packs
- `@foldocs/mdx-remote` — validated HTTP Markdown/MDX content source
- `@foldocs/sanity` and `@foldocs/basehub` — typed CMS-to-virtual-file adapters
- `foldocs-ui` — responsive documentation layout and MDX component renderer
- `@foldocs/vite` — filesystem discovery, virtual manifest, HMR, and static assets
- `@foldocs/content` — shared Effect Schema content contracts
- `@foldocs/search` — provider-neutral Effect search interface
- `@foldocs/search-orama` — default zero-config local search
- `@foldocs/search-flexsearch` — optional local FlexSearch adapter
- `@foldocs/search-algolia`, `@foldocs/search-orama-cloud`,
  `@foldocs/search-mixedbread`, `@foldocs/search-typesense`, and
  `@foldocs/search-trieve` — separately installable hosted adapters

Hosted adapters include server/CI index writers. They consume the exact
per-locale `search-index.json` snapshots generated for local search, with native
replacement flows for Algolia, Orama Cloud, and Typesense and private replacement
hooks for Trieve and Mixedbread.

- `@foldocs/cli` — content compilation and local-link validation
- `create-foldocs` — the prompt-free project generator

The generated project also contains ready-to-edit OpenAPI and AsyncAPI documents,
plus scripts for API/event reference generation, EPUB export, and Obsidian import.

See [architecture](docs/ARCHITECTURE.md) and the explicit
[Fumadocs parity matrix](docs/PARITY.md).
