import { Effect, Schema as S } from "effect";

export const SearchDocument = S.Struct({
  id: S.String,
  url: S.String,
  title: S.String,
  description: S.optionalKey(S.String),
  content: S.String,
  locale: S.optionalKey(S.String),
  tags: S.optionalKey(S.Array(S.String)),
});
export type SearchDocument = typeof SearchDocument.Type;

export const SearchResult = S.Struct({
  id: S.String,
  url: S.String,
  title: S.String,
  excerpt: S.String,
  score: S.Number,
});
export type SearchResult = typeof SearchResult.Type;

export class SearchError extends Error {
  readonly _tag = "SearchError";

  constructor(
    readonly provider: string,
    readonly cause: unknown,
  ) {
    super(`Search provider ${provider} failed: ${String(cause)}`);
  }
}

export interface SearchOptions {
  readonly limit?: number;
  readonly locale?: string;
  readonly tags?: ReadonlyArray<string>;
}

export interface SearchClient {
  readonly provider: string;
  readonly search: (
    query: string,
    options?: SearchOptions,
  ) => Effect.Effect<ReadonlyArray<SearchResult>, SearchError>;
}

export interface SearchProvider {
  readonly name: string;
  readonly createClient: (
    documents: ReadonlyArray<SearchDocument>,
  ) => SearchClient;
}

export const excerpt = (
  content: string,
  query: string,
  maximumLength = 180,
): string => {
  const normalized = content.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maximumLength) return normalized;
  const index = normalized
    .toLocaleLowerCase()
    .indexOf(query.toLocaleLowerCase());
  const start = Math.max(
    0,
    index === -1 ? 0 : index - Math.floor(maximumLength / 3),
  );
  const end = Math.min(normalized.length, start + maximumLength);
  return `${start > 0 ? "…" : ""}${normalized.slice(start, end).trim()}${
    end < normalized.length ? "…" : ""
  }`;
};

export const emptySearchClient: SearchClient = {
  provider: "none",
  search: () => Effect.succeed([]),
};
