# Architecture

Foldocs keeps authoring, compilation, runtime, UI, and integrations in separate
packages from the beginning. The default experience is opinionated, while the
package graph avoids making every user install every provider.

```text
Markdown / deterministic MDX
          │
          ▼
 foldocs-mdx ──────► typed document AST
          │
          ▼
 @foldocs/vite ────► virtual:foldocs manifest ───► lazy page chunks
          │                                                │
          ├──► page.md / llms*.txt / sitemap.xml            ▼
          │                                         foldocs program
          │                                                │
          ▼                                                ▼
 eager metadata ─► navigation + local/hosted search ─► foldocs-ui
                                                       Foldkit HTML
```

## Runtime

`createDocsProgram` produces the Effect Schema model and message union plus the
Foldkit `init`, `update`, `view`, and routing configuration. Page loading,
navigation, search, and theme persistence are Foldkit commands backed by Effect.
Viewport and active-heading subscriptions keep mobile navigation and both table-of-
contents variants synchronized without component-local state.

When i18n is enabled, unprefixed routes redirect to the default locale. Each locale
gets a landing route such as `/en`, and documentation is mounted at routes such as
`/en/docs`. Projects without `i18n` retain the original unprefixed routing behavior.

Only page metadata is eager. Compiled page bodies are imported by route, so adding
documents does not place the entire documentation corpus in the initial JavaScript
chunk. By default, searchable text is removed from the client manifest and Vite
emits a per-locale JSON index that Orama fetches on first use. Disabling the static
index restores the eager in-bundle fallback. The runtime imports document schemas
from `foldocs-mdx/ast`, keeping unified, remark, YAML, and Shiki compiler modules
out of the browser graph.
Directory `meta.json` files and parenthesized route groups are compiled into that
eager navigation tree, including group labels, descriptions, ordering, roots, and
default-open state. Root folders become layout tabs: only the active root is sent
to the sidebar and pager, which supports isolated sections and partial versioning.
Each locale has its own metadata tree. Missing documents are inherited from the
configured fallback locale while keeping the requested locale URL and search scope.

## Content safety

Foldocs supports Markdown, GFM, YAML frontmatter, directives, literal MDX
attributes, and registered components. Arbitrary MDX JavaScript expressions, ESM,
raw HTML, spread props, and unsafe URL schemes are rejected during compilation.
Interactive behavior belongs in typed Foldkit models and messages rather than code
executed from documentation files.

Filesystem documents and build-time `ContentAdapter` sources enter the same compiler
pipeline. Remote modules are exposed as separate Vite virtual modules, preserving
route-level lazy loading instead of embedding the CMS corpus into the main client
manifest. `@foldocs/mdx-remote`, `@foldocs/sanity`, and `@foldocs/basehub` normalize
provider data while credentials and SDKs remain on the build side.

## Search

`@foldocs/search` is a small Effect interface. The generated app constructs an
Orama index in the browser by default. FlexSearch is an alternative local engine.
Hosted adapters are separate packages, and `createDocsProgram({ search })` accepts
any of them without changing the docs runtime.

Provider admin keys and ingestion jobs must run on a server or in CI. Browser-side
adapters should receive search-only credentials or call a server endpoint; the
Trieve adapter deliberately accepts a callback to make that boundary explicit.
`@foldocs/search/sync` loads the same per-locale JSON snapshots used by local search,
then the shared Effect indexer contract validates and replaces the hosted corpus.
Algolia, Orama Cloud, and Typesense provide native writers; Trieve and Mixedbread
use private replacement callbacks to keep account-specific ingestion code isolated.

## API references

`@foldocs/openapi` is a build-time-only package that accepts OpenAPI 3.x or
Swagger YAML/JSON from disk, URLs, or memory. It emits deterministic MDX operation
pages and root navigation metadata, so generated API references automatically join
the normal routing, locale fallback, search, Markdown, LLM, sitemap, and prerender
pipelines without shipping the parser in the browser.

`@foldocs/asyncapi` follows the same boundary for AsyncAPI 2 channel operations
and AsyncAPI 3 operations, emitting message payload/header schemas, examples, and
protocol bindings into the same content pipeline.

`@foldocs/typescript` emits declarations through the TypeScript compiler and
`@foldocs/python` extracts public signatures/docstrings through Python's AST without
importing application modules. `@foldocs/twoslash` is another build-only boundary:
it augments explicitly marked code fences through Shiki while keeping TypeScript and
Twoslash out of the browser runtime.

## Portable content

`@foldocs/epub` consumes the compiled document AST rather than browser HTML. It
emits an EPUB 3 ZIP with the required uncompressed leading media type, package
manifest, navigation document, spine, styles, XHTML chapters, and local assets with
rewritten chapter-relative references.

`@foldocs/obsidian` is an import boundary. It converts wiki links and fragments,
embeds, comments, and block identifiers, relocates attachments, and records a
managed manifest so later imports remove only stale generated files. The resulting
MDX enters the normal validation and build pipeline.

Filesystem attachments remain outside the JavaScript graph. The Vite plugin serves
them from their localized document URLs in development and emits them as static
assets in production. A locale inherits missing attachments from the configured
fallback locale just as it inherits pages.

## Browser and build output

The generated HTML initializes the persisted theme before the application mounts.
The Vite plugin injects configured description, keyword, favicon, Open Graph, and
Twitter defaults, keeps production CSS render-blocking on Safari tab restoration,
and sets the default document locale. The runtime updates `<html lang>` and `dir`,
canonical/Open Graph URLs, and `hreflang`/`x-default` alternate links on navigation.

Every document is serialized from the typed AST into processed Markdown. The Vite
development and preview servers expose it by appending `.md` to the page URL and
also honor `Accept: text/markdown`, `text/plain`, and `text/x-markdown`. Production
builds emit the same sibling `.md` assets, while the page UI fetches those URLs for
Copy Markdown and links to them for View as Markdown.

After Vite writes the client bundle, Foldocs serializes the same Foldkit layout and
typed document AST into a directory `index.html` for every landing and documentation
route. Each file receives its own title, description, keywords, social image,
canonical URL, and locale alternates. The client bundle then progressively replaces
the static VNode tree, preserving the normal Effect-powered runtime.

Localized builds produce the same Markdown routes for fallback pages, per-locale
`llms.txt` and `llms-full.txt` corpora, and a sitemap containing every locale route
with reciprocal alternates. Search documents carry their route locale, so both the
local engines and hosted adapters filter results to the active language.

The Foldkit-style layout uses semantic combobox/listbox search, skip navigation,
inert off-canvas content, persisted collapsible sidebar groups, a full-screen mobile
navigation dialog, three-way theme preference, active-section observation, and
safe-area-aware fixed surfaces. Highlighted code is decorated with visual line
numbers during compilation; language and clipboard controls are rendered without a
client-side syntax-highlighting pass.
