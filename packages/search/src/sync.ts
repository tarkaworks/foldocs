import { Effect, Schema as S } from 'effect'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  SearchDocument,
  SearchError,
  type SearchIndexer,
  type SearchSyncReport,
  syncSearchDocuments,
} from './index.js'

export type SearchDocumentSource = string | URL | ReadonlyArray<SearchDocument>

export interface SyncSearchIndexOptions {
  readonly source: SearchDocumentSource
  readonly fetch?: typeof globalThis.fetch
  readonly cwd?: string
}

const decodeDocuments = S.decodeUnknownSync(S.Array(SearchDocument))

const isRemote = (source: string | URL): boolean => {
  const value = String(source)
  return value.startsWith('https://') || value.startsWith('http://')
}

/** Load the JSON emitted by the Foldocs Vite plugin from disk or an HTTP URL. */
export const loadSearchDocuments = (
  source: SearchDocumentSource,
  options: Omit<SyncSearchIndexOptions, 'source'> = {},
): Effect.Effect<ReadonlyArray<SearchDocument>, SearchError> =>
  Effect.tryPromise({
    try: async () => {
      if (Array.isArray(source)) return decodeDocuments(source)
      if (isRemote(source as string | URL)) {
        const request = options.fetch ?? globalThis.fetch
        const response = await request(String(source))
        if (!response.ok) {
          throw new Error(
            `Unable to load search index (${String(response.status)})`,
          )
        }
        return decodeDocuments(await response.json())
      }

      const path =
        source instanceof URL
          ? source
          : resolve(options.cwd ?? process.cwd(), source as string)
      return decodeDocuments(JSON.parse(await readFile(path, 'utf8')))
    },
    catch: cause => new SearchError('index-source', cause),
  })

/** Load a generated index snapshot and replace the configured hosted corpus. */
export const syncSearchIndex = (
  indexer: SearchIndexer,
  options: SyncSearchIndexOptions,
): Effect.Effect<SearchSyncReport, SearchError> =>
  loadSearchDocuments(options.source, options).pipe(
    Effect.flatMap(documents => syncSearchDocuments(indexer, documents)),
  )
