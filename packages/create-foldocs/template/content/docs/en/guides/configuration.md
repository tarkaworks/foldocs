---
title: Configuration
description: Customize your Foldocs site from one typed config file.
order: 3
---

# Configuration

Edit `foldocs.config.ts` to change the site identity and content paths.

## Site metadata

Set `site.baseUrl` to the production origin so canonical URLs, social image URLs,
and the generated `sitemap.xml` are correct. `description`, `keywords`, `favicon`,
`socialImage`, and `locale` provide the default document metadata without editing
`index.html`.

Each page can override `description`, `keywords`, and `socialImage` in its
frontmatter. Foldocs keeps those values synchronized during client navigation and
emits them directly into that route's production HTML.

`logoText`, `badge`, and `tagline` customize the built-in Foldkit-style landing and
documentation shell. Add `githubUrl`, `discordUrl`, `xUrl`, or `npmUrl` to expose
the corresponding header and mobile-navigation links. With i18n and the default
`basePath: "/docs"`, `/` redirects to a locale landing page such as `/en`; setting
`basePath: "/"` makes each locale's root Markdown document its homepage instead.

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
example, `/en/docs/getting-started.md`. Foldocs serves the same content when a
client requests the HTML route with `Accept: text/markdown`. Set `markdown: false`
to disable the per-page assets and page actions.

Production builds prerender every landing and documentation route to a directory
`index.html` by default. The generated HTML contains the complete Foldkit layout
and page content, so it remains readable without JavaScript while the client
runtime progressively takes over. Set `prerender: false` only for deployments that
require a single SPA entry point.

Local search documents are emitted to a per-locale `search-index.json` and fetched
only when someone searches, keeping the complete documentation corpus out of the
initial JavaScript bundle. Set `search.staticIndex: false` to bundle search content
with the virtual manifest instead.

## Frontmatter

Use `order`, `label`, `hidden`, `draft`, `tags`, `keywords`, and `socialImage` to
control page metadata.

## Sidebar structure

Add a `meta.json` file to any content directory to name the sidebar group,
choose its page order, and control whether it starts open:

```json
{
  "title": "Get started",
  "pages": ["index", "installation", "..."],
  "defaultOpen": true
}
```

Directories wrapped in parentheses are route groups. For example,
`content/docs/en/(get-started)/installation.mdx` is grouped under “Get started” in
the sidebar but still resolves to `/en/docs/installation`, following the Fumadocs
content convention.

Set `"root": true` and add an optional `description` to turn a folder into a
layout tab. Only the active root's pages appear in the sidebar and pager. Use
normal folders such as `v1` and `v2` for partial versioning, or route groups such
as `(guides)` and `(api)` for isolated sections without extra URL segments.

## Custom MDX components

Register presentational Foldkit renderers in `src/mdx-components.ts` and pass the
registry to `createDocsProgram`. Component attributes are literal strings and
children are already-rendered Foldkit nodes, keeping content deterministic and
safe to index.

```ts
import type { MdxComponents } from "foldocs";
import { html } from "foldkit/html";

const h = html();

export const mdxComponents: MdxComponents = {
  inline: {
    Kbd: (_, content) => h.kbd([], content),
  },
  block: {
    Aside: (_, content) => h.aside([], content),
  },
};
```

Use the registered names directly from MDX:

```mdx
Press <Kbd>⌘K</Kbd> to search.

<Aside type="tip">This renderer belongs to your application.</Aside>
```

## OpenAPI

Edit the included `openapi.yaml`, then run `pnpm generate:api`. The separate
`@foldocs/openapi` package writes a root-folder API reference to
`content/docs/en/api`, including operation pages, parameters, schemas, examples,
request samples, responses, and navigation metadata.

## AsyncAPI

Edit `asyncapi.yaml`, then run `pnpm generate:events`. `@foldocs/asyncapi`
generates channel and message pages with payloads, examples, protocol bindings,
and root navigation metadata.

## EPUB and Obsidian

Run `pnpm export:epub` to package the English content tree as EPUB 3. To migrate an
Obsidian vault, create a `vault` directory and run `pnpm import:obsidian`; wiki
links, embeds, comments, and attachments become managed MDX content.
