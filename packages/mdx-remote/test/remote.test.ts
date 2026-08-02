import { Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'

import { createRemoteContentSource, loadRemoteContent } from '../src/index.js'

describe('remote MDX source', () => {
  it('loads and validates wrapped content payloads', async () => {
    const request = vi.fn(async () =>
      Response.json({
        documents: [
          {
            path: 'guides/remote.mdx',
            locale: 'en',
            source: '---\ntitle: Remote\n---\n\n# Remote',
          },
        ],
      }),
    )
    const source = createRemoteContentSource({
      name: 'api',
      url: 'https://content.example.test/docs',
      fetch: request,
      select: payload =>
        (payload as { documents: ReadonlyArray<unknown> }).documents,
    })

    expect((await source.load())[0]?.path).toBe('guides/remote.mdx')
    expect(request).toHaveBeenCalledOnce()
  })

  it('returns a typed Effect failure for invalid responses', async () => {
    const result = await Effect.runPromiseExit(
      loadRemoteContent({
        name: 'api',
        url: 'https://content.example.test/docs',
        fetch: async () => Response.json({ nope: true }),
      }),
    )
    expect(result._tag).toBe('Failure')
  })
})
