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
  <a href="./docs/ARCHITECTURE.md"><strong>Architecture</strong></a> ·
  <a href="./docs/PARITY.md"><strong>Fumadocs parity</strong></a> ·
  <a href="https://github.com/Aniket-508/foldocs"><strong>GitHub</strong></a>
</p>

<p align="center">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/Aniket-508/foldocs"><img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare"></a>
</p>

---

Foldocs turns Markdown and MDX into a complete, production-oriented
documentation site. The application is built with
[Foldkit](https://foldkit.dev/), its state and side effects are powered by
[Effect](https://effect.website/), and its content pipeline is integrated with
[Vite](https://vite.dev/).

Write documents in `content/docs`. Foldocs generates typed routes, navigation,
local search, syntax highlighting, tables of contents, page metadata, static
HTML, Markdown endpoints, `llms.txt`, and a sitemap. The default application
already includes the responsive layout, landing page, themes, i18n, and
Cloudflare deployment configuration.

> [!NOTE]
> Foldocs is pre-1.0. The project is usable today, but package boundaries and
> public APIs may change before the first stable release.

## Get Started

`create-foldocs` creates the entire application without asking you to select a
framework or assemble a theme:

```bash
pnpm create foldocs@latest my-docs
cd my-docs
pnpm dev
```

The generated project is a normal Foldkit application that you own. Start
writing in `content/docs/en`, edit `foldocs.config.ts` when you need to change
the site, and deploy the prerendered result anywhere that serves static assets.

## Write Documentation

Markdown and deterministic MDX files become pages automatically:

```text
content/docs/
├── en/
│   ├── meta.json
│   ├── index.mdx
│   ├── getting-started.md
│   └── manual-installation/
│       ├── meta.json
│       ├── pnpm.md
│       └── npm.md
└── es/
    └── ...
```

A page needs only frontmatter and content:

```mdx
---
title: Getting started
description: Create and run your first Foldocs site.
---

# Getting started

<Callout title="Ready out of the box">
  Search, dark mode, syntax highlighting, Markdown output, and static rendering
  are already configured.
</Callout>
```

Use `meta.json` to control the sidebar. Separator entries create visible,
non-collapsible groups; child directories become collapsible sections with
their own title, order, default-open state, and optional Lucide icon. Pages can
set the same `icon` field in frontmatter, and `site.icons` can replace a built-in
name with project-owned SVG markup.

```json
{
  "title": "Documentation",
  "pages": [
    "---Introduction---",
    "index",
    "getting-started",
    "manual-installation",
    "---Writing---",
    "configuration"
  ]
}
```

Parenthesized route groups such as `(get-started)` organize content without
changing its public URL. Root folders can become navigation tabs for separate
products, guides, or version trees.

## What Ships With Foldocs

Foldocs is a complete documentation system rather than a set of unrelated
packages that every application must wire together.

- **Foldkit-native runtime**: A typed Model, Message union, update function,
  Commands, routing, subscriptions, and views backed by Effect.
- **Documentation UI**: A responsive Foldkit-style header, sidebar, nested
  navigation, breadcrumbs, desktop and mobile tables of contents, previous and
  next links, footer, accessible search dialog, and three-way theme selector.
- **Official Foldkit Markdown core**: `.md` files are parsed and validated by
  `@foldkit/markdown`, including Effect Schema-typed island directives. Foldocs
  enriches that AST with frontmatter, heading IDs, navigation, search text,
  Shiki highlighting, code-copy controls, and optional Twoslash information.
- **Deterministic MDX compatibility**: `.mdx` adds registered inline and block
  components with literal attributes. Arbitrary MDX JavaScript is rejected so
  content stays deterministic; GFM task lists remain a Foldocs extension.
- **Static rendering**: Every landing and documentation route is emitted as
  complete HTML. The current page chunk is preloaded before Foldkit adopts the
  document, preventing a loading-page flash after refresh.
- **LLM-ready output**: Every page has a sibling `.md` URL, Copy Markdown and
  View as Markdown actions, and shortcuts for opening the page in ChatGPT,
  Claude, or Grok. Builds also emit `llms.txt` and `llms-full.txt`.
- **Search**: Orama works locally with no account or environment variables.
  FlexSearch is available as another local engine, while Algolia, Orama Cloud,
  Typesense, Trieve, and Mixedbread are optional provider packages.
- **Internationalization**: Locale-prefixed routes, translated UI strings,
  localized search, fallback documents, alternate links, and localized LLM
  files are generated from the beginning.
- **Metadata and discovery**: Route-specific titles, descriptions, canonical
  URLs, Open Graph data, `hreflang` links, `sitemap.xml`, and static Markdown
  assets are generated from the same typed content model.
- **Content integrations**: OpenAPI, AsyncAPI, TypeScript, Python, remote MDX,
  Sanity, BaseHub, Obsidian, and EPUB integrations live in separate packages,
  keeping provider SDKs and compilers out of the browser bundle.
- **Customization**: Choose the `docs`, `notebook`, `flux`, or `glass` layout
  preset, or run `foldocs customize all` to copy the theme, layout, and typed MDX
  component entry points into the application.

## Static by Default

Prerendering is enabled in every generated project:

```ts
import { defineConfig } from "foldocs";

export default defineConfig({
  basePath: "/docs",
  content: { dir: "content/docs" },
  markdown: true,
  llms: true,
  sitemap: true,
  prerender: true,
  search: { staticIndex: true },
});
```

The production build writes a directory `index.html` for every route and emits
the page's processed Markdown beside it. A deployment does not need a Node.js
server, a headless browser, or an SPA fallback. Direct links and browser
refreshes resolve to the finished page HTML.

## Search

The starter uses an on-demand Orama index generated per locale. No hosted search
service is required:

```ts
export default defineConfig({
  search: { staticIndex: true },
});
```

Hosted adapters implement the same Effect search interface. Their index writers
consume the same `search-index.json` snapshots used by local search, so moving
to a hosted provider does not change the content model. Keep provider admin
credentials in CI or a server process; the browser should receive only
search-only credentials or call a private endpoint.

## Internationalization

Generated projects start with localized content and UI:

```ts
import { defineConfig } from "foldocs";
import { spanish } from "@foldocs/language";

export default defineConfig({
  i18n: {
    defaultLocale: "en",
    fallbackLocale: "en",
    locales: [{ locale: "en", name: "English" }, spanish()],
  },
});
```

Spanish and Simplified or Traditional Chinese UI packs are available from
`@foldocs/language`. You can also provide typed translations directly in the
site configuration.

## Deploy to Cloudflare

Every generated application includes an
[`alchemy.run.ts`](./packages/create-foldocs/template/alchemy.run.ts) file and
scripts for Cloudflare-aware development, deployment, and teardown.

```bash
cp .env.example .env
pnpm deploy
```

The deployment publishes the prerendered output through Cloudflare Workers
static assets with SPA fallback disabled. Local deployments use Alchemy's
filesystem state. For CI or one-click deployment, configure
`ALCHEMY_PASSWORD`, `ALCHEMY_STATE_TOKEN`, and `CLOUDFLARE_API_TOKEN` as
encrypted variables.

To add one-click deployment to a generated project's README, replace
`<REPOSITORY_URL>` after publishing it to GitHub or GitLab:

```md
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=<REPOSITORY_URL>)
```

## Packages

The monorepo keeps runtime, compilation, UI, providers, and generators separate:

| Package                 | Purpose                                                      |
| ----------------------- | ------------------------------------------------------------ |
| `foldocs`               | Foldkit documentation program and typed configuration        |
| `foldocs-core`          | Site configuration, manifests, navigation, and route helpers |
| `foldocs-mdx`           | Foldkit Markdown enrichment and deterministic MDX compiler   |
| `foldocs-ui`            | Documentation layouts and MDX component renderer             |
| `@foldocs/vite`         | Content discovery, virtual modules, HMR, and static output   |
| `@foldocs/tailwind`     | Foldkit-inspired theme, layout, and prose styles             |
| `@foldocs/content`      | Shared Effect Schema content contracts                       |
| `@foldocs/search`       | Provider-neutral Effect search interface and index syncing   |
| `@foldocs/search-orama` | Default zero-config local search                             |
| `@foldocs/cli`          | Content checks, compilation, and local-link validation       |
| `create-foldocs`        | Prompt-free application generator                            |

Optional packages provide FlexSearch; Algolia, Orama Cloud, Typesense, Trieve,
and Mixedbread search; OpenAPI and AsyncAPI references; TypeScript and Python
API generation; Twoslash; EPUB export; Obsidian import; remote MDX; Sanity;
BaseHub; and translated UI packs.

See the [architecture guide](./docs/ARCHITECTURE.md) for the package graph and
runtime boundaries, and the [parity matrix](./docs/PARITY.md) for the current
Fumadocs feature comparison.

## Development

```bash
git clone https://github.com/Aniket-508/foldocs.git
cd foldocs
pnpm install
pnpm build
pnpm test
pnpm --filter foldocs-docs dev
```

The application in `apps/docs` dogfoods the same public packages and template
used by `create-foldocs`. A production build exercises lazy route chunks,
localized search indexes, static HTML, Markdown endpoints, metadata, LLM files,
and the sitemap together.

Before submitting a change, run:

```bash
pnpm typecheck
pnpm format:check
pnpm test
pnpm test:e2e
```

## Design and Attribution

The default shell follows the Foldkit website's layout measurements, responsive
behavior, palette, navigation states, prose treatment, and landing-page rhythm.
The referenced Foldkit source is MIT licensed; its license is included in
[`@foldocs/tailwind`](./packages/tailwind/FOLDKIT-LICENSE.txt).

JetBrains Mono is bundled under the SIL Open Font License. Foldkit's production
sans-serif, ABC Favorit, is commercially licensed and cannot be redistributed.
License holders can follow [`FONTS.md`](./FONTS.md) to add it for
pixel-identical typography.
