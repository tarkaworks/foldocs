import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

export interface FoldocsMcpOptions {
  /** Base URL of the documentation site */
  readonly baseUrl: string
  /** Path to agent-readability.json (default: /agent-readability.json) */
  readonly manifestPath?: string
}

interface DocManifest {
  readonly name: string
  readonly description?: string
  readonly url: string
  readonly docs: ReadonlyArray<{
    readonly title: string
    readonly description?: string
    readonly url: string
    readonly lastModified?: string
  }>
  readonly navigation: ReadonlyArray<{
    readonly title: string
    readonly url: string
  }>
  readonly tools?: ReadonlyArray<{
    readonly name: string
    readonly description: string
    readonly endpoint: string
  }>
}

const fetchManifest = async (baseUrl: string, manifestPath: string): Promise<DocManifest> => {
  const url = `${baseUrl.replace(/\/+$/, '')}${manifestPath}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch manifest from ${url}: ${response.status}`)
  }
  return response.json() as Promise<DocManifest>
}

const fetchPage = async (url: string): Promise<string> => {
  const response = await fetch(url, {
    headers: { Accept: 'text/markdown' },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch page from ${url}: ${response.status}`)
  }
  return response.text()
}

export const createFoldocsMcpServer = (options: FoldocsMcpOptions): McpServer => {
  const { baseUrl, manifestPath = '/agent-readability.json' } = options

  const server = new McpServer({
    name: 'foldocs',
    version: '0.1.0',
  })

  server.tool(
    'list_pages',
    'List all documentation pages with titles and URLs',
    {},
    async () => {
      const manifest = await fetchManifest(baseUrl, manifestPath)
      const pages = manifest.docs.map(doc => ({
        title: doc.title,
        url: doc.url,
        description: doc.description,
      }))
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(pages, null, 2),
          },
        ],
      }
    },
  )

  server.tool(
    'get_page',
    'Get the content of a documentation page as markdown',
    {
      url: z.string().url().describe('The URL of the page to fetch'),
    },
    async (params: { url: string }) => {
      const content = await fetchPage(params.url)
      return {
        content: [
          {
            type: 'text' as const,
            text: content,
          },
        ],
      }
    },
  )

  server.tool(
    'search_pages',
    'Search documentation pages by title or description',
    {
      query: z.string().describe('Search query to match against page titles and descriptions'),
    },
    async (params: { query: string }) => {
      const manifest = await fetchManifest(baseUrl, manifestPath)
      const lowerQuery = params.query.toLowerCase()
      const matches = manifest.docs.filter(
        doc =>
          doc.title.toLowerCase().includes(lowerQuery) ||
          (doc.description !== undefined && doc.description.toLowerCase().includes(lowerQuery)),
      )
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(matches, null, 2),
          },
        ],
      }
    },
  )

  server.tool(
    'get_navigation',
    'Get the site navigation structure',
    {},
    async () => {
      const manifest = await fetchManifest(baseUrl, manifestPath)
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(manifest.navigation, null, 2),
          },
        ],
      }
    },
  )

  server.tool(
    'get_site_info',
    'Get site metadata including name, description, and available tools',
    {},
    async () => {
      const manifest = await fetchManifest(baseUrl, manifestPath)
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                name: manifest.name,
                description: manifest.description,
                url: manifest.url,
                tools: manifest.tools,
                pageCount: manifest.docs.length,
              },
              null,
              2,
            ),
          },
        ],
      }
    },
  )

  return server
}

export const startFoldocsMcpServer = async (options: FoldocsMcpOptions): Promise<void> => {
  const server = createFoldocsMcpServer(options)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
