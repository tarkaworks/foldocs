import { describe, expect, it } from 'vitest'

import { resolveConfig } from '../src/config.js'
import {
  buildSeoJsonLd,
  formatSeoTitle,
  openGraphLocale,
  robotsContent,
  serializeJsonLd,
} from '../src/seo.js'

describe('SEO metadata', () => {
  const config = resolveConfig({
    site: {
      title: 'Foldocs',
      description: 'Documentation framework.',
      baseUrl: 'https://docs.example.com',
      favicon: '/favicon.svg',
      githubUrl: 'https://github.com/example/docs',
    },
    seo: {
      author: { type: 'Person', name: 'Ada', url: '/about' },
      publisher: { name: 'Example', url: 'https://example.com' },
    },
  })

  it('formats titles, locales, and crawler directives', () => {
    expect(formatSeoTitle('Quick Start', 'Foldocs', '%s | Foldocs')).toBe(
      'Quick Start | Foldocs',
    )
    expect(formatSeoTitle('Foldocs', 'Foldocs', '%s | Foldocs')).toBe('Foldocs')
    expect(openGraphLocale('en')).toBe('en_US')
    expect(robotsContent(config.seo)).toContain('max-image-preview:large')
  })

  it('builds a linked website, article, image, and breadcrumb graph', () => {
    const graph = buildSeoJsonLd({
      kind: 'page',
      site: config.site,
      seo: config.seo,
      title: 'Quick <Start>',
      description: 'Start here.',
      url: '/en/docs',
      image: '/og/en/index.png',
      locale: 'en',
      locales: ['en', 'es'],
      lastModified: '2026-08-03T12:00:00.000Z',
      keywords: ['docs', 'foldkit'],
      breadcrumbs: [
        { name: 'Foldocs', url: '/en' },
        { name: 'Quick Start', url: '/en/docs' },
      ],
    })
    const serialized = serializeJsonLd(graph!)

    expect(serialized).toContain('TechArticle')
    expect(serialized).toContain('BreadcrumbList')
    expect(serialized).toContain('https://docs.example.com/og/en/index.png')
    expect(serialized).toContain('\\u003cStart')
    expect(serialized).not.toContain('<Start')
  })
})
