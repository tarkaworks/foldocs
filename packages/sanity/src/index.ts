import {
  decodeContentFile,
  defineContentAdapter,
  type ContentAdapter,
  type ContentFile,
} from "@foldocs/content";

export interface SanityClientLike {
  readonly fetch: <Result>(
    query: string,
    params?: Readonly<Record<string, unknown>>,
    options?: Readonly<Record<string, unknown>>,
  ) => Promise<Result>;
}

export interface SanityContentOptions<RecordType> {
  readonly name?: string;
  readonly client: SanityClientLike;
  readonly query: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly request?: Readonly<Record<string, unknown>>;
  readonly map: (
    record: RecordType,
    index: number,
  ) => ContentFile | ReadonlyArray<ContentFile>;
}

/** Adapt a GROQ result into deterministic Markdown/MDX files at build time. */
export const createSanityContentSource = <RecordType>(
  options: SanityContentOptions<RecordType>,
): ContentAdapter =>
  defineContentAdapter(options.name ?? "sanity", async () => {
    const records = await options.client.fetch<ReadonlyArray<RecordType>>(
      options.query,
      options.params,
      options.request,
    );
    if (!Array.isArray(records))
      throw new TypeError("The Sanity content query must return an array.");
    return records.flatMap((record, index) =>
      [options.map(record, index)]
        .flat()
        .map((file) => decodeContentFile(file)),
    );
  });
