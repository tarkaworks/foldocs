# Fumadocs parity

Effectdocs follows Fumadocs' product shape and monorepo separation, but targets
Effect and Foldkit exclusively. This document is the release checklist; “partial”
is used where the core exists but Fumadocs still has a broader surface.

| Capability                     | Status       | Effectdocs implementation                                                       |
| ------------------------------ | ------------ | ------------------------------------------------------------------------------- |
| One-command app creation       | Implemented  | `pnpm create effectdocs <dir>` creates one opinionated Foldkit app              |
| Markdown and MDX files         | Implemented  | GFM, YAML, directives, literal MDX components, Shiki                            |
| Filesystem routing             | Implemented  | Nested files and folder `index` pages from `content/docs`                       |
| Typed content validation       | Implemented  | Effect Schema frontmatter, metadata, AST, and compiled pages                    |
| Page tree and sidebar          | Implemented  | Generated folders, labels, ordering, drafts, and hidden pages                   |
| Generated homepage             | Implemented  | Separate Foldkit-style `/` landing when documentation is mounted under `/docs`  |
| Documentation UI               | Implemented  | Foldkit-style fixed shell, responsive TOC, full-screen mobile nav, pager/footer |
| Theme support                  | Implemented  | Flash-free Light/System/Dark selector, OS synchronization, and persistence      |
| Code presentation              | Implemented  | Shiki, line numbers, language labels, and clipboard copy feedback               |
| Local search                   | Implemented  | Orama default and optional FlexSearch package                                   |
| Hosted search clients          | Implemented  | Separate Algolia, Orama Cloud, Mixedbread, Typesense, and Trieve adapters       |
| LLM output                     | Implemented  | Build-time `llms.txt` and `llms-full.txt`                                       |
| Per-page Markdown URLs         | Implemented  | `<page>.md` assets, dev serving, content negotiation, copy/view page actions    |
| SEO output                     | Partial      | Canonical, sitemap, locale, favicon, keywords, Open Graph, and Twitter defaults |
| Content validation             | Implemented  | `effectdocs check` compiles all pages and validates routes/anchors              |
| HMR                            | Implemented  | Page and virtual-manifest invalidation in the Vite plugin                       |
| Custom MDX components          | Partial      | Renderer registry exists; public program-level registration API remains         |
| Search UX                      | Implemented  | Combobox/listbox semantics, loading states, live results, arrows, Enter/Escape  |
| Internationalization           | Planned      | Locale exists in search contracts; routed locale trees remain                   |
| Versioned documentation        | Planned      | Version switcher and multi-tree routing remain                                  |
| Hosted search ingestion        | Planned      | Client adapters exist; provider-specific sync pipelines remain                  |
| Static export/prerender        | Planned      | Vite SPA build works; per-route HTML generation remains                         |
| OpenAPI/API reference          | Planned      | No OpenAPI or TypeScript API generator package yet                              |
| CMS/remote content sources     | Planned      | Content source contract exists; first-party adapters remain                     |
| Multiple layout presets        | Planned      | One production docs layout today                                                |
| Framework compatibility layers | Out of scope | Effect/Foldkit/Vite are intentional fixed choices                               |
| Arbitrary MDX JavaScript       | Out of scope | Rejected for deterministic, indexable, typed Foldkit content                    |

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

The remaining reference-level gaps are explicit:

- per-route prerendered HTML and a generated static search index;
- page-specific descriptions and social images rather than site-wide head defaults;
- fully managed dialog focus cycling beyond focus-on-open and inert backgrounds;
- automated browser end-to-end tests in CI;
- author-configurable landing-page section composition beyond the built-in layout.

Foldkit's newsletter, site analytics, star count, custom fonts, and framework API
reference pipeline are product-specific integrations, not Effectdocs core features.
