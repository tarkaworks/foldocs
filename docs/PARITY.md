# Fumadocs parity

Effectdocs follows Fumadocs' product shape and monorepo separation, but targets
Effect and Foldkit exclusively. This document is the release checklist; “partial”
is used where the core exists but Fumadocs still has a broader surface.

| Capability                     | Status       | Effectdocs implementation                                                     |
| ------------------------------ | ------------ | ----------------------------------------------------------------------------- |
| One-command app creation       | Implemented  | `pnpm create effectdocs <dir>` creates one opinionated Foldkit app            |
| Markdown and MDX files         | Implemented  | GFM, YAML, directives, literal MDX components, Shiki                          |
| Filesystem routing             | Implemented  | Nested files and folder `index` pages from `content/docs`                     |
| Typed content validation       | Implemented  | Effect Schema frontmatter, metadata, AST, and compiled pages                  |
| Page tree and sidebar          | Implemented  | Generated folders, labels, ordering, drafts, and hidden pages                 |
| Documentation UI               | Implemented  | Responsive header/sidebar/TOC/footer/pager/search shell                       |
| Theme support                  | Implemented  | Light/dark theme, system default, and local persistence                       |
| Local search                   | Implemented  | Orama default and optional FlexSearch package                                 |
| Hosted search clients          | Implemented  | Separate Algolia, Orama Cloud, Mixedbread, Typesense, and Trieve adapters     |
| LLM output                     | Implemented  | Build-time `llms.txt` and `llms-full.txt`                                     |
| SEO output                     | Partial      | Canonicals and sitemap; broader metadata/Open Graph APIs remain               |
| Content validation             | Implemented  | `effectdocs check` compiles all pages and validates routes/anchors            |
| HMR                            | Implemented  | Page and virtual-manifest invalidation in the Vite plugin                     |
| Custom MDX components          | Partial      | Renderer registry exists; public program-level registration API remains       |
| Search UX                      | Partial      | Dialog, filtering, and stale-result safety; keyboard result selection remains |
| Internationalization           | Planned      | Locale exists in search contracts; routed locale trees remain                 |
| Versioned documentation        | Planned      | Version switcher and multi-tree routing remain                                |
| Hosted search ingestion        | Planned      | Client adapters exist; provider-specific sync pipelines remain                |
| Static export/prerender        | Planned      | Vite SPA build works; per-route HTML generation remains                       |
| OpenAPI/API reference          | Planned      | No OpenAPI or TypeScript API generator package yet                            |
| CMS/remote content sources     | Planned      | Content source contract exists; first-party adapters remain                   |
| Multiple layout presets        | Planned      | One production docs layout today                                              |
| Framework compatibility layers | Out of scope | Effect/Foldkit/Vite are intentional fixed choices                             |
| Arbitrary MDX JavaScript       | Out of scope | Rejected for deterministic, indexable, typed Foldkit content                  |

“Implemented” means the capability is usable in the dogfood application and covered
by build, test, or browser verification. It does not mean API stability before the
first public release.
