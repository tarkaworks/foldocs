import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  type AiStreamEvent,
  createAiClient,
  createAiHandler,
  createSearchRetrievalEnrich,
} from '../src/index.js'

describe('Foldocs AI', () => {
  it('round-trips through a framework-neutral handler', async () => {
    const handler = createAiHandler({
      provider: {
        complete: request =>
          Effect.succeed({
            message: `Answer: ${request.messages.at(-1)?.content ?? ''}`,
            sources: [{ title: 'Guide', url: '/docs/guide' }],
          }),
      },
    })
    const client = createAiClient({
      endpoint: 'https://docs.example.com/api/ai',
      fetch: async (_input, init) =>
        handler(
          new Request('https://docs.example.com/api/ai', {
            ...(init?.method === undefined ? {} : { method: init.method }),
            ...(init?.headers === undefined ? {} : { headers: init.headers }),
            ...(init?.body === undefined ? {} : { body: init.body }),
          }),
        ),
    })
    const result = await Effect.runPromise(
      client.chat({
        messages: [{ role: 'user', content: 'What is Foldocs?' }],
      }),
    )
    expect(result.message).toContain('What is Foldocs?')
    expect(result.sources?.[0]?.url).toBe('/docs/guide')
  })

  it('streams deltas and attaches retrieved sources on the done event', async () => {
    async function* fakeStream(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'delta', content: 'Foldocs is ' }
      yield { type: 'delta', content: 'a documentation framework.' }
      yield { type: 'done' }
    }
    const handler = createAiHandler({
      provider: {
        complete: () =>
          Effect.succeed({ message: 'Foldocs is a documentation framework.' }),
        stream: () => Effect.succeed(fakeStream()),
      },
      enrich: request =>
        Effect.succeed({
          ...request,
          retrieved: [
            {
              title: 'Quick Start',
              url: '/docs',
              content: 'Create a Foldocs application.',
            },
          ],
        }),
    })
    const client = createAiClient({
      endpoint: 'https://docs.example.com/api/ai',
      fetch: async (_input, init) =>
        handler(
          new Request('https://docs.example.com/api/ai', {
            ...(init?.method === undefined ? {} : { method: init.method }),
            ...(init?.headers === undefined ? {} : { headers: init.headers }),
            ...(init?.body === undefined ? {} : { body: init.body }),
          }),
        ),
    })
    const events = await Effect.runPromise(
      client.chatStream!({
        messages: [{ role: 'user', content: 'What is Foldocs?' }],
      }),
    )
    const collected: AiStreamEvent[] = []
    for await (const event of events) collected.push(event)
    expect(collected).toEqual([
      { type: 'delta', content: 'Foldocs is ' },
      { type: 'delta', content: 'a documentation framework.' },
      { type: 'done', sources: [{ title: 'Quick Start', url: '/docs' }] },
    ])
  })

  it('merges retrieved sections into the retrieved field via createSearchRetrievalEnrich', async () => {
    const searchIndex = [
      {
        id: 'en/docs.mdx',
        url: '/en/docs',
        title: 'Quick Start',
        pageTitle: 'Quick Start',
        breadcrumbs: ['Framework'],
        description: 'Create a Foldocs application.',
        content: 'Create a Foldocs application and start authoring docs.',
        locale: 'en',
      },
    ]
    const enrich = createSearchRetrievalEnrich({
      searchIndexUrls: { en: 'https://docs.example.com/en/search-index.json' },
      fetch: async () =>
        new Response(JSON.stringify(searchIndex), { status: 200 }),
    })
    const enriched = await Effect.runPromise(
      enrich({
        messages: [
          { role: 'user', content: 'How do I create an application?' },
        ],
        locale: 'en',
      }),
    )
    expect(enriched.retrieved?.[0]?.url).toBe('/en/docs')
    expect(enriched.retrieved?.[0]?.breadcrumbs).toEqual(['Framework'])
  })
})
