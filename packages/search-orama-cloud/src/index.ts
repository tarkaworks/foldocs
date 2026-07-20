import { SearchError, excerpt, type SearchClient } from "@effectdocs/search";
import { Effect } from "effect";

export interface OramaCloudHit {
  readonly id: string;
  readonly score?: number;
  readonly document: Readonly<Record<string, unknown>>;
}

export interface OramaCloudClient {
  readonly search: (params: Readonly<Record<string, unknown>>) => Promise<
    | {
        readonly hits?: ReadonlyArray<OramaCloudHit>;
        readonly groups?: ReadonlyArray<{
          readonly result: ReadonlyArray<OramaCloudHit>;
        }>;
      }
    | undefined
  >;
}

export interface OramaCloudOptions {
  readonly client: OramaCloudClient;
  readonly params?: Readonly<Record<string, unknown>>;
}

export const createOramaCloudSearchClient = (
  options: OramaCloudOptions,
): SearchClient => ({
  provider: "orama-cloud",
  search: (query, searchOptions = {}) =>
    query.trim().length === 0
      ? Effect.succeed([])
      : Effect.tryPromise({
          try: async () => {
            const response = await options.client.search({
              datasources: [],
              ...options.params,
              term: query,
              limit: searchOptions.limit ?? 12,
              ...(searchOptions.locale === undefined
                ? {}
                : { where: { locale: searchOptions.locale } }),
            });
            const hits =
              response?.groups?.flatMap((group) => group.result) ??
              response?.hits ??
              [];
            const seen = new Set<string>();
            return hits.flatMap((hit) => {
              const document = hit.document;
              const url =
                typeof document.url === "string" ? document.url : undefined;
              if (url === undefined || seen.has(url)) return [];
              seen.add(url);
              const title =
                typeof document.title === "string" ? document.title : url;
              const content =
                typeof document.description === "string"
                  ? document.description
                  : typeof document.content === "string"
                    ? document.content
                    : "";
              return [
                {
                  id: hit.id,
                  url,
                  title,
                  excerpt: excerpt(content, query),
                  score: hit.score ?? 0,
                },
              ];
            });
          },
          catch: (cause) => new SearchError("orama-cloud", cause),
        }),
});
