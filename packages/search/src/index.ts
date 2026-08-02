import { Effect, Schema as S } from 'effect'

export const SearchDocument = S.Struct({
  id: S.String,
  url: S.String,
  title: S.String,
  description: S.optionalKey(S.String),
  content: S.String,
  locale: S.optionalKey(S.String),
  tags: S.optionalKey(S.Array(S.String)),
})
export type SearchDocument = typeof SearchDocument.Type

export const SearchResult = S.Struct({
  id: S.String,
  url: S.String,
  title: S.String,
  excerpt: S.String,
  score: S.Number,
})
export type SearchResult = typeof SearchResult.Type

export class SearchError extends Error {
  readonly _tag = 'SearchError'

  constructor(
    readonly provider: string,
    readonly cause: unknown,
  ) {
    super(`Search provider ${provider} failed: ${String(cause)}`)
  }
}

export interface SearchOptions {
  readonly limit?: number
  readonly locale?: string
  readonly tags?: ReadonlyArray<string>
}

export interface SearchClient {
  readonly provider: string
  readonly search: (
    query: string,
    options?: SearchOptions,
  ) => Effect.Effect<ReadonlyArray<SearchResult>, SearchError>
}

export interface SearchProvider {
  readonly name: string
  readonly createClient: (
    documents: ReadonlyArray<SearchDocument>,
  ) => SearchClient
}

export interface SearchIndexer {
  readonly provider: string
  /** Replace the complete provider-side corpus with this snapshot. */
  readonly replace: (
    documents: ReadonlyArray<SearchDocument>,
  ) => Effect.Effect<void, SearchError>
}

export interface SearchSyncReport {
  readonly provider: string
  readonly documents: number
  readonly locales: ReadonlyArray<string>
}

export const createSearchIndexer = (
  provider: string,
  replace: (documents: ReadonlyArray<SearchDocument>) => Promise<void>,
): SearchIndexer => ({
  provider,
  replace: documents =>
    Effect.tryPromise({
      try: () => replace(documents),
      catch: cause => new SearchError(provider, cause),
    }),
})

const prepareSearchDocuments = (
  documents: ReadonlyArray<SearchDocument>,
): ReadonlyArray<SearchDocument> => {
  const ids = new Set<string>()
  const urls = new Set<string>()
  const ordered = [...documents].sort((left, right) =>
    left.id.localeCompare(right.id),
  )

  for (const document of ordered) {
    if (ids.has(document.id)) {
      throw new Error(`Duplicate search document id: ${document.id}`)
    }
    const localizedUrl = `${document.locale ?? ''}:${document.url}`
    if (urls.has(localizedUrl)) {
      throw new Error(`Duplicate search document URL: ${document.url}`)
    }
    ids.add(document.id)
    urls.add(localizedUrl)
  }

  return ordered
}

/** Validate and atomically hand a complete corpus to a hosted index writer. */
export const syncSearchDocuments = (
  indexer: SearchIndexer,
  documents: ReadonlyArray<SearchDocument>,
): Effect.Effect<SearchSyncReport, SearchError> =>
  Effect.try({
    try: () => prepareSearchDocuments(documents),
    catch: cause => new SearchError(indexer.provider, cause),
  }).pipe(
    Effect.flatMap(prepared =>
      indexer.replace(prepared).pipe(
        Effect.map(() => ({
          provider: indexer.provider,
          documents: prepared.length,
          locales: [
            ...new Set(
              prepared.flatMap(document =>
                document.locale === undefined ? [] : [document.locale],
              ),
            ),
          ].sort(),
        })),
      ),
    ),
  )

export const excerpt = (
  content: string,
  query: string,
  maximumLength = 180,
): string => {
  const normalized = content.replace(/\s+/gu, ' ').trim()
  if (normalized.length <= maximumLength) return normalized
  const index = normalized
    .toLocaleLowerCase()
    .indexOf(query.toLocaleLowerCase())
  const start = Math.max(
    0,
    index === -1 ? 0 : index - Math.floor(maximumLength / 3),
  )
  const end = Math.min(normalized.length, start + maximumLength)
  return `${start > 0 ? '…' : ''}${normalized.slice(start, end).trim()}${
    end < normalized.length ? '…' : ''
  }`
}

export const emptySearchClient: SearchClient = {
  provider: 'none',
  search: () => Effect.succeed([]),
}
