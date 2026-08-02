<p align="center">
  <img src="./apps/docs/public/favicon.svg" alt="Foldocs" width="96" height="96">
</p>

<h1 align="center">Foldocs</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/foldocs"><img src="https://img.shields.io/npm/v/foldocs" alt="npm version"></a>
</p>

<h3 align="center">The documentation framework for Foldkit.</h3>

<p align="center">
  <a href="https://foldocs.vercel.app"><strong>Documentation</strong></a> ·
  <a href="#get-started"><strong>Get Started</strong></a> ·
  <a href="https://github.com/Tarkaworks/foldocs"><strong>GitHub</strong></a> ·
  <a href="https://x.com/Tarkaworks"><strong>X</strong></a>
</p>

<p align="center">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/Tarkaworks/foldocs"><img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare"></a>
</p>

---

Foldocs is a complete documentation framework built with
[Foldkit](https://foldkit.dev/) and [Effect](https://effect.website/). It turns a
directory of Markdown and MDX files into a fast, searchable, multilingual
documentation site without making you assemble the layout, content pipeline,
search, or static rendering yourself.

The generated project is a normal Foldkit application that you own. Write
documents, adjust one typed configuration file, and deploy the prerendered
output anywhere that serves static assets.

## Get Started

Create a complete Foldocs application with one command:

```bash
pnpm create foldocs@latest my-docs
cd my-docs
pnpm dev
```

Your site starts with a landing page, responsive documentation layout, local
search, light and dark themes, internationalization, syntax highlighting,
Markdown endpoints, LLM files, and static rendering already configured.

## Write Documentation

Pages come directly from `content/docs`. Files become routes, `meta.json`
controls navigation, and parenthesized directories organize content without
appearing in the URL.

```text
content/docs/
├── en/
│   ├── meta.json
│   ├── index.mdx
│   └── (get-started)/
│       ├── meta.json
│       ├── installation.md
│       └── guides/
└── es/
    └── ...
```

A page needs only frontmatter and content:

```mdx
---
title: Installation
description: Create and run your first Foldocs site.
icon: PackageOpen
---

# Installation

<Callout title="Ready out of the box">
  Search, themes, static HTML, and Markdown output are already configured.
</Callout>
```

Use separators for visible sidebar sections and directories for collapsible
groups:

```json
{
  "title": "Documentation",
  "pages": [
    "---Introduction---",
    "index",
    "installation",
    "---Guides---",
    "guides"
  ]
}
```

Pages and groups support Lucide icons by name. Projects can replace any icon
with their own SVG through `foldocs.config.ts`.

## Built for Documentation

Foldocs ships as one integrated system:

- **Foldkit-native runtime** — navigation, search, themes, menus, and page state
  use a typed Model, Messages, update function, Commands, and Effect.
- **Markdown and deterministic MDX** — `.md` uses the official
  `@foldkit/markdown` parser; `.mdx` adds registered documentation components
  without executing arbitrary content JavaScript.
- **Complete documentation UI** — responsive navigation, nested sidebars,
  tables of contents, breadcrumbs, page actions, pagination, mobile menus, and
  accessible keyboard behavior are included.
- **Static by default** — every route is emitted as finished HTML with its own
  metadata, canonical URL, alternate languages, and matching Markdown file.
- **Search without setup** — Orama provides local full-text search by default,
  with a provider-neutral Effect interface for hosted search.
- **Internationalization from the start** — locale routes, translated UI,
  fallback content, localized search indexes, and alternate links share the
  same content model.
- **LLM-ready output** — pages expose Copy Markdown, View as Markdown, and
  assistant shortcuts; builds emit `llms.txt` and `llms-full.txt`.
- **Open typography** — Inter is used throughout the interface and JetBrains
  Mono is used for code. Both are self-hosted from their Fontsource packages.

## Configure the Site

`foldocs.config.ts` is the typed source of truth for the content pipeline and
site behavior:

```ts
import { defineConfig } from 'foldocs'

export default defineConfig({
  basePath: '/docs',
  content: { dir: 'content/docs' },
  markdown: true,
  llms: true,
  sitemap: true,
  prerender: true,
  search: { staticIndex: true },
  i18n: {
    defaultLocale: 'en',
    fallbackLocale: 'en',
    locales: [
      { locale: 'en', name: 'English' },
      { locale: 'es', name: 'Español' },
    ],
  },
})
```

Choose the `docs`, `notebook`, `flux`, or `glass` layout preset, or run
`foldocs customize all` to copy the layout, theme, and MDX component entry
points into your application.

## Static Output and Deployment

```bash
pnpm build
```

The build creates complete HTML for every landing and documentation route,
plus localized search indexes, Markdown pages, `llms.txt`, `llms-full.txt`, and
`sitemap.xml`. There is no production Node.js server and no SPA fallback
requirement.

Generated projects include [Alchemy](https://alchemy.run/) configuration for
Cloudflare Workers static assets:

```bash
pnpm deploy
```

The same `dist` directory can be deployed to any static hosting provider.

## Packages

The public package boundary stays intentionally small:

| Package                 | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `foldocs`               | Foldkit documentation program and typed configuration      |
| `foldocs-core`          | Content manifests, navigation, routes, and configuration   |
| `foldocs-mdx`           | Foldkit Markdown enrichment and deterministic MDX compiler |
| `foldocs-ui`            | Documentation layouts and component rendering              |
| `@foldocs/vite`         | Content discovery, virtual modules, HMR, and static output |
| `@foldocs/tailwind`     | Default theme, typography, layout, and prose styles        |
| `@foldocs/content`      | Shared content contracts                                   |
| `@foldocs/search`       | Provider-neutral Effect search interface                   |
| `@foldocs/search-orama` | Default zero-configuration local search                    |
| `@foldocs/language`     | Typed interface translations                               |
| `@foldocs/twoslash`     | Compiler-powered information for TypeScript code blocks    |
| `@foldocs/cli`          | Content validation and project customization               |
| `create-foldocs`        | Prompt-free Foldocs application generator                  |

See the [architecture guide](./docs/ARCHITECTURE.md) for the compiler, runtime,
and package boundaries.

## Development

```bash
git clone https://github.com/Tarkaworks/foldocs.git
cd foldocs
pnpm install
pnpm dev
```

The documentation application in `apps/docs` uses the same public packages and
template produced by `create-foldocs`.

Run the complete quality gate before pushing:

```bash
pnpm check
pnpm test:e2e
```

This checks formatting, Oxlint, unused files and dependencies, circular
imports, repository scripts, release boundaries, builds, TypeScript, package
tests, and browser behavior. The repository installs the same checks as a
pre-push hook.

## Releasing

Foldocs uses [Tegami](https://tegami.fuma-nama.dev/) for release notes,
versioning, and npm publication:

```bash
pnpm tegami
```

The publish workflow validates the complete repository before releasing the
public packages. npm authentication uses GitHub Actions trusted publishing,
so no long-lived npm token is stored in GitHub secrets.

## License

[MIT](./LICENSE) © 2026 Tarkaworks.

The default stylesheet includes portions adapted from the MIT-licensed Foldkit
website. Its required attribution is distributed with `@foldocs/tailwind` in
[`THIRD-PARTY-NOTICES.md`](./packages/tailwind/THIRD-PARTY-NOTICES.md).
