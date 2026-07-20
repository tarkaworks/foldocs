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
          ├──► page.md / llms*.txt / sitemap.xml            ▼
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
Viewport and active-heading subscriptions keep mobile navigation and both table-of-
contents variants synchronized without component-local state.

When docs use the default `/docs` base path, `/` is a first-class generated landing
state rather than a failed document lookup. Projects that set `basePath: "/"` keep
their root Markdown page, so the behavior is deterministic and does not reserve a
route the author explicitly chose for content.

Only page metadata is eager. Compiled page bodies are imported by route, so adding
documents does not place the entire documentation corpus in the initial JavaScript
chunk. Local search uses the eager plain-text metadata and does not fetch page chunks.
Directory `meta.json` files and parenthesized route groups are compiled into that
eager navigation tree, including group labels, ordering, and default-open state.

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

## Browser and build output

The generated HTML initializes the persisted theme before the application mounts.
The Vite plugin injects configured description, keyword, favicon, Open Graph, and
Twitter defaults, keeps production CSS render-blocking on Safari tab restoration,
and sets the configured document locale. Foldkit owns per-route titles, canonical
URLs, and Open Graph URLs at runtime.

Every document is serialized from the typed AST into processed Markdown. The Vite
development and preview servers expose it by appending `.md` to the page URL and
also honor `Accept: text/markdown`, `text/plain`, and `text/x-markdown`. Production
builds emit the same sibling `.md` assets, while the page UI fetches those URLs for
Copy Markdown and links to them for View as Markdown.

The Foldkit-style layout uses semantic combobox/listbox search, skip navigation,
inert off-canvas content, persisted collapsible sidebar groups, a full-screen mobile
navigation dialog, three-way theme preference, active-section observation, and
safe-area-aware fixed surfaces. Highlighted code is decorated with visual line
numbers during compilation; language and clipboard controls are rendered without a
client-side syntax-highlighting pass.
