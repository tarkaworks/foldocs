import { Effect } from 'effect'

import {
  type SearchClient,
  type SearchDocument,
  SearchError,
  type SearchIndexer,
  type SearchOptions,
  type SearchSyncReport,
  createSearchIndexer,
  excerpt,
  syncSearchDocuments,
} from '@foldocs/search'

export interface TrieveHit {
  readonly id: string
  readonly url: string
  readonly title: string
  readonly type?: 'page' | 'section'
  readonly pageTitle?: string
  readonly breadcrumbs?: ReadonlyArray<string>
  readonly content?: string
  readonly score?: number
}

export interface TrieveOptions {
  /** Keep credentials server-side by implementing this with your search endpoint. */
  readonly search: (
    query: string,
    options: SearchOptions,
  ) => Promise<ReadonlyArray<TrieveHit>>
}

export interface TrieveIngestionOptions {
  /**
   * Replace the dataset using a server-side Trieve SDK or ingestion endpoint.
   * Admin credentials must never be bundled into the documentation client.
   */
  readonly replace: (documents: ReadonlyArray<SearchDocument>) => Promise<void>
}

export const createTrieveSearchIndexer = (
  options: TrieveIngestionOptions,
): SearchIndexer => createSearchIndexer('trieve', options.replace)

export const syncTrieveSearch = (
  options: TrieveIngestionOptions,
  documents: ReadonlyArray<SearchDocument>,
): Effect.Effect<SearchSyncReport, SearchError> =>
  syncSearchDocuments(createTrieveSearchIndexer(options), documents)

export const createTrieveSearchClient = (
  options: TrieveOptions,
): SearchClient => ({
  provider: 'trieve',
  search: (query, searchOptions = {}) =>
    query.trim().length === 0
      ? Effect.succeed([])
      : Effect.tryPromise({
          try: async () =>
            (await options.search(query, searchOptions)).map(hit => ({
              id: hit.id,
              url: hit.url,
              title: hit.title,
              ...(hit.type === undefined ? {} : { type: hit.type }),
              ...(hit.pageTitle === undefined
                ? {}
                : { pageTitle: hit.pageTitle }),
              ...(hit.breadcrumbs === undefined
                ? {}
                : { breadcrumbs: [...hit.breadcrumbs] }),
              excerpt: excerpt(hit.content ?? '', query),
              score: hit.score ?? 0,
            })),
          catch: cause => new SearchError('trieve', cause),
        }),
})
