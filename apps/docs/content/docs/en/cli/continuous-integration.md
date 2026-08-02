---
title: Continuous integration
description: Validate content, types, tests, and static output before deployment.
---

# Continuous integration

Run content validation before the production build so authors receive focused
file and link errors.

```yaml
- run: pnpm install --frozen-lockfile
- run: pnpm foldocs check --locales en,es --fallback-locale en
- run: pnpm typecheck
- run: pnpm test
- run: pnpm build
```

## Build guarantees

The Vite build produces static HTML routes, per-page `.md` resources, locale
search indexes, sitemap entries, and LLM corpus files. Browser tests should run
against the built preview rather than the development server.

## Deployment

Upload the generated `dist` directory to static hosting, or use the Alchemy
deployment added by `--deployment cloudflare`. The same output can be served by
Vercel without a server runtime.

## Suggested workflow

Install with a frozen lockfile, run formatting and lint checks, validate docs,
type-check packages, execute tests, build, and finally run browser tests against
the production preview.
