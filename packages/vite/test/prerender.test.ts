import { buildNavigation, resolveConfig } from 'foldocs-core'
import type { CompiledPage } from 'foldocs-mdx'
import { describe, expect, it } from 'vitest'

import { searchIndexAssetPath } from '../src/index.js'
import {
  type PrerenderPage,
  prerenderRouteHtml,
  routeHtmlFile,
} from '../src/prerender.js'

const compiled: CompiledPage = {
  frontmatter: {
    title: 'Static page',
    description: 'Page-specific description.',
    keywords: ['static', 'docs'],
    socialImage: '/static-page.png',
  },
  document: {
    blocks: [
      {
        _tag: 'Heading',
        id: 'static-content',
        level: 2,
        content: [{ _tag: 'Text', value: 'Static content' }],
      },
      {
        _tag: 'Paragraph',
        content: [{ _tag: 'Text', value: 'Available without JavaScript.' }],
      },
    ],
  },
  toc: [{ id: 'static-content', title: 'Static content', depth: 2 }],
  source: '# Static page',
  plainText: 'Static page Static content Available without JavaScript.',
}

describe('route prerendering', () => {
  it('writes full localized HTML with route metadata', () => {
    const config = resolveConfig({
      site: {
        title: 'Example',
        description: 'Site description.',
        baseUrl: 'https://example.com',
        githubUrl: 'https://github.com/example/docs',
      },
      seo: {
        author: { type: 'Person', name: 'Ada', url: '/about' },
        publisher: { name: 'Example', url: 'https://example.com' },
        twitterSite: '@example',
      },
      i18n: {
        defaultLocale: 'en',
        locales: [
          { locale: 'en', name: 'English' },
          { locale: 'es', name: 'Español' },
        ],
      },
      landing: {
        footer: {
          author: 'Aniket',
          copyright: '© 2026 Tarkaworks',
          twitterUrl: 'https://x.com/tarkaworks',
        },
      },
    })
    const page: PrerenderPage = {
      compiled,
      metadata: {
        id: 'en/static.mdx',
        slug: 'static',
        url: '/en/docs/static',
        file: 'content/docs/en/static.mdx',
        locale: 'en',
        sourceLocale: 'en',
        translationKey: 'static',
        navigationPath: 'static.mdx',
        lastModified: '2026-08-03T12:00:00.000Z',
        frontmatter: compiled.frontmatter,
        toc: compiled.toc,
        plainText: compiled.plainText,
      },
    }
    const navigation = buildNavigation([page.metadata])
    const html = prerenderRouteHtml(
      '<!doctype html><html lang="en"><head><title>Old</title><meta name="description" content="Old"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>',
      config,
      [page],
      { en: navigation, es: navigation },
      { url: page.metadata.url, locale: 'en', page },
    )

    expect(html).toContain('<title>Static page | Example</title>')
    expect(html).toContain('content="Page-specific description."')
    expect(html).toContain('content="https://example.com/static-page.png"')
    expect(html).toContain('property="og:site_name" content="Example"')
    expect(html).toContain('property="og:locale" content="en_US"')
    expect(html).toContain('name="twitter:site" content="@example"')
    expect(html).toContain('name="robots" content="index, follow,')
    expect(html).toContain(
      'property="article:modified_time" content="2026-08-03T12:00:00.000Z"',
    )
    expect(html).toContain('id="foldocs-json-ld"')
    expect(html).toContain('TechArticle')
    expect(html).toContain('BreadcrumbList')
    expect(html).toContain(
      'rel="canonical" href="https://example.com/en/docs/static"',
    )
    expect(html).toContain(
      'hreflang="es" href="https://example.com/es/docs/static"',
    )
    expect(html).toContain(
      '<link rel="alternate" type="text/markdown" href="https://example.com/en/docs/static.md">',
    )
    expect(html).toContain(
      'class="fd-root fd-layout-docs" data-layout="docs" id="root"',
    )
    expect(html).toContain('Available without JavaScript.')
    expect(html).toContain('Built by ')
    expect(html).toContain('Aniket')
    expect(html).toContain('The source code is available on ')
    expect(html).toContain('© 2026 Tarkaworks')
    expect(html).toContain('href="https://x.com/tarkaworks"')
    expect(html).toContain('<script type="module" src="/app.js"></script>')
    expect(html.match(/name="description"/gu)).toHaveLength(1)
  })

  it('maps clean URLs to directory index files', () => {
    expect(routeHtmlFile('/')).toBe('index.html')
    expect(routeHtmlFile('/en/docs/static/')).toBe('en/docs/static/index.html')
    expect(searchIndexAssetPath(false, 'en')).toBe('search-index.json')
    expect(searchIndexAssetPath(true, 'es')).toBe('es/search-index.json')
  })
})
