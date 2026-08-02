---
title: Static output
description: Verify every documentation route before deploying it as static assets.
---

# Static output

`pnpm build` compiles content and renders each landing and documentation route
to a directory `index.html`. It also emits Markdown endpoints, localized search
indexes, assets, LLM files, and the sitemap.

## Production checklist

- Set `site.baseUrl` to the canonical production origin.
- Keep `prerender: true` and disable SPA fallback at the host.
- Verify a nested route with JavaScript disabled.
- Request the same route with `Accept: text/markdown`.
- Check canonical, Open Graph, and `hreflang` tags in generated HTML.

Preview the exact `dist` directory with `pnpm preview`; do not use the development
server as deployment verification.
