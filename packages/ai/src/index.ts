import { Data, Effect, Schema } from 'effect'

export type AiRole = 'user' | 'assistant'

export interface AiMessage {
  readonly role: AiRole
  readonly content: string
}

export interface AiSource {
  readonly title: string
  readonly url: string
}

/** A retrieved documentation section merged into the prompt: see issue #10. */
export interface AiRetrievedSection extends AiSource {
  readonly breadcrumbs?: ReadonlyArray<string>
  readonly content: string
}

export interface AiChatRequest {
  readonly messages: ReadonlyArray<AiMessage>
  readonly locale?: string
  readonly pathname?: string
  readonly page?: Readonly<{
    title: string
    description?: string
    content: string
    url: string
  }>
  /** Sections an `enrich` hook has retrieved from the search index for this turn. */
  readonly retrieved?: ReadonlyArray<AiRetrievedSection>
  /** Requests a Server-Sent Events response from `createAiHandler`. */
  readonly stream?: boolean
}

export interface AiChatResponse {
  readonly message: string
  readonly sources?: ReadonlyArray<AiSource>
}

/** One chunk of a streamed reply: an incremental token, or the terminal event carrying citations. */
export type AiStreamEvent =
  | { readonly type: 'delta'; readonly content: string }
  | { readonly type: 'done'; readonly sources?: ReadonlyArray<AiSource> }

export class AiError extends Data.TaggedError('AiError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export interface AiClient {
  readonly chat: (
    request: AiChatRequest,
  ) => Effect.Effect<AiChatResponse, AiError>
  /** Streams the reply as it is generated. Falls back to `chat` where the endpoint does not support it. */
  readonly chatStream?: (
    request: AiChatRequest,
  ) => Effect.Effect<AsyncIterable<AiStreamEvent>, AiError>
}

export interface AiClientOptions {
  readonly endpoint: string
  readonly headers?: Readonly<Record<string, string>>
  readonly fetch?: typeof globalThis.fetch
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const sourceFromUnknown = (value: unknown): AiSource | undefined =>
  isRecord(value) &&
  typeof value.title === 'string' &&
  typeof value.url === 'string'
    ? { title: value.title, url: value.url }
    : undefined

const sourcesFromUnknown = (
  value: unknown,
): ReadonlyArray<AiSource> | undefined => {
  if (!Array.isArray(value)) return undefined
  const sources = value.flatMap(source => {
    const decoded = sourceFromUnknown(source)
    return decoded === undefined ? [] : [decoded]
  })
  return sources.length === 0 ? undefined : sources
}

const responseFromUnknown = (value: unknown): AiChatResponse => {
  if (!isRecord(value) || typeof value.message !== 'string')
    throw new TypeError('AI endpoint response requires a message string.')
  const sources = sourcesFromUnknown(value.sources)
  return {
    message: value.message,
    ...(sources === undefined ? {} : { sources }),
  }
}

/** Reads newline-delimited `data: <json>` Server-Sent Events from a fetch `Response`. */
const readSseData = async function* (
  response: Response,
): AsyncGenerator<string> {
  const reader = response.body?.getReader()
  if (reader === undefined) return
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data:')) yield trimmed.slice(5).trim()
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/** Browser client for a server-side Foldocs AI endpoint. */
export const createAiClient = (options: AiClientOptions): AiClient => ({
  chat: request =>
    Effect.tryPromise({
      try: async () => {
        const response = await (options.fetch ?? globalThis.fetch)(
          options.endpoint,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...options.headers,
            },
            body: JSON.stringify(request),
          },
        )
        if (!response.ok)
          throw new Error(
            `AI endpoint returned ${String(response.status)} ${response.statusText}.`,
          )
        return responseFromUnknown(await response.json())
      },
      catch: cause =>
        new AiError({
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    }),
  chatStream: request =>
    Effect.tryPromise({
      try: async () => {
        const response = await (options.fetch ?? globalThis.fetch)(
          options.endpoint,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              accept: 'text/event-stream',
              ...options.headers,
            },
            body: JSON.stringify({ ...request, stream: true }),
          },
        )
        if (!response.ok)
          throw new Error(
            `AI endpoint returned ${String(response.status)} ${response.statusText}.`,
          )
        async function* events(): AsyncGenerator<AiStreamEvent> {
          for await (const data of readSseData(response)) {
            const value: unknown = JSON.parse(data)
            if (!isRecord(value)) continue
            if (value.type === 'delta' && typeof value.content === 'string')
              yield { type: 'delta', content: value.content }
            else if (value.type === 'done') {
              const sources = sourcesFromUnknown(value.sources)
              yield {
                type: 'done',
                ...(sources === undefined ? {} : { sources }),
              }
            }
          }
        }
        return events()
      },
      catch: cause =>
        new AiError({
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    }),
})

export interface AiProvider {
  readonly complete: (
    request: AiChatRequest,
  ) => Effect.Effect<AiChatResponse, AiError>
  /** Optional streaming completion. Providers without native streaming can omit this. */
  readonly stream?: (
    request: AiChatRequest,
  ) => Effect.Effect<AsyncIterable<AiStreamEvent>, AiError>
}

export interface OpenAiCompatibleOptions {
  readonly apiKey: string
  readonly model: string
  readonly baseUrl?: string
  readonly systemPrompt?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly fetch?: typeof globalThis.fetch
}

/** Renders the current page and any retrieved sections into the system prompt. */
const promptContext = (request: AiChatRequest): string =>
  [
    request.page === undefined
      ? undefined
      : [
          `Documentation page: ${request.page.title}`,
          request.page.description ?? '',
          `URL: ${request.page.url}`,
          request.page.content,
        ]
          .filter(Boolean)
          .join('\n\n'),
    request.retrieved === undefined || request.retrieved.length === 0
      ? undefined
      : [
          'Related documentation sections retrieved for this question:',
          ...request.retrieved.map(section =>
            [
              `### ${section.title}${
                section.breadcrumbs === undefined ||
                section.breadcrumbs.length === 0
                  ? ''
                  : ` (${section.breadcrumbs.join(' > ')})`
              }`,
              `URL: ${section.url}`,
              section.content,
            ].join('\n'),
          ),
        ].join('\n\n'),
  ]
    .filter((value): value is string => value !== undefined && value.length > 0)
    .join('\n\n')

const openAiRequestBody = (
  options: OpenAiCompatibleOptions,
  request: AiChatRequest,
  stream: boolean,
): string => {
  const system = [
    options.systemPrompt ??
      'Answer using the supplied documentation. Say when the documentation does not contain the answer. Cite the URL of any section you rely on.',
    promptContext(request),
  ]
    .filter(Boolean)
    .join('\n\n')
  return JSON.stringify({
    model: options.model,
    stream,
    messages: [{ role: 'system', content: system }, ...request.messages],
  })
}

const openAiUrl = (options: OpenAiCompatibleOptions): string =>
  `${(options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/u, '')}/chat/completions`

const openAiHeaders = (
  options: OpenAiCompatibleOptions,
): Record<string, string> => ({
  authorization: `Bearer ${options.apiKey}`,
  'content-type': 'application/json',
  ...options.headers,
})

/** Sources cited by the retrieval step, deduplicated by URL. */
const retrievedSources = (
  request: AiChatRequest,
): ReadonlyArray<AiSource> | undefined => {
  if (request.retrieved === undefined || request.retrieved.length === 0)
    return undefined
  return request.retrieved.map(({ title, url }) => ({ title, url }))
}

/** Server-side adapter for OpenAI, Groq, OpenRouter, and compatible APIs. */
export const openAiCompatible = (
  options: OpenAiCompatibleOptions,
): AiProvider => ({
  complete: request =>
    Effect.tryPromise({
      try: async () => {
        const response = await (options.fetch ?? globalThis.fetch)(
          openAiUrl(options),
          {
            method: 'POST',
            headers: openAiHeaders(options),
            body: openAiRequestBody(options, request, false),
          },
        )
        if (!response.ok)
          throw new Error(
            `AI provider returned ${String(response.status)} ${response.statusText}.`,
          )
        const value: unknown = await response.json()
        const record = isRecord(value) ? value : {}
        const choices = Array.isArray(record.choices) ? record.choices : []
        const choice = isRecord(choices[0]) ? choices[0] : {}
        const message = isRecord(choice.message) ? choice.message : {}
        if (typeof message.content !== 'string')
          throw new TypeError('AI provider returned no message content.')
        const sources = retrievedSources(request)
        return {
          message: message.content,
          ...(sources === undefined ? {} : { sources }),
        }
      },
      catch: cause =>
        new AiError({
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    }),
  stream: request =>
    Effect.tryPromise({
      try: async () => {
        const response = await (options.fetch ?? globalThis.fetch)(
          openAiUrl(options),
          {
            method: 'POST',
            headers: openAiHeaders(options),
            body: openAiRequestBody(options, request, true),
          },
        )
        if (!response.ok)
          throw new Error(
            `AI provider returned ${String(response.status)} ${response.statusText}.`,
          )
        const sources = retrievedSources(request)
        async function* events(): AsyncGenerator<AiStreamEvent> {
          for await (const data of readSseData(response)) {
            if (data === '[DONE]') break
            const value: unknown = JSON.parse(data)
            const record = isRecord(value) ? value : {}
            const choices = Array.isArray(record.choices) ? record.choices : []
            const choice = isRecord(choices[0]) ? choices[0] : {}
            const delta = isRecord(choice.delta) ? choice.delta : {}
            if (typeof delta.content === 'string' && delta.content.length > 0)
              yield { type: 'delta', content: delta.content }
          }
          yield { type: 'done', ...(sources === undefined ? {} : { sources }) }
        }
        return events()
      },
      catch: cause =>
        new AiError({
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    }),
})

export interface AiHandlerOptions {
  readonly provider: AiProvider
  readonly corsOrigin?: string
  readonly enrich?: (
    request: AiChatRequest,
  ) => Effect.Effect<AiChatRequest, AiError>
}

const requestFromUnknown = (value: unknown): AiChatRequest => {
  if (!isRecord(value) || !Array.isArray(value.messages))
    throw new TypeError('AI request requires a messages array.')
  const messages: AiMessage[] = value.messages.flatMap(message =>
    isRecord(message) &&
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string'
      ? [{ role: message.role as AiRole, content: message.content }]
      : [],
  )
  if (messages.length !== value.messages.length)
    throw new TypeError('AI request contains an invalid message.')
  return {
    messages,
    ...(typeof value.locale === 'string' ? { locale: value.locale } : {}),
    ...(typeof value.pathname === 'string' ? { pathname: value.pathname } : {}),
    ...(typeof value.stream === 'boolean' ? { stream: value.stream } : {}),
    ...(isRecord(value.page) &&
    typeof value.page.title === 'string' &&
    typeof value.page.content === 'string' &&
    typeof value.page.url === 'string'
      ? {
          page: {
            title: value.page.title,
            content: value.page.content,
            url: value.page.url,
            ...(typeof value.page.description === 'string'
              ? { description: value.page.description }
              : {}),
          },
        }
      : {}),
  }
}

/** Merges provider-reported and retrieved sources, deduplicated by URL, provider first. */
const mergeSources = (
  provided: ReadonlyArray<AiSource> | undefined,
  retrieved: ReadonlyArray<AiRetrievedSection> | undefined,
): ReadonlyArray<AiSource> | undefined => {
  const seen = new Set<string>()
  const merged: AiSource[] = []
  for (const source of [
    ...(provided ?? []),
    ...(retrieved ?? []).map(({ title, url }) => ({ title, url })),
  ]) {
    if (seen.has(source.url)) continue
    seen.add(source.url)
    merged.push(source)
  }
  return merged.length === 0 ? undefined : merged
}

const sseHeaders = (
  corsOrigin: string | undefined,
): Record<string, string> => ({
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache',
  connection: 'keep-alive',
  ...(corsOrigin === undefined
    ? {}
    : { 'access-control-allow-origin': corsOrigin }),
})

const streamingResponse = async (
  provider: AiProvider,
  request: AiChatRequest,
  corsOrigin: string | undefined,
): Promise<Response> => {
  const events = await Effect.runPromise(provider.stream!(request))
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AiStreamEvent): void =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      try {
        for await (const event of events) {
          if (event.type !== 'done') {
            send(event)
            continue
          }
          const sources = mergeSources(event.sources, request.retrieved)
          send({ type: 'done', ...(sources === undefined ? {} : { sources }) })
        }
      } catch (error) {
        controller.error(error)
        return
      }
      controller.close()
    },
  })
  return new Response(body, { headers: sseHeaders(corsOrigin) })
}

/** Framework-neutral POST handler. Keep provider credentials on the server. */
export const createAiHandler =
  (options: AiHandlerOptions) =>
  async (request: Request): Promise<Response> => {
    const headers = {
      'content-type': 'application/json',
      ...(options.corsOrigin === undefined
        ? {}
        : { 'access-control-allow-origin': options.corsOrigin }),
    }
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers })
    if (request.method !== 'POST')
      return Response.json(
        { error: 'Method not allowed.' },
        { status: 405, headers },
      )
    try {
      const decoded = requestFromUnknown(await request.json())
      const enriched =
        options.enrich === undefined
          ? decoded
          : await Effect.runPromise(options.enrich(decoded))
      if (enriched.stream === true && options.provider.stream !== undefined)
        return streamingResponse(options.provider, enriched, options.corsOrigin)
      const result = await Effect.runPromise(
        options.provider.complete(enriched),
      )
      const sources = mergeSources(result.sources, enriched.retrieved)
      return Response.json(
        {
          message: result.message,
          ...(sources === undefined ? {} : { sources }),
        },
        { headers },
      )
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400, headers },
      )
    }
  }

export interface SearchRetrievalOptions {
  /** Per-locale `search-index.json` URLs, as published in `agent-readability.json`'s `artifacts.searchIndex`. */
  readonly searchIndexUrls: Readonly<Record<string, string>>
  /** Maximum retrieved sections merged into the prompt. Default: 4. */
  readonly limit?: number
  readonly fetch?: typeof globalThis.fetch
}

/**
 * Ships the retrieval `enrich` implementation proposed in issue #10: queries the same
 * per-locale search index the site's own search box uses, and merges the top results
 * into the prompt so citations agree with what a human would find in the search box.
 */
export const createSearchRetrievalEnrich = (
  options: SearchRetrievalOptions,
): ((request: AiChatRequest) => Effect.Effect<AiChatRequest, AiError>) => {
  const clients = new Map<
    string,
    Promise<import('@foldocs/search').SearchClient>
  >()

  const clientFor = (
    locale: string | undefined,
  ): Promise<import('@foldocs/search').SearchClient> | undefined => {
    const resolvedLocale = locale ?? Object.keys(options.searchIndexUrls)[0]
    const url =
      resolvedLocale === undefined
        ? undefined
        : options.searchIndexUrls[resolvedLocale]
    if (url === undefined) return undefined
    let client = clients.get(url)
    if (client === undefined) {
      client = (async () => {
        const { SearchDocument } = await import('@foldocs/search')
        const { createOramaSearchClient } =
          await import('@foldocs/search-orama')
        const response = await (options.fetch ?? globalThis.fetch)(url)
        if (!response.ok)
          throw new Error(`Failed to fetch search index: ${response.status}`)
        const documents = Schema.decodeUnknownSync(
          Schema.Array(SearchDocument),
        )(await response.json())
        return createOramaSearchClient(documents)
      })()
      clients.set(url, client)
    }
    return client
  }

  return request =>
    Effect.tryPromise({
      try: async () => {
        const query = [...request.messages]
          .reverse()
          .find(message => message.role === 'user')?.content
        if (query === undefined || query.trim().length === 0) return request
        const client = await clientFor(request.locale)
        if (client === undefined) return request
        const results = await Effect.runPromise(
          client.search(query, {
            limit: options.limit ?? 4,
            ...(request.locale === undefined ? {} : { locale: request.locale }),
          }),
        )
        if (results.length === 0) return request
        return {
          ...request,
          retrieved: results.map(result => ({
            title: result.pageTitle ?? result.title,
            url: result.url,
            ...(result.breadcrumbs === undefined
              ? {}
              : { breadcrumbs: result.breadcrumbs }),
            content: result.excerpt,
          })),
        }
      },
      catch: cause =>
        new AiError({
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    })
}
