import { SearchError, excerpt, type SearchClient } from "@effectdocs/search";
import { Effect } from "effect";

export interface TypesenseDocument {
  readonly id?: string;
  readonly url: string;
  readonly title: string;
  readonly description?: string;
  readonly content?: string;
}

export interface TypesenseClient {
  readonly collections: (name: string) => {
    readonly documents: () => {
      readonly search: (params: Readonly<Record<string, unknown>>) => Promise<{
        readonly hits?: ReadonlyArray<{
          readonly document: TypesenseDocument;
          readonly text_match?: number;
        }>;
      }>;
    };
  };
}

export interface TypesenseOptions {
  readonly client: TypesenseClient;
  readonly collectionName: string;
  readonly queryBy?: string;
}

export const createTypesenseSearchClient = (
  options: TypesenseOptions,
): SearchClient => ({
  provider: "typesense",
  search: (query, searchOptions = {}) =>
    query.trim().length === 0
      ? Effect.succeed([])
      : Effect.tryPromise({
          try: async () => {
            const filters = [
              searchOptions.locale === undefined
                ? undefined
                : `locale:=${searchOptions.locale}`,
              ...(searchOptions.tags ?? []).map((tag) => `tags:=${tag}`),
            ].filter((value): value is string => value !== undefined);
            const response = await options.client
              .collections(options.collectionName)
              .documents()
              .search({
                q: query,
                query_by: options.queryBy ?? "title,description,content",
                per_page: searchOptions.limit ?? 12,
                ...(filters.length === 0
                  ? {}
                  : { filter_by: filters.join(" && ") }),
              });
            return (response.hits ?? []).map(
              ({ document, text_match }, index) => ({
                id: document.id ?? document.url,
                url: document.url,
                title: document.title,
                excerpt: excerpt(
                  document.description ?? document.content ?? "",
                  query,
                ),
                score:
                  text_match ??
                  Math.max(0, (searchOptions.limit ?? 12) - index),
              }),
            );
          },
          catch: (cause) => new SearchError("typesense", cause),
        }),
});
