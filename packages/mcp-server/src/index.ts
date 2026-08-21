import { Effect, Schema as S } from 'effect'
import { z } from 'zod'

import {
  type SearchClient,
  type SearchDocument,
  SearchDocument as SearchDocumentSchema,
} from '@foldocs/search'
import { createOramaSearchClient } from '@foldocs/search-orama'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

export interface FoldocsMcpOptions {
  /** Base URL of the documentation site */
  readonly baseUrl: string
  /** Path to agent-readability.json (default: /agent-readability.json) */
  readonly manifestPath?: string
}

interface DocManifest {
  readonly name: string
  readonly description?: string
  readonly url?: string
  readonly site?: string | null
  readonly artifacts?: {
    readonly searchIndex?: Readonly<Record<string, string>>
  }
  readonly docs?: ReadonlyArray<ManifestPage>
  readonly pages?: ReadonlyArray<ManifestPage>
  readonly tools?: ReadonlyArray<{
    readonly name: string
    readonly description: string
    readonly endpoint: string
  }>
}

interface ManifestPage {
  readonly title: string
  readonly description?: string
  readonly url: string
  readonly lastModified?: string
}

const manifestPages = (manifest: DocManifest): ReadonlyArray<ManifestPage> =>
  manifest.pages ?? manifest.docs ?? []

const decodeSearchDocuments = S.decodeUnknownSync(S.Array(SearchDocumentSchema))

const fetchJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }
  return response.json()
}

const fetchManifest = async (
  baseUrl: string,
  manifestPath: string,
): Promise<DocManifest> => {
  const url = `${baseUrl.replace(/\/+$/, '')}${manifestPath}`
  return fetchJson(url) as Promise<DocManifest>
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

interface ResolvedSearchIndex {
  readonly locale: string | undefined
  readonly url: string
  readonly documents: ReadonlyArray<SearchDocument>
}

/** Groups an orientation view of pages by their top-level navigation section: see issue #8. */
const sectionsFromDocuments = (
  documents: ReadonlyArray<SearchDocument>,
): ReadonlyArray<{
  readonly section: string
  readonly pages: ReadonlyArray<{
    readonly title: string
    readonly url: string
  }>
}> => {
  const sections = new Map<
    string,
    Array<{ readonly title: string; readonly url: string }>
  >()
  for (const document of documents) {
    if (document.type === 'section') continue
    const section = document.breadcrumbs?.[0] ?? 'Documentation'
    const pages = sections.get(section) ?? []
    pages.push({
      title: document.pageTitle ?? document.title,
      url: document.url,
    })
    sections.set(section, pages)
  }
  return [...sections.entries()].map(([section, pages]) => ({ section, pages }))
}

export const createFoldocsMcpServer = (
  options: FoldocsMcpOptions,
): McpServer => {
  const { baseUrl, manifestPath = '/agent-readability.json' } = options

  const server = new McpServer({
    name: 'foldocs',
    version: '0.2.0',
  })

  let manifestPromise: Promise<DocManifest> | undefined
  const getManifest = (): Promise<DocManifest> => {
    manifestPromise ??= fetchManifest(baseUrl, manifestPath)
    return manifestPromise
  }

  const searchIndexCache = new Map<string, Promise<ResolvedSearchIndex>>()
  const getSearchIndex = async (
    locale: string | undefined,
  ): Promise<ResolvedSearchIndex> => {
    const manifest = await getManifest()
    const searchIndexUrls = manifest.artifacts?.searchIndex
    const resolvedLocale =
      locale ??
      (searchIndexUrls === undefined
        ? undefined
        : Object.keys(searchIndexUrls)[0])
    const url =
      searchIndexUrls === undefined
        ? `${baseUrl.replace(/\/+$/, '')}/search-index.json`
        : resolvedLocale === undefined
          ? undefined
          : searchIndexUrls[resolvedLocale]
    if (url === undefined)
      throw new Error(
        locale === undefined
          ? 'This site does not publish a search index.'
          : `No search index is published for locale "${locale}".`,
      )
    let cached = searchIndexCache.get(url)
    if (cached === undefined) {
      cached = fetchJson(url).then(raw => ({
        locale: resolvedLocale,
        url,
        documents: decodeSearchDocuments(raw),
      }))
      searchIndexCache.set(url, cached)
    }
    return cached
  }

  const searchClientCache = new Map<string, SearchClient>()
  const getSearchClient = (index: ResolvedSearchIndex): SearchClient => {
    let client = searchClientCache.get(index.url)
    if (client === undefined) {
      client = createOramaSearchClient(index.documents)
      searchClientCache.set(index.url, client)
    }
    return client
  }

  server.tool(
    'search_docs',
    'Search the documentation with ranked full-text search over its published search index. Returns titles, URLs, breadcrumbs, and excerpts.',
    {
      query: z.string().describe('Search query'),
      locale: z
        .string()
        .optional()
        .describe(
          "Locale to search (defaults to the site's first published locale)",
        ),
      limit: z
        .number()
        .int()
        .positive()
        .max(50)
        .optional()
        .describe('Maximum number of results (default 10)'),
    },
    async (params: { query: string; locale?: string; limit?: number }) => {
      const index = await getSearchIndex(params.locale)
      const client = getSearchClient(index)
      const results = await Effect.runPromise(
        client.search(params.query, {
          limit: params.limit ?? 10,
          ...(index.locale === undefined ? {} : { locale: index.locale }),
        }),
      )
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(results, null, 2),
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
    'list_sections',
    'List the documentation sections and the pages within each, so an agent can orient before searching',
    {
      locale: z
        .string()
        .optional()
        .describe(
          "Locale to list (defaults to the site's first published locale)",
        ),
    },
    async (params: { locale?: string }) => {
      const index = await getSearchIndex(params.locale)
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              sectionsFromDocuments(index.documents),
              null,
              2,
            ),
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
      const manifest = await getManifest()
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                name: manifest.name,
                description: manifest.description,
                url: manifest.site ?? manifest.url ?? baseUrl,
                tools: manifest.tools,
                pageCount: manifestPages(manifest).length,
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

export const startFoldocsMcpServer = async (
  options: FoldocsMcpOptions,
): Promise<void> => {
  const server = createFoldocsMcpServer(options)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
