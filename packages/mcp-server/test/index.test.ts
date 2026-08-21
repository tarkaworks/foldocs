import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

import { createFoldocsMcpServer } from '../src/index.js'

const manifest = {
  name: 'Foldocs',
  description: 'Docs site.',
  site: 'https://docs.example.com',
  artifacts: {
    searchIndex: {
      en: 'https://docs.example.com/en/search-index.json',
    },
  },
  pages: [{ title: 'Quick Start', url: '/en/docs' }],
  tools: [],
}

const searchIndex = [
  {
    id: 'en/docs.mdx',
    url: '/en/docs',
    title: 'Quick Start',
    type: 'page',
    pageId: 'en/docs.mdx',
    pageTitle: 'Quick Start',
    breadcrumbs: ['Framework'],
    description: 'Create a Foldocs application.',
    content: 'Create a Foldocs application and start authoring documentation.',
    locale: 'en',
  },
  {
    id: 'en/docs/cli.mdx',
    url: '/en/docs/cli',
    title: 'CLI',
    type: 'page',
    pageId: 'en/docs/cli.mdx',
    pageTitle: 'CLI',
    breadcrumbs: ['CLI'],
    description: 'Command line interface.',
    content: 'Run foldocs commands from your terminal.',
    locale: 'en',
  },
]

const connectedClient = async () => {
  const server = createFoldocsMcpServer({ baseUrl: 'https://docs.example.com' })
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ])
  return client
}

describe('createFoldocsMcpServer', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/agent-readability.json'))
          return new Response(JSON.stringify(manifest), { status: 200 })
        if (url.endsWith('/en/search-index.json'))
          return new Response(JSON.stringify(searchIndex), { status: 200 })
        if (url === 'https://docs.example.com/en/docs')
          return new Response(
            '# Quick Start\n\nCreate a Foldocs application.',
            {
              status: 200,
            },
          )
        return new Response('Not found', { status: 404 })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists the expected tool surface', async () => {
    const client = await connectedClient()
    const { tools } = await client.listTools()
    expect(tools.map(tool => tool.name).toSorted()).toEqual([
      'get_page',
      'get_site_info',
      'list_sections',
      'search_docs',
    ])
  })

  it('ranks search_docs results using the published search index', async () => {
    const client = await connectedClient()
    const result = await client.callTool({
      name: 'search_docs',
      arguments: { query: 'foldocs application' },
    })
    const content = (result.content as Array<{ text: string }>)[0]?.text ?? ''
    const results = JSON.parse(content) as ReadonlyArray<{ url: string }>
    expect(results[0]?.url).toBe('/en/docs')
  })

  it('groups list_sections by top-level breadcrumb', async () => {
    const client = await connectedClient()
    const result = await client.callTool({
      name: 'list_sections',
      arguments: {},
    })
    const content = (result.content as Array<{ text: string }>)[0]?.text ?? ''
    const sections = JSON.parse(content) as ReadonlyArray<{
      section: string
      pages: ReadonlyArray<{ title: string; url: string }>
    }>
    expect(sections.map(section => section.section).toSorted()).toEqual([
      'CLI',
      'Framework',
    ])
  })

  it('fetches page content as markdown via get_page', async () => {
    const client = await connectedClient()
    const result = await client.callTool({
      name: 'get_page',
      arguments: { url: 'https://docs.example.com/en/docs' },
    })
    const content = (result.content as Array<{ text: string }>)[0]?.text ?? ''
    expect(content).toContain('# Quick Start')
  })

  it('reports site metadata via get_site_info', async () => {
    const client = await connectedClient()
    const result = await client.callTool({
      name: 'get_site_info',
      arguments: {},
    })
    const content = (result.content as Array<{ text: string }>)[0]?.text ?? ''
    expect(JSON.parse(content)).toMatchObject({
      name: 'Foldocs',
      url: 'https://docs.example.com',
      pageCount: 1,
    })
  })
})
