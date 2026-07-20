import { SearchError, excerpt, type SearchClient } from "@effectdocs/search";
import { Effect } from "effect";

export interface MixedbreadSearchItem {
  readonly file_id: string;
  readonly chunk_index: number;
  readonly score?: number;
  readonly text?: string;
  readonly generated_metadata?: Readonly<{
    title?: string;
    description?: string;
    url?: string;
  }>;
}

export interface MixedbreadClient {
  readonly stores: {
    readonly search: (request: Readonly<Record<string, unknown>>) => Promise<{
      readonly data: ReadonlyArray<MixedbreadSearchItem>;
    }>;
  };
}

export interface MixedbreadOptions {
  readonly client: MixedbreadClient;
  readonly storeIdentifier: string;
}

export const createMixedbreadSearchClient = (
  options: MixedbreadOptions,
): SearchClient => ({
  provider: "mixedbread",
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
            });
            return response.data.flatMap((item) => {
              const metadata = item.generated_metadata;
              if (metadata?.url === undefined) return [];
              return [
                {
                  id: `${item.file_id}-${String(item.chunk_index)}`,
                  url: metadata.url,
                  title: metadata.title ?? "Untitled",
                  excerpt: excerpt(
                    metadata.description ?? item.text ?? "",
                    query,
                  ),
                  score: item.score ?? 0,
                },
              ];
            });
          },
          catch: (cause) => new SearchError("mixedbread", cause),
        }),
});
