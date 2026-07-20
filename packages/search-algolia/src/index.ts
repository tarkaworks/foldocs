import { SearchError, excerpt, type SearchClient } from "@effectdocs/search";
import { Effect } from "effect";

export interface AlgoliaHit {
  readonly objectID: string;
  readonly url: string;
  readonly title: string;
  readonly description?: string;
  readonly content?: string;
}

export interface AlgoliaLiteClient {
  readonly searchForHits: (request: {
    readonly requests: ReadonlyArray<Readonly<Record<string, unknown>>>;
  }) => Promise<{
    readonly results: ReadonlyArray<{
      readonly hits: ReadonlyArray<AlgoliaHit>;
    }>;
  }>;
}

export interface AlgoliaOptions {
  readonly client: AlgoliaLiteClient;
  readonly indexName: string;
  readonly filter?: string;
}

const filterValue = (value: string): string =>
  `"${value.replaceAll('"', '\\"')}"`;

export const createAlgoliaSearchClient = (
  options: AlgoliaOptions,
): SearchClient => ({
  provider: "algolia",
  search: (query, searchOptions = {}) => {
    if (query.trim().length === 0) return Effect.succeed([]);
    const dynamicFilters = [
      options.filter,
      searchOptions.locale === undefined
        ? undefined
        : `locale:${filterValue(searchOptions.locale)}`,
      ...(searchOptions.tags ?? []).map((tag) => `tags:${filterValue(tag)}`),
    ].filter((value): value is string => value !== undefined);
    return Effect.tryPromise({
      try: async () => {
        const response = await options.client.searchForHits({
          requests: [
            {
              type: "default",
              indexName: options.indexName,
              query,
              hitsPerPage: searchOptions.limit ?? 12,
              ...(dynamicFilters.length === 0
                ? {}
                : { filters: dynamicFilters.join(" AND ") }),
            },
          ],
        });
        return (response.results[0]?.hits ?? []).map((hit, index) => ({
          id: hit.objectID,
          url: hit.url,
          title: hit.title,
          excerpt: excerpt(hit.description ?? hit.content ?? "", query),
          score: Math.max(0, (searchOptions.limit ?? 12) - index),
        }));
      },
      catch: (cause) => new SearchError("algolia", cause),
    });
  },
});
