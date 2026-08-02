import { describe, expect, it } from 'vitest'

import { createBaseHubContentSource } from '../src/index.js'

describe('BaseHub content source', () => {
  it('maps generated query data to localized virtual files', async () => {
    const source = createBaseHubContentSource({
      query: async () => ({ docs: [{ slug: 'intro', body: 'Welcome' }] }),
      select: result => result.docs,
      map: record => ({
        path: `${record.slug}.mdx`,
        locale: 'en',
        source: `---\ntitle: Introduction\n---\n\n${record.body}`,
      }),
    })

    expect(await source.load()).toEqual([
      expect.objectContaining({ path: 'intro.mdx', locale: 'en' }),
    ])
  })
})
