---
title: Configuration
description: Customize your Foldocs site from one typed config file.
order: 3
---

# Configuration

Edit `foldocs.config.ts` to change the site identity and content paths.

:::Aside{type="tip"}
This `.md` page is parsed by `@foldkit/markdown`. The `Aside` directive is
validated against `src/markdown-islands.ts` during development and builds.
:::

## Site metadata

Set `site.baseUrl` to the production origin so canonical URLs, social image URLs,
and the generated `sitemap.xml` are correct. `description`, `keywords`, `favicon`,
`socialImage`, and `locale` provide the default document metadata without editing
`index.html`.

Each page can override `description`, `keywords`, and `socialImage` in its
frontmatter. Foldocs keeps those values synchronized during client navigation and
emits them directly into that route's production HTML.

Foldocs also emits canonical and language-alternate links, complete Open Graph
and Twitter cards, crawler directives, `robots.txt`, sitemap `lastmod` values,
and Schema.org JSON-LD for the website, documentation articles, images, authors,
publishers, and breadcrumbs. Customize ownership and title formatting with the
typed `seo` block:

```ts
seo: {
  titleTemplate: '%s | Acme Docs',
  author: { type: 'Person', name: 'Ada', url: 'https://example.com/ada' },
  publisher: { name: 'Acme', url: 'https://example.com' },
  twitterSite: '@acme',
}
```

Set `seo.robots.index`, `seo.robots.follow`, or `seo.jsonLd` only when a site
needs to override the production defaults.

`og: true` generates a 1200×630 landing card and one card per page with Takumi
during the production build. Use `og.directory`, `width`, `height`, `logoSvg`, or
a `defineOgTemplate` callback to customize the static output.

`logoText`, `badge`, and `tagline` customize the built-in Foldkit-style landing and
documentation shell. Add `githubUrl`, `discordUrl`, `xUrl`, or `npmUrl` to expose
the corresponding header and mobile-navigation links. With i18n and the default
`basePath: "/docs"`, `/` redirects to a locale landing page such as `/en`; setting
`basePath: "/"` makes each locale's root Markdown document its homepage instead.

Set `landing.footer.author`, `authorUrl`, `copyright`, and `twitterUrl` to use the
same attribution footer on the landing page and every documentation page. The
source-code sentence links to `site.githubUrl`.

## Internationalization

Configure `i18n.defaultLocale`, `i18n.fallbackLocale`, and `i18n.locales`. Locale
content lives in `content/docs/<locale>` and is routed through
`/<locale>/docs`. Each locale can provide `dir: "rtl"` and partial `ui` strings;
unspecified UI strings inherit the English defaults.

If a translated document is missing, Foldocs serves the fallback-locale source
at the requested locale URL. Navigation, search, Markdown output, LLM files,
canonical URLs, and sitemap alternates continue to use the requested locale.

## AI-readable output

Foldocs emits both `llms.txt`, a compact page index, and `llms-full.txt`, a
complete Markdown corpus. Set `llms: false` only if you do not want these assets.

Every page is also emitted as processed Markdown by appending `.md` to its URL—for
example, `/en/docs/concepts/effects.md`. Foldocs serves the same content when a
client requests the HTML route with `Accept: text/markdown`. Set `markdown: false`
to disable the per-page assets and page actions.

Production builds prerender every landing and documentation route to a directory
`index.html` by default. The generated HTML contains the complete Foldkit layout
and page content, so it remains readable without JavaScript. Before Foldkit takes
over, the generated entry point preloads only the current page chunk and initializes
the runtime from that page. Refreshing therefore keeps the finished document on
screen instead of flashing a loading view. Set `prerender: false` only for
deployments that require a single SPA entry point.

Local search documents are emitted to a per-locale `search-index.json` and fetched
only when someone searches, keeping the complete documentation corpus out of the
initial JavaScript bundle. Set `search.staticIndex: false` to bundle search content
with the virtual manifest instead.

## Frontmatter

Use `order`, `label`, `icon`, `index`, `hidden`, `draft`, `tags`, `keywords`, and
`socialImage` to control page metadata. Set `index: true` on a folder's index
page to link the collapsible folder row to it. `icon` accepts a built-in Lucide name,
including `book-open`, `file-text`, `package`, `rocket`, `settings`, and
`sparkles`.

## Sidebar structure

Use separator entries in `meta.json` for static group headings. Child folders
become collapsible sections and use their own metadata:

```json
{
  "pages": [
    "---Introduction---",
    "index",
    "manual-installation",
    "---Writing---",
    "configuration"
  ]
}
```

`manual-installation/meta.json` defines its dropdown:

```json
{
  "title": "Manual installation",
  "icon": "package",
  "pages": ["pnpm", "npm"],
  "defaultOpen": false
}
```

Pages can set the same icon in frontmatter:

```yaml
---
title: Deploy
icon: rocket
---
```

To replace a built-in name or add a project icon, register trusted SVG markup
in `site.icons`. The same name then works in page frontmatter and `meta.json`:

```ts
export default defineConfig({
  site: {
    title: 'My docs',
    icons: {
      rocket: '<svg viewBox="0 0 24 24" aria-hidden="true">...</svg>',
    },
  },
})
```

Directories wrapped in parentheses are route groups. For example,
`content/docs/en/(get-started)/installation.mdx` is grouped under “Get started” in
the sidebar but still resolves to `/en/docs/installation`, following the Fumadocs
content convention.

Set `"root": true` and add an optional `description` to turn a folder into a
layout tab. Only the active root's pages appear in the sidebar and pager. Use
normal folders such as `v1` and `v2` for partial versioning, or route groups such
as `(guides)` and `(api)` for isolated sections without extra URL segments.

## Markdown islands and deterministic MDX

Plain `.md` pages use the official `@foldkit/markdown` parser. Define directive
attribute schemas in `src/markdown-islands.ts`, pass them through
`markdownOptions.islands`, and pair them with views using the official
`islandsFor` helper. The generated entry passes those views to
`createDocsProgram({ islands })`. This keeps standard Markdown typed from build
to render while Foldocs adds frontmatter, heading links, syntax highlighting,
navigation, and search text.

Use `.mdx` only when a page needs inline JSX-like component syntax. Foldocs MDX
accepts registered components with literal string attributes; it never executes
JavaScript expressions or module code.

Register presentational Foldkit renderers in `src/mdx-components.ts` and pass the
registry to `createDocsProgram`. Component attributes are literal strings and
children are already-rendered Foldkit nodes, keeping content deterministic and
safe to index.

```ts
import { html } from 'foldkit/html'
import type { MdxComponents } from 'foldocs'

const h = html()

export const mdxComponents: MdxComponents = {
  inline: {
    Kbd: (_, content) => h.kbd([], content),
  },
  block: {
    Aside: (_, content) => h.aside([], content),
  },
}
```

Use the registered names directly from MDX:

```mdx
Press <Kbd>⌘K</Kbd> to search.

<Aside type="tip">This renderer belongs to your application.</Aside>
```
