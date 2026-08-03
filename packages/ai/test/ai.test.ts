import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import { createAiClient, createAiHandler } from '../src/index.js'

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
})
