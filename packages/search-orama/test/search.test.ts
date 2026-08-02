import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import { createOramaSearchClient } from '../src/index.js'

describe('Orama search', () => {
  const client = createOramaSearchClient([
    {
      id: 'scope',
      url: '/docs/scope',
      title: 'Scope',
      description: 'Resource safety',
      content: 'Acquire and release finalizers safely.',
      tags: ['core'],
    },
    {
      id: 'stream',
      url: '/docs/stream',
      title: 'Stream',
      content: 'Process values incrementally.',
      tags: ['data'],
    },
  ])

  it('returns ranked, normalized results', async () => {
    const results = await Effect.runPromise(client.search('resource'))
    expect(results[0]).toMatchObject({
      id: 'scope',
      url: '/docs/scope',
      title: 'Scope',
    })
  })

  it('does not search an empty query', async () => {
    expect(await Effect.runPromise(client.search('  '))).toEqual([])
  })
})
