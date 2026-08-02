import { Effect } from 'effect'

import {
  type SearchClient,
  type SearchDocument,
  SearchError,
  type SearchIndexer,
  type SearchSyncReport,
  createSearchIndexer,
  excerpt,
  syncSearchDocuments,
} from '@foldocs/search'

export interface TypesenseDocument {
  readonly id?: string
  readonly url: string
  readonly title: string
  readonly description?: string
  readonly content?: string
  readonly locale?: string
  readonly tags?: ReadonlyArray<string>
}

export interface TypesenseAdminClient {
  readonly collections: (name: string) => {
    readonly documents: () => {
      readonly delete: (options: {
        readonly filter_by: string
      }) => Promise<unknown>
      readonly import: (
        documents: ReadonlyArray<Readonly<Record<string, unknown>>>,
        options: { readonly action: 'upsert' },
      ) => Promise<unknown>
    }
  }
}

export interface TypesenseIndexerOptions {
  readonly client: TypesenseAdminClient
  readonly collectionName: string
  /** Filter used to clear the previous snapshot before importing. */
  readonly deleteFilter?: string
}

const assertTypesenseImport = (result: unknown): void => {
  const rows = Array.isArray(result)
    ? result
    : typeof result === 'string'
      ? result
          .split('\n')
          .filter(Boolean)
          .map(line => JSON.parse(line) as unknown)
      : []
  const failure = rows.find(
    row =>
      typeof row === 'object' &&
      row !== null &&
      'success' in row &&
      row.success === false,
  )
  if (failure !== undefined) {
    throw new Error(`Typesense import failed: ${JSON.stringify(failure)}`)
  }
}

export const createTypesenseSearchIndexer = (
  options: TypesenseIndexerOptions,
): SearchIndexer =>
  createSearchIndexer('typesense', async documents => {
    const collection = options.client
      .collections(options.collectionName)
      .documents()
    await collection.delete({
      filter_by: options.deleteFilter ?? 'id:!=__foldocs_never__',
    })
    if (documents.length === 0) return
    assertTypesenseImport(
      await collection.import(
        documents.map(document => ({ ...document })),
        { action: 'upsert' },
      ),
    )
  })

export const syncTypesenseSearch = (
  options: TypesenseIndexerOptions,
  documents: ReadonlyArray<SearchDocument>,
): Effect.Effect<SearchSyncReport, SearchError> =>
  syncSearchDocuments(createTypesenseSearchIndexer(options), documents)

export interface TypesenseClient {
  readonly collections: (name: string) => {
    readonly documents: () => {
      readonly search: (params: Readonly<Record<string, unknown>>) => Promise<{
        readonly hits?: ReadonlyArray<{
          readonly document: TypesenseDocument
          readonly text_match?: number
        }>
      }>
    }
  }
}

export interface TypesenseOptions {
  readonly client: TypesenseClient
  readonly collectionName: string
  readonly queryBy?: string
}

export const createTypesenseSearchClient = (
  options: TypesenseOptions,
): SearchClient => ({
  provider: 'typesense',
  search: (query, searchOptions = {}) =>
    query.trim().length === 0
      ? Effect.succeed([])
      : Effect.tryPromise({
          try: async () => {
            const filters = [
              searchOptions.locale === undefined
                ? undefined
                : `locale:=${searchOptions.locale}`,
              ...(searchOptions.tags ?? []).map(tag => `tags:=${tag}`),
            ].filter((value): value is string => value !== undefined)
            const response = await options.client
              .collections(options.collectionName)
              .documents()
              .search({
                q: query,
                query_by: options.queryBy ?? 'title,description,content',
                per_page: searchOptions.limit ?? 12,
                ...(filters.length === 0
                  ? {}
                  : { filter_by: filters.join(' && ') }),
              })
            return (response.hits ?? []).map(
              ({ document, text_match }, index) => ({
                id: document.id ?? document.url,
                url: document.url,
                title: document.title,
                excerpt: excerpt(
                  document.description ?? document.content ?? '',
                  query,
                ),
                score:
                  text_match ??
                  Math.max(0, (searchOptions.limit ?? 12) - index),
              }),
            )
          },
          catch: cause => new SearchError('typesense', cause),
        }),
})
