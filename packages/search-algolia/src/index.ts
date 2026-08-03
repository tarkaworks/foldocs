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

export interface AlgoliaHit {
  readonly objectID: string
  readonly url: string
  readonly title: string
  readonly type?: 'page' | 'section'
  readonly pageTitle?: string
  readonly breadcrumbs?: ReadonlyArray<string>
  readonly description?: string
  readonly content?: string
}

export interface AlgoliaLiteClient {
  readonly searchForHits: (request: {
    readonly requests: ReadonlyArray<Readonly<Record<string, unknown>>>
  }) => Promise<{
    readonly results: ReadonlyArray<{
      readonly hits: ReadonlyArray<AlgoliaHit>
    }>
  }>
}

export interface AlgoliaOptions {
  readonly client: AlgoliaLiteClient
  readonly indexName: string
  readonly filter?: string
}

export interface AlgoliaAdminClient {
  readonly setSettings: (request: {
    readonly indexName: string
    readonly indexSettings: Readonly<Record<string, unknown>>
  }) => Promise<unknown>
  readonly replaceAllObjects: (request: {
    readonly indexName: string
    readonly objects: ReadonlyArray<Readonly<Record<string, unknown>>>
  }) => Promise<unknown>
}

export interface AlgoliaIndexerOptions {
  readonly client: AlgoliaAdminClient
  readonly indexName: string
  /** Configure searchable and faceted attributes before replacement. @default true */
  readonly configure?: boolean
  readonly settings?: Readonly<Record<string, unknown>>
}

export const createAlgoliaSearchIndexer = (
  options: AlgoliaIndexerOptions,
): SearchIndexer =>
  createSearchIndexer('algolia', async documents => {
    if (options.configure !== false) {
      await options.client.setSettings({
        indexName: options.indexName,
        indexSettings: {
          searchableAttributes: ['title', 'description', 'content', 'tags'],
          attributesToRetrieve: [
            'objectID',
            'url',
            'title',
            'type',
            'pageTitle',
            'breadcrumbs',
            'description',
            'content',
            'locale',
            'tags',
          ],
          attributesForFaceting: ['filterOnly(locale)', 'filterOnly(tags)'],
          ...options.settings,
        },
      })
    }
    await options.client.replaceAllObjects({
      indexName: options.indexName,
      objects: documents.map(({ id, ...document }) => ({
        objectID: id,
        ...document,
      })),
    })
  })

export const syncAlgoliaSearch = (
  options: AlgoliaIndexerOptions,
  documents: ReadonlyArray<SearchDocument>,
): Effect.Effect<SearchSyncReport, SearchError> =>
  syncSearchDocuments(createAlgoliaSearchIndexer(options), documents)

const filterValue = (value: string): string =>
  `"${value.replaceAll('"', '\\"')}"`

export const createAlgoliaSearchClient = (
  options: AlgoliaOptions,
): SearchClient => ({
  provider: 'algolia',
  search: (query, searchOptions = {}) => {
    if (query.trim().length === 0) return Effect.succeed([])
    const dynamicFilters = [
      options.filter,
      searchOptions.locale === undefined
        ? undefined
        : `locale:${filterValue(searchOptions.locale)}`,
      ...(searchOptions.tags ?? []).map(tag => `tags:${filterValue(tag)}`),
    ].filter((value): value is string => value !== undefined)
    return Effect.tryPromise({
      try: async () => {
        const response = await options.client.searchForHits({
          requests: [
            {
              type: 'default',
              indexName: options.indexName,
              query,
              hitsPerPage: searchOptions.limit ?? 12,
              ...(dynamicFilters.length === 0
                ? {}
                : { filters: dynamicFilters.join(' AND ') }),
            },
          ],
        })
        return (response.results[0]?.hits ?? []).map((hit, index) => ({
          id: hit.objectID,
          url: hit.url,
          title: hit.title,
          ...(hit.type === undefined ? {} : { type: hit.type }),
          ...(hit.pageTitle === undefined ? {} : { pageTitle: hit.pageTitle }),
          ...(hit.breadcrumbs === undefined
            ? {}
            : { breadcrumbs: [...hit.breadcrumbs] }),
          excerpt: excerpt(hit.description ?? hit.content ?? '', query),
          score: Math.max(0, (searchOptions.limit ?? 12) - index),
        }))
      },
      catch: cause => new SearchError('algolia', cause),
    })
  },
})
