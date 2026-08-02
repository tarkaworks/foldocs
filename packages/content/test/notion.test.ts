import { describe, expect, it } from 'vitest'

import { type NotionClientLike, notion } from '../src/index.js'

describe('notion content adapter', () => {
  it('queries a data source and converts nested blocks into MDX', async () => {
    const client: NotionClientLike = {
      dataSources: {
        query: async () => ({
          results: [
            {
              id: 'page-1',
              last_edited_time: '2026-08-01T10:00:00.000Z',
              properties: {
                Name: { title: [{ plain_text: 'Effect services' }] },
                Slug: { rich_text: [{ plain_text: 'effect-services' }] },
                Tags: {
                  multi_select: [{ name: 'Effect' }, { name: 'Services' }],
                },
              },
            },
          ],
        }),
      },
      blocks: {
        children: {
          list: async ({ block_id }) =>
            block_id === 'page-1'
              ? {
                  results: [
                    {
                      id: 'heading',
                      type: 'heading_2',
                      heading_2: { rich_text: [{ plain_text: 'Overview' }] },
                    },
                    {
                      id: 'paragraph',
                      type: 'paragraph',
                      paragraph: {
                        rich_text: [{ plain_text: 'Typed dependencies.' }],
                      },
                    },
                  ],
                }
              : { results: [] },
        },
      },
    }

    const [file] = await notion({ client, dataSourceId: 'source-1' }).load()
    expect(file?.path).toBe('effect-services.mdx')
    expect(file?.lastModified).toBe('2026-08-01T10:00:00.000Z')
    expect(file?.source).toContain('title: "Effect services"')
    expect(file?.source).toContain('tags: ["Effect","Services"]')
    expect(file?.source).toContain('## Overview')
    expect(file?.source).toContain('Typed dependencies.')
  })
})
