import { describe, expect, it, vi } from 'vitest'

import {
  type SanityClientLike,
  createSanityContentSource,
} from '../src/index.js'

describe('Sanity content source', () => {
  it('maps a GROQ result to virtual MDX files', async () => {
    const fetchCalls = vi.fn()
    const client: SanityClientLike = {
      async fetch<Result>(
        query: string,
        params?: Readonly<Record<string, unknown>>,
        options?: Readonly<Record<string, unknown>>,
      ) {
        fetchCalls(query, params, options)
        return [
          { slug: 'intro', title: 'Introduction', body: 'Welcome' },
        ] as unknown as Result
      },
    }
    const source = createSanityContentSource({
      client,
      query: '*[_type == "docs"]',
      map: (record: { slug: string; title: string; body: string }) => ({
        path: `${record.slug}.mdx`,
        source: `---\ntitle: ${record.title}\n---\n\n${record.body}`,
      }),
    })

    expect(await source.load()).toEqual([
      expect.objectContaining({ path: 'intro.mdx' }),
    ])
    expect(fetchCalls).toHaveBeenCalledWith(
      '*[_type == "docs"]',
      undefined,
      undefined,
    )
  })
})
