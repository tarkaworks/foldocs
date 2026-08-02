import { defineConfig, defineContentAdapter } from 'foldocs'

import { spanish } from '@foldocs/language'

const dogfoodRemoteSource = defineContentAdapter('dogfood', async () => [
  {
    path: 'integrations/content/remote-adapter.mdx',
    locale: 'en',
    source: `---
title: Remote and CMS content
description: Load typed Markdown and MDX from HTTP endpoints, Sanity, BaseHub, or custom build-time sources.
order: 6
tags:
  - CMS
  - remote content
---

# Remote and CMS content

This page does not exist on disk. The dogfood site supplies it through a
\`ContentAdapter\`, and the Vite plugin compiles it into an independently lazy
route chunk with the same search, i18n fallback, Markdown, LLM, and prerender output
as filesystem pages.

## First-party sources

- \`@foldocs/mdx-remote\` validates JSON content returned by an HTTP endpoint.
- \`@foldocs/sanity\` maps a typed GROQ query result into virtual files.
- \`@foldocs/basehub\` maps generated BaseHub query data into virtual files.

Every adapter returns a deterministic \`path\`, optional \`locale\`, and Markdown
or MDX \`source\`. Provider SDKs and credentials remain build-time only.
`,
  },
])

export default defineConfig({
  site: {
    title: 'Foldocs',
    description: 'A production documentation framework for Foldkit.',
    baseUrl: 'https://foldocs.vercel.app',
    logoText: 'Foldocs',
    tagline:
      'Beautiful, searchable, LLM-ready documentation for Foldkit, powered by Effect.',
    githubUrl: 'https://github.com/Tarkaworks/foldocs',
    npmUrl: 'https://www.npmjs.com/package/foldocs',
    keywords: ['Foldkit', 'Effect', 'documentation'],
    favicon: '/favicon.svg',
    locale: 'en',
  },
  i18n: {
    defaultLocale: 'en',
    fallbackLocale: 'en',
    locales: [{ locale: 'en', name: 'English' }, spanish()],
  },
  basePath: '/docs',
  layout: { preset: 'docs' },
  landing: {
    sections: ['hero', 'overview', 'features', 'cta'],
    command: 'pnpm create foldocs@latest',
    footer: {
      author: 'Aniket',
      authorUrl: 'https://aniketpawar.com',
      copyright: '© 2026 Tarkaworks',
      twitterUrl: 'https://x.com/tarkaworks',
    },
  },
  content: { dir: 'content/docs', sources: [dogfoodRemoteSource] },
  llms: true,
  markdown: true,
  sitemap: true,
  rss: true,
  og: true,
  prerender: true,
  search: { staticIndex: true },
})
