# Fumadocs parity

Foldocs follows Fumadocs' product shape and monorepo separation, but targets
Foldkit exclusively and uses Effect as its runtime. This document is the release checklist; “partial”
is used where the core exists but Fumadocs still has a broader surface.

| Capability                     | Status       | Foldocs implementation                                                             |
| ------------------------------ | ------------ | ---------------------------------------------------------------------------------- |
| One-command app creation       | Implemented  | `pnpm create foldocs <dir>` creates one opinionated Foldkit app                    |
| Markdown and MDX files         | Implemented  | GFM, YAML, directives, literal MDX components, Shiki                               |
| Filesystem routing             | Implemented  | Nested files and folder `index` pages from locale content trees                    |
| Typed content validation       | Implemented  | Effect Schema frontmatter, metadata, AST, and compiled pages                       |
| Page tree and sidebar          | Implemented  | Generated folders, roots, labels, ordering, drafts, and hidden pages               |
| Generated homepage             | Implemented  | Locale landing routes with default-locale redirects                                |
| Documentation UI               | Implemented  | Foldkit-style fixed shell, responsive TOC, full-screen mobile nav, pager/footer    |
| Theme support                  | Implemented  | Flash-free Light/System/Dark selector, OS synchronization, and persistence         |
| Code presentation              | Implemented  | Shiki, line numbers, language labels, and clipboard copy feedback                  |
| Local search                   | Implemented  | Lazy per-locale Orama index and optional FlexSearch package                        |
| Hosted search clients          | Implemented  | Separate Algolia, Orama Cloud, Mixedbread, Typesense, and Trieve adapters          |
| LLM output                     | Implemented  | Root compatibility files plus per-locale `llms.txt` and `llms-full.txt`            |
| Per-page Markdown URLs         | Implemented  | `<page>.md` assets, dev serving, content negotiation, copy/view page actions       |
| SEO output                     | Implemented  | Per-route metadata/social images, canonical, sitemap, alternates, Open Graph       |
| Content validation             | Implemented  | `foldocs check` validates locale routes, fallback pages, links, and anchors        |
| HMR                            | Implemented  | Page and virtual-manifest invalidation in the Vite plugin                          |
| Custom MDX components          | Implemented  | Public typed renderer registry shared by runtime, prerenderer, and generated app   |
| Search UX                      | Implemented  | Combobox/listbox semantics, loading states, live results, arrows, Enter/Escape     |
| Internationalization           | Implemented  | Locale trees/routes, switcher, UI strings, search, fallback, Markdown, LLM, SEO    |
| Language packs                 | Implemented  | Typed Spanish and Simplified/Traditional Chinese UI translation presets            |
| Versioned documentation        | Implemented  | Localized root-folder tabs isolate version trees, sidebars, and pagination         |
| Hosted search ingestion        | Implemented  | Static corpus loader plus Algolia, Orama Cloud, Typesense, Trieve, Mixedbread sync |
| Static export/prerender        | Implemented  | Full Foldkit layout/content and route metadata emitted to directory HTML           |
| OpenAPI/API reference          | Implemented  | Separate generator emits operation MDX, schemas, samples, responses, and roots     |
| CMS/remote content sources     | Implemented  | Lazy virtual MDX plus HTTP, Sanity, BaseHub, and custom build-time adapters        |
| Multiple layout presets        | Implemented  | Docs, notebook, flux, and glass compositions share one accessible Foldkit shell    |
| AsyncAPI reference             | Implemented  | Separate 2.x/3.x generator emits messages, payloads, bindings, examples, and roots |
| TypeScript/Python docgen       | Implemented  | Compiler declarations and safe Python AST extraction generate managed MDX roots    |
| Twoslash                       | Implemented  | Explicit code fences receive build-time type hovers and diagnostics through Shiki  |
| EPUB export                    | Implemented  | EPUB 3 package, navigation, spine, XHTML, embedded assets, metadata, styles, CLI   |
| Obsidian/content adapters      | Implemented  | Managed wiki-link/embed migration plus remote MDX, BaseHub, and Sanity adapters    |
| Content attachments            | Implemented  | Local assets are served in dev and emitted per locale with fallback inheritance    |
| UI customization CLI           | Implemented  | `foldocs customize` copies theme, layout, and typed MDX component source           |
| Framework compatibility layers | Out of scope | Foldkit, Effect, and Vite are intentional fixed choices                            |
| Arbitrary MDX JavaScript       | Out of scope | Rejected for deterministic, indexable, typed Foldkit content                       |

“Implemented” means the capability is usable in the dogfood application and covered
by build, test, or browser verification. It does not mean API stability before the
first public release.

## Foldkit website reference audit

The default layout now adopts the reusable production patterns and visual language
from Foldkit's own website: its cream/charcoal/green palette, fixed header and
three-column documentation frame, collapsible sidebar section bars, safe-area
offsets, pre-paint theme initialization, active-section observation, a mobile TOC,
full-screen mobile navigation, understated pagination, code copy controls, and
accessible keyboard search. Each route also follows Foldkit's appended `.md`
convention, with Fumadocs-style Copy Markdown and View as Markdown actions. A
separate generated landing page follows the default Fumadocs routing shape while
remaining visually consistent with Foldkit.

Dialog focus is cycled inside the active modal and restored to its trigger on close.
The generated landing page supports selected section composition plus custom hero
copy and install commands. Browser end-to-end coverage runs the production preview
in CI across desktop and mobile viewports.

Foldkit's newsletter, site analytics, star count, custom fonts, and framework API
reference pipeline are product-specific integrations, not Foldocs core features.

## Package-boundary audit

Fumadocs packages that represent product behavior have a direct package or a
Foldkit-native boundary: core/runtime, UI, MDX/local content, Vite, CLI/scaffold,
OpenAPI, AsyncAPI, TypeScript, Python, Twoslash, EPUB, Obsidian, remote MDX,
Sanity, BaseHub, Tailwind, and language packs. Fumadocs' `local-content`,
`local-md`, `api-docs`, and `doc-gen` responsibilities are intentionally folded
into Foldocs' MDX/Vite and reference-generator packages instead of publishing
empty aliases.

React renderer alternatives (`base-ui`, `radix-ui`), React story controls,
Shadcn registry helpers, Content Collections/Contentlayer adapters, and
framework-specific Next.js/React Router/TanStack/Astro/Waku packages are
compatibility layers, so they are intentionally replaced by the single Foldkit
runtime, typed MDX component registry, and build-time `ContentAdapter` contract.
Repository-internal Fumadocs packages such as shared tsconfig/build utilities are
not public product capabilities.
