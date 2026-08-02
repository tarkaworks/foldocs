import { Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'

import { createAlgoliaSearchClient, syncAlgoliaSearch } from '../src/index.js'

describe('Algolia adapter', () => {
  it('maps Algolia hits and forwards filters', async () => {
    const searchForHits = vi.fn(async () => ({
      results: [
        {
          hits: [
            {
              objectID: 'effect',
              url: '/docs/effect',
              title: 'Effect',
              description: 'Typed computations',
            },
          ],
        },
      ],
    }))
    const client = createAlgoliaSearchClient({
      client: { searchForHits },
      indexName: 'docs',
    })
    const results = await Effect.runPromise(
      client.search('typed', { locale: 'en', tags: ['core'] }),
    )
    expect(results[0]).toMatchObject({ id: 'effect', title: 'Effect' })
    expect(searchForHits).toHaveBeenCalledWith(
      expect.objectContaining({
        requests: [
          expect.objectContaining({ indexName: 'docs', query: 'typed' }),
        ],
      }),
    )
  })

  it('configures and replaces the hosted index', async () => {
    const setSettings = vi.fn(async () => undefined)
    const replaceAllObjects = vi.fn(async () => undefined)
    const report = await Effect.runPromise(
      syncAlgoliaSearch(
        {
          client: { setSettings, replaceAllObjects },
          indexName: 'docs',
        },
        [
          {
            id: 'en/intro',
            url: '/en/docs/intro',
            title: 'Introduction',
            content: 'Typed documentation',
            locale: 'en',
          },
        ],
      ),
    )

    expect(setSettings).toHaveBeenCalledOnce()
    expect(replaceAllObjects).toHaveBeenCalledWith({
      indexName: 'docs',
      objects: [
        expect.objectContaining({
          objectID: 'en/intro',
          locale: 'en',
        }),
      ],
    })
    expect(report.documents).toBe(1)
  })
})
