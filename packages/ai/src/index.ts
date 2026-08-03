import { Data, Effect } from 'effect'

export type AiRole = 'user' | 'assistant'

export interface AiMessage {
  readonly role: AiRole
  readonly content: string
}

export interface AiSource {
  readonly title: string
  readonly url: string
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
}

export interface AiChatResponse {
  readonly message: string
  readonly sources?: ReadonlyArray<AiSource>
}

export class AiError extends Data.TaggedError('AiError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export interface AiClient {
  readonly chat: (
    request: AiChatRequest,
  ) => Effect.Effect<AiChatResponse, AiError>
}

export interface AiClientOptions {
  readonly endpoint: string
  readonly headers?: Readonly<Record<string, string>>
  readonly fetch?: typeof globalThis.fetch
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const responseFromUnknown = (value: unknown): AiChatResponse => {
  if (!isRecord(value) || typeof value.message !== 'string')
    throw new TypeError('AI endpoint response requires a message string.')
  const sources = Array.isArray(value.sources)
    ? value.sources.flatMap(source =>
        isRecord(source) &&
        typeof source.title === 'string' &&
        typeof source.url === 'string'
          ? [{ title: source.title, url: source.url }]
          : [],
      )
    : undefined
  return {
    message: value.message,
    ...(sources === undefined || sources.length === 0 ? {} : { sources }),
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
})

export interface AiProvider {
  readonly complete: (
    request: AiChatRequest,
  ) => Effect.Effect<AiChatResponse, AiError>
}

export interface OpenAiCompatibleOptions {
  readonly apiKey: string
  readonly model: string
  readonly baseUrl?: string
  readonly systemPrompt?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly fetch?: typeof globalThis.fetch
}

const pageContext = (request: AiChatRequest): string => {
  if (request.page === undefined) return ''
  return [
    `Documentation page: ${request.page.title}`,
    request.page.description ?? '',
    `URL: ${request.page.url}`,
    request.page.content,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Server-side adapter for OpenAI, Groq, OpenRouter, and compatible APIs. */
export const openAiCompatible = (
  options: OpenAiCompatibleOptions,
): AiProvider => ({
  complete: request =>
    Effect.tryPromise({
      try: async () => {
        const system = [
          options.systemPrompt ??
            'Answer using the supplied documentation. Say when the documentation does not contain the answer.',
          pageContext(request),
        ]
          .filter(Boolean)
          .join('\n\n')
        const response = await (options.fetch ?? globalThis.fetch)(
          `${(options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/u, '')}/chat/completions`,
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${options.apiKey}`,
              'content-type': 'application/json',
              ...options.headers,
            },
            body: JSON.stringify({
              model: options.model,
              messages: [
                { role: 'system', content: system },
                ...request.messages,
              ],
            }),
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
        return { message: message.content }
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
      const result = await Effect.runPromise(
        options.provider.complete(enriched),
      )
      return Response.json(result, { headers })
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400, headers },
      )
    }
  }
