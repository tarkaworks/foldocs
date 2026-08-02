import { Effect } from 'effect'

import {
  type SearchClient,
  type SearchDocument,
  SearchError,
  type SearchOptions,
  type SearchProvider,
  type SearchResult,
  excerpt,
} from '@foldocs/search'
import {
  type Orama,
  type TypedDocument,
  create,
  insertMultiple,
  search,
} from '@orama/orama'

const schema = {
  id: 'string',
  url: 'string',
  title: 'string',
  description: 'string',
  content: 'string',
  locale: 'string',
  tags: 'enum[]',
} as const

type Database = Orama<typeof schema>
type DatabaseDocument = TypedDocument<Database>

export interface OramaSearchOptions {
  readonly language?: string
  readonly tolerance?: number
}

const makeDatabase = async (
  documents: ReadonlyArray<SearchDocument>,
  options: OramaSearchOptions,
): Promise<Database> => {
  const database = create({
    schema,
    ...(options.language === undefined ? {} : { language: options.language }),
  }) as Database
  const normalized: DatabaseDocument[] = documents.map(document => ({
    id: document.id,
    url: document.url,
    title: document.title,
    description: document.description ?? '',
    content: document.content,
    locale: document.locale ?? '',
    tags: [...(document.tags ?? [])],
  }))
  await insertMultiple(database, normalized)
  return database
}

export const createOramaSearchClient = (
  documents: ReadonlyArray<SearchDocument>,
  options: OramaSearchOptions = {},
): SearchClient => {
  const database = makeDatabase(documents, options)

  const runSearch = async (
    query: string,
    searchOptions: SearchOptions,
  ): Promise<ReadonlyArray<SearchResult>> => {
    if (query.trim().length === 0) return []
    const result = await search(await database, {
      mode: 'fulltext',
      term: query,
      limit:
        searchOptions.tags === undefined || searchOptions.tags.length === 0
          ? (searchOptions.limit ?? 12)
          : Math.max(50, searchOptions.limit ?? 12),
      tolerance: options.tolerance ?? 1,
      boost: { title: 3, description: 2 },
      ...(searchOptions.locale === undefined
        ? {}
        : { where: { locale: searchOptions.locale } }),
    })
    return result.hits
      .filter(
        hit =>
          searchOptions.tags === undefined ||
          searchOptions.tags.every(tag => hit.document.tags.includes(tag)),
      )
      .slice(0, searchOptions.limit ?? 12)
      .map(hit => {
        const document = hit.document
        return {
          id: document.id,
          url: document.url,
          title: document.title,
          excerpt: excerpt(document.description || document.content, query),
          score: hit.score,
        }
      })
  }

  return {
    provider: 'orama',
    search: (query, searchOptions = {}) =>
      Effect.tryPromise({
        try: () => runSearch(query, searchOptions),
        catch: cause => new SearchError('orama', cause),
      }),
  }
}

export const orama = (options: OramaSearchOptions = {}): SearchProvider => ({
  name: 'orama',
  createClient: documents => createOramaSearchClient(documents, options),
})
