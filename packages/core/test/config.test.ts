import { describe, expect, it } from 'vitest'

import {
  defaultLandingSections,
  defineOgTemplate,
  resolveConfig,
} from '../src/config.js'

describe('landing configuration', () => {
  it('uses a concise default landing composition', () => {
    expect(defaultLandingSections).toEqual([
      'hero',
      'overview',
      'features',
      'cta',
    ])
  })

  it('resolves an author-selected landing composition', () => {
    const config = resolveConfig({
      site: {
        title: 'Docs',
        icons: { rocket: '<svg viewBox="0 0 24 24"></svg>' },
      },
      landing: {
        sections: ['hero', 'features', 'cta'],
        headline: 'Own your documentation.',
        command: 'pnpm create foldocs@latest docs',
        footer: {
          author: 'Aniket',
          copyright: '© 2026 Tarkaworks',
          twitterUrl: 'https://x.com/tarkaworks',
        },
      },
    })
    expect(config.landing).toMatchObject({
      sections: ['hero', 'features', 'cta'],
      headline: 'Own your documentation.',
      command: 'pnpm create foldocs@latest docs',
      footer: {
        author: 'Aniket',
        copyright: '© 2026 Tarkaworks',
        twitterUrl: 'https://x.com/tarkaworks',
      },
    })
    expect(config.site.icons).toEqual({
      rocket: '<svg viewBox="0 0 24 24"></svg>',
    })
  })

  it('requires one unique hero section', () => {
    expect(() =>
      resolveConfig({
        site: { title: 'Docs' },
        landing: { sections: ['features'] },
      }),
    ).toThrow(/must include hero/u)
    expect(() =>
      resolveConfig({
        site: { title: 'Docs' },
        landing: { sections: ['hero', 'hero'] },
      }),
    ).toThrow(/must not contain duplicates/u)
  })
})

describe('Open Graph image configuration', () => {
  it('resolves the standard social image dimensions and custom templates', () => {
    const template = defineOgTemplate(({ title }) => `<div>${title}</div>`)
    const config = resolveConfig({
      site: { title: 'Docs' },
      og: {
        directory: '/social/',
        width: 1600,
        height: 900,
        logoSvg: '<svg viewBox="0 0 10 10"></svg>',
        template,
      },
    })

    expect(config.og).toEqual({
      enabled: true,
      directory: 'social',
      width: 1600,
      height: 900,
      logoSvg: '<svg viewBox="0 0 10 10"></svg>',
      template,
    })
  })

  it('rejects invalid image dimensions', () => {
    expect(() =>
      resolveConfig({ site: { title: 'Docs' }, og: { width: 0 } }),
    ).toThrow(/og\.width must be a positive integer/u)
    expect(() =>
      resolveConfig({ site: { title: 'Docs' }, og: { height: 630.5 } }),
    ).toThrow(/og\.height must be a positive integer/u)
  })
})

describe('SEO configuration', () => {
  it('resolves author, publisher, social accounts, robots, and JSON-LD', () => {
    const config = resolveConfig({
      site: {
        title: 'Docs',
        baseUrl: 'https://docs.example.com',
        favicon: '/favicon.svg',
      },
      seo: {
        titleTemplate: '%s — Docs',
        author: {
          type: 'Person',
          name: 'Ada',
          url: 'https://example.com/ada',
        },
        publisher: { name: 'Example', url: 'https://example.com' },
        twitterSite: '@example',
        robots: { index: false },
      },
    })

    expect(config.seo).toMatchObject({
      titleTemplate: '%s — Docs',
      author: { type: 'Person', name: 'Ada' },
      publisher: { name: 'Example' },
      twitterSite: '@example',
      robots: { index: false, follow: true },
      jsonLd: true,
    })
  })

  it('requires the page-title placeholder', () => {
    expect(() =>
      resolveConfig({
        site: { title: 'Docs' },
        seo: { titleTemplate: 'Docs only' },
      }),
    ).toThrow(/must include `%s`/u)
  })
})
