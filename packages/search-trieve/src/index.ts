import {
  SearchError,
  excerpt,
  type SearchClient,
  type SearchOptions,
} from "@effectdocs/search";
import { Effect } from "effect";

export interface TrieveHit {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly content?: string;
  readonly score?: number;
}

export interface TrieveOptions {
  /** Keep credentials server-side by implementing this with your search endpoint. */
  readonly search: (
    query: string,
    options: SearchOptions,
  ) => Promise<ReadonlyArray<TrieveHit>>;
}

export const createTrieveSearchClient = (
  options: TrieveOptions,
): SearchClient => ({
  provider: "trieve",
  search: (query, searchOptions = {}) =>
    query.trim().length === 0
      ? Effect.succeed([])
      : Effect.tryPromise({
          try: async () =>
            (await options.search(query, searchOptions)).map((hit) => ({
              id: hit.id,
              url: hit.url,
              title: hit.title,
              excerpt: excerpt(hit.content ?? "", query),
              score: hit.score ?? 0,
            })),
          catch: (cause) => new SearchError("trieve", cause),
        }),
});
