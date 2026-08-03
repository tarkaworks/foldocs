import { describe, expect, it } from 'vitest'

import {
  type PageManifestEntry,
  defineLoaderPlugin,
  defineStaticSource,
  dynamicLoader,
  loader,
} from '../src/index.js'

const page = (slug: string, locale = 'en'): PageManifestEntry<string> => ({
  id: `${locale}/${slug || 'index'}.mdx`,
  slug,
  url: `/${locale}/docs${slug.length === 0 ? '' : `/${slug}`}`,
  file: `${locale}/${slug || 'index'}.mdx`,
  locale,
  frontmatter: { title: slug || 'Home' },
  toc: [],
  plainText: slug,
  load: async () => ({ default: slug }),
})

describe('source loader', () => {
  it('provides pages, trees, language entries, node lookups, and plugins', () => {
    const source = defineStaticSource([
      { type: 'page', path: 'en/index.mdx', data: page('') },
      { type: 'page', path: 'en/guides/start.mdx', data: page('guides/start') },
      {
        type: 'meta',
        path: 'guides/meta.json',
        data: { title: 'Guides', collapsible: false },
      },
    ])
    const docs = loader({
      source,
      plugins: [
        defineLoaderPlugin({
          transformPageTree: tree =>
            tree.map(node =>
              node._tag === 'Folder' ? { ...node, label: 'Learn' } : node,
            ),
        }),
      ],
    })

    expect(docs.getPage(['guides', 'start'], 'en')?.slug).toBe('guides/start')
    expect(docs.getPages('en')).toHaveLength(2)
    expect(docs.getPageTree('en')).toMatchObject([
      { _tag: 'Page', label: 'Home' },
      { _tag: 'Folder', label: 'Learn', collapsible: false },
    ])
    expect(docs.getLanguages()).toHaveLength(1)
    expect(docs.generateParams()).toContainEqual({
      slug: ['guides', 'start'],
      lang: 'en',
    })
  })

  it('caches, invalidates, and revalidates dynamic sources', async () => {
    let calls = 0
    const docs = dynamicLoader({
      files: async () => {
        calls += 1
        return [{ type: 'page', path: 'en/index.mdx', data: page('') }]
      },
    })

    await docs.get()
    await docs.get()
    expect(calls).toBe(1)
    docs.invalidate()
    await docs.get()
    expect(calls).toBe(2)
    await docs.revalidate()
    expect(calls).toBe(3)
  })
})
