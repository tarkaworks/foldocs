export type JsonObject = Readonly<Record<string, unknown>>

export interface OpenApiInfo {
  readonly title: string
  readonly version: string
  readonly description?: string
}

export interface OpenApiDocument extends JsonObject {
  readonly openapi?: string
  readonly swagger?: string
  readonly info: OpenApiInfo
  readonly paths: Readonly<Record<string, JsonObject>>
  readonly servers?: ReadonlyArray<JsonObject>
  readonly components?: JsonObject
  readonly tags?: ReadonlyArray<JsonObject>
}

export type OpenApiInput = string | URL | OpenApiDocument

export interface GeneratedOpenApiFile {
  readonly path: string
  readonly content: string
}

export interface OpenApiGenerationOptions {
  /** Generated section title. Defaults to the OpenAPI info title. */
  readonly title?: string
  readonly description?: string
  /** Prefix used by generated links in the section index. */
  readonly baseUrl?: string
  /** Generate a root-folder meta.json and index page. Defaults to true. */
  readonly includeIndex?: boolean
  /** Mark generated navigation metadata as a layout root. Defaults to true. */
  readonly root?: boolean
}

export interface GenerateFilesOptions extends OpenApiGenerationOptions {
  readonly input: OpenApiInput
  readonly output: string
}
