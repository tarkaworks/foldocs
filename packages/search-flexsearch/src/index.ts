import { Effect } from 'effect'
import FlexSearch, { type Document, type DocumentData } from 'flexsearch'

import {
  type SearchClient,
  type SearchDocument,
  SearchError,
  type SearchProvider,
  type SearchResult,
  excerpt,
} from '@foldocs/search'

type IndexedDocument = DocumentData & {
  readonly id: string
  readonly url: string
  readonly title: string
  readonly description: string
  readonly content: string
  readonly locale: string
  readonly tags: Array<string>
}

export interface FlexSearchOptions {
  readonly tokenize?: 'strict' | 'forward' | 'reverse' | 'full'
}

export const createFlexSearchClient = (
  documents: ReadonlyArray<SearchDocument>,
  options: FlexSearchOptions = {},
): SearchClient => {
  const index: Document<IndexedDocument> =
    new FlexSearch.Document<IndexedDocument>({
      tokenize: options.tokenize ?? 'forward',
      document: {
        id: 'id',
        index: ['title', 'description', 'content'],
        tag: ['locale', 'tags'],
        store: true,
      },
    })
  for (const document of documents) {
    index.add({
      id: document.id,
      url: document.url,
      title: document.title,
      description: document.description ?? '',
      content: document.content,
      locale: document.locale ?? '',
      tags: [...(document.tags ?? [])],
    })
  }

  const run = async (query: string, limit: number, locale?: string) => {
    const fields = await index.searchAsync(query, {
      limit,
      enrich: true,
      ...(locale === undefined ? {} : { tag: { locale } }),
    })
    const seen = new Set<string>()
    const results: SearchResult[] = []
    for (const field of fields) {
      for (const match of field.result) {
        const id = typeof match === 'object' ? String(match.id) : String(match)
        if (seen.has(id)) continue
        const document = index.get(id)
        if (document == null) continue
        seen.add(id)
        results.push({
          id,
          url: document.url,
          title: document.title,
          excerpt: excerpt(document.description || document.content, query),
          score: Math.max(0, limit - results.length),
        })
      }
    }
    return results.slice(0, limit)
  }

  return {
    provider: 'flexsearch',
    search: (query, searchOptions = {}) =>
      query.trim().length === 0
        ? Effect.succeed([])
        : Effect.tryPromise({
            try: () =>
              run(query, searchOptions.limit ?? 12, searchOptions.locale),
            catch: cause => new SearchError('flexsearch', cause),
          }),
  }
}

export const flexsearch = (
  options: FlexSearchOptions = {},
): SearchProvider => ({
  name: 'flexsearch',
  createClient: documents => createFlexSearchClient(documents, options),
})
