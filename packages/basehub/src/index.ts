import {
  type ContentAdapter,
  type ContentFile,
  decodeContentFile,
  defineContentAdapter,
} from '@foldocs/content'

export interface BaseHubContentOptions<Result, RecordType> {
  readonly name?: string
  /** Run a generated BaseHub query with server-side credentials. */
  readonly query: () => Promise<Result>
  readonly select: (result: Result) => ReadonlyArray<RecordType>
  readonly map: (
    record: RecordType,
    index: number,
  ) => ContentFile | ReadonlyArray<ContentFile>
}

export const createBaseHubContentSource = <Result, RecordType>(
  options: BaseHubContentOptions<Result, RecordType>,
): ContentAdapter =>
  defineContentAdapter(options.name ?? 'basehub', async () => {
    const records = options.select(await options.query())
    if (!Array.isArray(records))
      throw new TypeError('The BaseHub selector must return an array.')
    return records.flatMap((record, index) =>
      [options.map(record, index)].flat().map(file => decodeContentFile(file)),
    )
  })
