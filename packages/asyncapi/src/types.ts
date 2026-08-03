export type JsonObject = Readonly<Record<string, unknown>>

export interface AsyncApiInfo {
  readonly title: string
  readonly version: string
  readonly description?: string
}

export interface AsyncApiDocument extends JsonObject {
  readonly asyncapi: string
  readonly info: AsyncApiInfo
  readonly channels?: Readonly<Record<string, JsonObject>>
  readonly operations?: Readonly<Record<string, JsonObject>>
  readonly components?: JsonObject
  readonly servers?: Readonly<Record<string, JsonObject>>
}

export type AsyncApiInput = string | URL | AsyncApiDocument

export interface GeneratedAsyncApiFile {
  readonly path: string
  readonly content: string
}

export interface AsyncApiGenerationOptions {
  readonly title?: string
  readonly description?: string
  readonly baseUrl?: string
  readonly includeIndex?: boolean
  readonly root?: boolean
  /** Emit a payload playground for each operation. Defaults to true. */
  readonly playground?: boolean
}

export interface GenerateFilesOptions extends AsyncApiGenerationOptions {
  readonly input: AsyncApiInput
  readonly output: string
}
