import { Effect } from 'effect'

import {
  type ContentAdapter,
  type ContentFile,
  decodeContentFile,
  defineContentAdapter,
} from '@foldocs/content'

export class RemoteContentError extends Error {
  readonly _tag = 'RemoteContentError'

  constructor(
    readonly url: string,
    readonly cause: unknown,
  ) {
    super(`Unable to load remote Foldocs content from ${url}: ${String(cause)}`)
  }
}

export interface RemoteContentOptions {
  readonly name: string
  readonly url: string | URL
  readonly headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>)
  readonly fetch?: typeof globalThis.fetch
  /** Select the array of files when an endpoint wraps its JSON payload. */
  readonly select?: (payload: unknown) => ReadonlyArray<unknown>
}

export const loadRemoteContent = (
  options: RemoteContentOptions,
): Effect.Effect<ReadonlyArray<ContentFile>, RemoteContentError> =>
  Effect.tryPromise({
    try: async () => {
      const request = options.fetch ?? globalThis.fetch
      const headers =
        typeof options.headers === 'function'
          ? await options.headers()
          : options.headers
      const response = await request(options.url, {
        ...(headers === undefined ? {} : { headers }),
      })
      if (!response.ok)
        throw new Error(
          `Remote content request failed with status ${String(response.status)}.`,
        )
      const payload: unknown = await response.json()
      const files = options.select?.(payload) ?? payload
      if (!Array.isArray(files))
        throw new TypeError('Remote content response must resolve to an array.')
      return files.map(file => decodeContentFile(file))
    },
    catch: cause => new RemoteContentError(String(options.url), cause),
  })

export const createRemoteContentSource = (
  options: RemoteContentOptions,
): ContentAdapter =>
  defineContentAdapter(options.name, () =>
    Effect.runPromise(loadRemoteContent(options)),
  )
