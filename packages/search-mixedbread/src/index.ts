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

export interface MixedbreadSearchItem {
  readonly file_id: string
  readonly chunk_index: number
  readonly score?: number
  readonly text?: string
  readonly generated_metadata?: Readonly<{
    title?: string
    description?: string
    url?: string
    type?: 'page' | 'section'
    pageTitle?: string
    breadcrumbs?: ReadonlyArray<string>
  }>
}

export interface MixedbreadClient {
  readonly stores: {
    readonly search: (request: Readonly<Record<string, unknown>>) => Promise<{
      readonly data: ReadonlyArray<MixedbreadSearchItem>
    }>
  }
}

export interface MixedbreadOptions {
  readonly client: MixedbreadClient
  readonly storeIdentifier: string
}

export interface MixedbreadIngestionOptions {
  /** Replace the store using the Mixedbread SDK, CLI, or a private CI endpoint. */
  readonly replace: (documents: ReadonlyArray<SearchDocument>) => Promise<void>
}

export const createMixedbreadSearchIndexer = (
  options: MixedbreadIngestionOptions,
): SearchIndexer => createSearchIndexer('mixedbread', options.replace)

export const syncMixedbreadSearch = (
  options: MixedbreadIngestionOptions,
  documents: ReadonlyArray<SearchDocument>,
): Effect.Effect<SearchSyncReport, SearchError> =>
  syncSearchDocuments(createMixedbreadSearchIndexer(options), documents)

export const createMixedbreadSearchClient = (
  options: MixedbreadOptions,
): SearchClient => ({
  provider: 'mixedbread',
  search: (query, searchOptions = {}) =>
    query.trim().length === 0
      ? Effect.succeed([])
      : Effect.tryPromise({
          try: async () => {
            const response = await options.client.stores.search({
              query,
              store_identifiers: [options.storeIdentifier],
              top_k: searchOptions.limit ?? 12,
              search_options: { return_metadata: true },
            })
            return response.data.flatMap(item => {
              const metadata = item.generated_metadata
              if (metadata?.url === undefined) return []
              return [
                {
                  id: `${item.file_id}-${String(item.chunk_index)}`,
                  url: metadata.url,
                  title: metadata.title ?? 'Untitled',
                  ...(metadata.type === undefined
                    ? {}
                    : { type: metadata.type }),
                  ...(metadata.pageTitle === undefined
                    ? {}
                    : { pageTitle: metadata.pageTitle }),
                  ...(metadata.breadcrumbs === undefined
                    ? {}
                    : { breadcrumbs: [...metadata.breadcrumbs] }),
                  excerpt: excerpt(
                    metadata.description ?? item.text ?? '',
                    query,
                  ),
                  score: item.score ?? 0,
                },
              ]
            })
          },
          catch: cause => new SearchError('mixedbread', cause),
        }),
})
