import { Option } from 'effect'
import { fromString } from 'foldkit/url'
import { type PageManifest, defaultUiTranslations } from 'foldocs-core'
import type { CompiledPage } from 'foldocs-mdx'
import { describe, expect, it } from 'vitest'

import { createDocsProgram, preloadDocsPage } from '../src/index.js'

const url = (value: string) => Option.getOrThrow(fromString(value))

const compiled: CompiledPage = {
  frontmatter: { title: 'Introduction' },
  document: {
    blocks: [
      {
        _tag: 'Heading',
        id: 'introduction',
        level: 1,
        content: [{ _tag: 'Text', value: 'Introduction' }],
      },
    ],
  },
  toc: [{ id: 'introduction', title: 'Introduction', depth: 1 }],
  source: '# Introduction',
  plainText: 'Introduction',
}

const manifestEntry = (
  pathname: string,
  slug: string,
  locale?: string,
  page?: CompiledPage,
): PageManifest<CompiledPage>[number] => ({
  id: slug || 'index',
  slug,
  url: pathname,
  file: 'index.mdx',
  ...(locale === undefined
    ? {}
    : { locale, sourceLocale: locale, translationKey: slug }),
  frontmatter: { title: 'Introduction' },
  toc: [],
  plainText: 'Introduction',
  load: async () => {
    if (page !== undefined) return { default: page }
    throw new Error('The routing test must not load content.')
  },
})

const i18n = {
  enabled: true,
  defaultLocale: 'en',
  fallbackLocale: 'en',
  parser: 'dir' as const,
  hideLocale: 'never' as const,
  locales: [
    {
      locale: 'en',
      name: 'English',
      dir: 'ltr' as const,
      ui: defaultUiTranslations,
    },
  ],
}

describe('generated homepage routing', () => {
  it('renders the built-in homepage when docs use /docs', () => {
    const program = createDocsProgram({
      manifest: [manifestEntry('/docs', '')],
      site: { title: 'Example docs' },
    })

    const [model] = program.init(url('https://example.com/'))

    expect(model.page._tag).toBe('PageHome')
  })

  it('keeps a root document when basePath is /', () => {
    const program = createDocsProgram({
      manifest: [manifestEntry('/', '')],
      site: { title: 'Example docs' },
    })

    const [model] = program.init(url('https://example.com/'))

    expect(model.page._tag).toBe('PageLoading')
  })

  it('redirects unprefixed routes and renders locale home routes', () => {
    const program = createDocsProgram({
      manifest: [manifestEntry('/en/docs', '', 'en')],
      site: { title: 'Example docs' },
      basePath: '/docs',
      i18n,
    })

    const [redirecting] = program.init(url('https://example.com/docs'))
    const [rootAlias] = program.init(url('https://example.com/'))
    const [home] = program.init(url('https://example.com/en'))

    expect(redirecting.page._tag).toBe('PageLoading')
    expect(redirecting.pathname).toBe('/en/docs')
    expect(redirecting.locale).toBe('en')
    expect(rootAlias.page._tag).toBe('PageHome')
    expect(rootAlias.pathname).toBe('/en')
    expect(home.page._tag).toBe('PageHome')
  })

  it('starts from the current route chunk during the static handoff', async () => {
    const manifest = [manifestEntry('/en/docs', '', 'en', compiled)]
    const preloadedPage = await preloadDocsPage(manifest, i18n, '/docs')
    expect(preloadedPage?.pathname).toBe('/en/docs')

    const program = createDocsProgram({
      manifest,
      site: { title: 'Example docs' },
      basePath: '/docs',
      i18n,
      ...(preloadedPage === undefined ? {} : { preloadedPage }),
    })
    const [model] = program.init(url('https://example.com/docs'))

    expect(model.pathname).toBe('/en/docs')
    expect(model.page._tag).toBe('PageReady')
  })

  it('keeps the homepage visible while the first docs route loads', () => {
    const manifest = [manifestEntry('/en/docs', '', 'en', compiled)]
    const program = createDocsProgram({
      manifest,
      site: { title: 'Example docs' },
      basePath: '/docs',
      i18n,
    })
    const [home] = program.init(url('https://example.com/en'))
    const [transitioning, commands] = program.update(
      home,
      program.routing.onUrlChange(url('https://example.com/en/docs')),
    )

    expect(home.page._tag).toBe('PageHome')
    expect(transitioning.pathname).toBe('/en/docs')
    expect(transitioning.page._tag).toBe('PageHome')
    expect(commands).toHaveLength(2)
  })

  it('keeps the current document visible while the next route chunk loads', async () => {
    const manifest = [
      manifestEntry(
        '/en/docs/getting-started',
        'getting-started',
        'en',
        compiled,
      ),
      manifestEntry('/en/docs/search', 'search', 'en', {
        ...compiled,
        frontmatter: { title: 'Search' },
      }),
    ]
    const preloadedPage = await preloadDocsPage(
      manifest,
      i18n,
      '/en/docs/getting-started',
    )
    const program = createDocsProgram({
      manifest,
      site: { title: 'Example docs' },
      basePath: '/docs',
      i18n,
      ...(preloadedPage === undefined ? {} : { preloadedPage }),
    })
    const [ready] = program.init(
      url('https://example.com/en/docs/getting-started'),
    )
    const [transitioning, commands] = program.update(
      ready,
      program.routing.onUrlChange(url('https://example.com/en/docs/search')),
    )

    expect(transitioning.pathname).toBe('/en/docs/search')
    expect(transitioning.page._tag).toBe('PageReady')
    if (transitioning.page._tag === 'PageReady')
      expect(transitioning.page.page.frontmatter.title).toBe('Introduction')
    expect(commands).toHaveLength(2)
  })
})
