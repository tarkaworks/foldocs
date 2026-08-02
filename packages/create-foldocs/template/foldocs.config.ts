import { defineConfig } from 'foldocs'

import { spanish } from '@foldocs/language'

export default defineConfig({
  site: {
    title: 'Foldocs',
    description: 'Production documentation for Foldkit, powered by Effect.',
    baseUrl: 'https://example.com',
    logoText: 'Foldocs',
    tagline:
      'Beautiful, searchable, LLM-ready documentation for Foldkit, powered by Effect.',
    githubUrl: 'https://github.com/Aniket-508/foldocs',
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
    sections: ['hero', 'overview', 'stack', 'features', 'ai', 'proof', 'cta'],
    command: 'pnpm create foldocs@latest',
  },
  content: { dir: 'content/docs' },
  llms: true,
  markdown: true,
  sitemap: true,
  prerender: true,
  search: { staticIndex: true },
})
