import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'

import type {
  AsyncApiDocument,
  AsyncApiGenerationOptions,
  AsyncApiInput,
  GenerateFilesOptions,
  GeneratedAsyncApiFile,
  JsonObject,
} from './types.js'

export type {
  AsyncApiDocument,
  AsyncApiGenerationOptions,
  AsyncApiInput,
  GeneratedAsyncApiFile,
  GenerateFilesOptions,
  JsonObject,
} from './types.js'

const manifestName = '.foldocs-asyncapi.json'

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asObject = (value: unknown): JsonObject | undefined =>
  isObject(value) ? value : undefined

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

const asStringArray = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []

const slugify = (value: string): string => {
  const result = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
  return result.length === 0 ? 'operation' : result
}

const escapeTable = (value: string): string =>
  value.replaceAll('|', '\\|').replaceAll('\n', ' ')

const resolveReference = (
  document: AsyncApiDocument,
  value: unknown,
): JsonObject | undefined => {
  const object = asObject(value)
  const reference = asString(object?.$ref)
  if (object === undefined || reference === undefined) return object
  if (!reference.startsWith('#/')) return object
  let cursor: unknown = document
  for (const segment of reference.slice(2).split('/')) {
    const current = asObject(cursor)
    if (current === undefined) return undefined
    cursor = current[segment.replaceAll('~1', '/').replaceAll('~0', '~')]
  }
  return asObject(cursor)
}

const schemaType = (document: AsyncApiDocument, value: unknown): string => {
  const schema = resolveReference(document, value)
  if (schema === undefined) return 'unknown'
  const type = asString(schema.type)
  const format = asString(schema.format)
  if (type !== undefined)
    return format === undefined ? type : `${type}<${format}>`
  return schema.properties === undefined ? 'unknown' : 'object'
}

const schemaExample = (
  document: AsyncApiDocument,
  value: unknown,
  seen = new Set<JsonObject>(),
): unknown => {
  const schema = resolveReference(document, value)
  if (schema === undefined || seen.has(schema)) return null
  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default
  seen.add(schema)
  const type = asString(schema.type)
  if (type === 'array') return [schemaExample(document, schema.items, seen)]
  const properties = asObject(schema.properties)
  if (type === 'object' || properties !== undefined)
    return Object.fromEntries(
      Object.entries(properties ?? {}).map(([name, property]) => [
        name,
        schemaExample(document, property, new Set(seen)),
      ]),
    )
  if (type === 'number' || type === 'integer') return 0
  if (type === 'boolean') return false
  return 'string'
}

const schemaSection = (document: AsyncApiDocument, value: unknown): string => {
  const schema = resolveReference(document, value)
  if (schema === undefined) return ''
  const required = new Set(asStringArray(schema.required))
  const rows = Object.entries(asObject(schema.properties) ?? {}).map(
    ([name, candidate]) => {
      const property = resolveReference(document, candidate) ?? {}
      return `| \`${escapeTable(name)}\` | \`${escapeTable(schemaType(document, candidate))}\` | ${required.has(name) ? 'Yes' : 'No'} | ${escapeTable(asString(property.description) ?? '—')} |`
    },
  )
  return [
    ...(rows.length === 0
      ? []
      : [
          [
            '| Field | Type | Required | Description |',
            '| --- | --- | --- | --- |',
            ...rows,
          ].join('\n'),
        ]),
    [
      '```json',
      JSON.stringify(schemaExample(document, schema), null, 2),
      '```',
    ].join('\n'),
  ].join('\n\n')
}

interface AsyncOperation {
  readonly action: string
  readonly channel: string
  readonly operation: JsonObject
  readonly message?: JsonObject
  readonly title: string
  readonly description?: string
  readonly slug: string
  readonly tags: ReadonlyArray<string>
}

const messageFromOperation = (
  document: AsyncApiDocument,
  operation: JsonObject,
): JsonObject | undefined => {
  const direct = resolveReference(document, operation.message)
  if (direct !== undefined) return direct
  const first = Array.isArray(operation.messages)
    ? operation.messages[0]
    : undefined
  return resolveReference(document, first)
}

const v2Operations = (
  document: AsyncApiDocument,
): ReadonlyArray<Omit<AsyncOperation, 'slug'>> =>
  Object.entries(document.channels ?? {}).flatMap(([channel, candidate]) => {
    const channelItem = resolveReference(document, candidate)
    if (channelItem === undefined) return []
    return (['publish', 'subscribe'] as const).flatMap(action => {
      const operation = resolveReference(document, channelItem[action])
      if (operation === undefined) return []
      const message = messageFromOperation(document, operation)
      const title =
        asString(operation.summary) ??
        asString(operation.operationId) ??
        `${action.toUpperCase()} ${channel}`
      return [
        {
          action,
          channel,
          operation,
          ...(message === undefined ? {} : { message }),
          title,
          ...(asString(operation.description) === undefined
            ? {}
            : { description: asString(operation.description)! }),
          tags: Array.isArray(operation.tags)
            ? operation.tags.flatMap(tag => {
                const name = asString(asObject(tag)?.name) ?? asString(tag)
                return name === undefined ? [] : [name]
              })
            : [],
        },
      ]
    })
  })

const v3Operations = (
  document: AsyncApiDocument,
): ReadonlyArray<Omit<AsyncOperation, 'slug'>> =>
  Object.entries(document.operations ?? {}).flatMap(
    ([operationId, candidate]) => {
      const operation = resolveReference(document, candidate)
      if (operation === undefined) return []
      const channelObject = resolveReference(document, operation.channel)
      const reference = asString(asObject(operation.channel)?.$ref)
      const channel =
        asString(channelObject?.address) ??
        (reference === undefined
          ? operationId
          : (reference.split('/').at(-1)?.replaceAll('~1', '/') ?? operationId))
      const action = asString(operation.action) ?? 'send'
      const message = messageFromOperation(document, operation)
      return [
        {
          action,
          channel,
          operation,
          ...(message === undefined ? {} : { message }),
          title:
            asString(operation.summary) ??
            asString(operation.title) ??
            operationId,
          ...(asString(operation.description) === undefined
            ? {}
            : { description: asString(operation.description)! }),
          tags: Array.isArray(operation.tags)
            ? operation.tags.flatMap(tag => {
                const name = asString(asObject(tag)?.name) ?? asString(tag)
                return name === undefined ? [] : [name]
              })
            : [],
        },
      ]
    },
  )

const operations = (
  document: AsyncApiDocument,
): ReadonlyArray<AsyncOperation> => {
  const entries =
    document.operations === undefined
      ? v2Operations(document)
      : v3Operations(document)
  const used = new Map<string, number>()
  return entries.map(entry => {
    const base = slugify(
      asString(entry.operation.operationId) ??
        `${entry.action}-${entry.channel}`,
    )
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    return {
      ...entry,
      slug: count === 0 ? base : `${base}-${String(count + 1)}`,
    }
  })
}

const operationPage = (
  document: AsyncApiDocument,
  entry: AsyncOperation,
  order: number,
): string => {
  const description =
    entry.description ?? `${entry.action.toUpperCase()} ${entry.channel}`
  const frontmatter = [
    '---',
    `title: ${JSON.stringify(entry.title)}`,
    `description: ${JSON.stringify(description)}`,
    `label: ${JSON.stringify(`${entry.action.toUpperCase()} ${entry.channel}`)}`,
    `order: ${String(order)}`,
    ...(entry.tags.length === 0
      ? []
      : ['tags:', ...entry.tags.map(tag => `  - ${JSON.stringify(tag)}`)]),
    '---',
  ].join('\n')
  const message = entry.message
  const bindings =
    asObject(entry.operation.bindings) ?? asObject(message?.bindings)
  return [
    frontmatter,
    `# ${entry.title}`,
    `\`${entry.action.toUpperCase()} ${entry.channel}\``,
    entry.description ?? '',
    message === undefined
      ? ''
      : [
          `## Message${asString(message.name) === undefined ? '' : `: ${asString(message.name)}`}`,
          asString(message.description) ?? '',
        ]
          .filter(Boolean)
          .join('\n\n'),
    message?.headers === undefined
      ? ''
      : ['### Headers', schemaSection(document, message.headers)].join('\n\n'),
    message?.payload === undefined
      ? ''
      : ['### Payload', schemaSection(document, message.payload)].join('\n\n'),
    bindings === undefined
      ? ''
      : [
          '## Protocol bindings',
          '```json',
          JSON.stringify(bindings, null, 2),
          '```',
        ].join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim()
    .concat('\n')
}

const normalizeDocument = (value: unknown): AsyncApiDocument => {
  if (!isObject(value)) throw new TypeError('AsyncAPI input must be an object.')
  const info = asObject(value.info)
  if (
    asString(value.asyncapi) === undefined ||
    asString(info?.title) === undefined ||
    asString(info?.version) === undefined ||
    (asObject(value.channels) === undefined &&
      asObject(value.operations) === undefined)
  )
    throw new TypeError(
      'AsyncAPI input requires asyncapi, info.title, info.version, and channels or operations.',
    )
  return value as AsyncApiDocument
}

export const parseAsyncApi = (source: string): AsyncApiDocument =>
  normalizeDocument(parseYaml(source))

const readInput = async (input: AsyncApiInput): Promise<AsyncApiDocument> => {
  if (isObject(input)) return normalizeDocument(input)
  const target = input instanceof URL ? input : new URL(input, 'file:///')
  if (target.protocol === 'http:' || target.protocol === 'https:') {
    const response = await fetch(target)
    if (!response.ok)
      throw new Error(
        `Unable to load ${target.toString()}: ${String(response.status)} ${response.statusText}`,
      )
    return parseAsyncApi(await response.text())
  }
  const filename =
    input instanceof URL || input.startsWith('file:')
      ? target
      : path.resolve(input)
  return parseAsyncApi(await fs.readFile(filename, 'utf8'))
}

const operationUrl = (base: string, slug: string): string =>
  base.length === 0
    ? `./${slug}`
    : `${base.replace(/\/+$/u, '')}/${slug}`.replace(/\/{2,}/gu, '/')

export const generateAsyncApiFiles = (
  documentInput: AsyncApiDocument,
  options: AsyncApiGenerationOptions = {},
): ReadonlyArray<GeneratedAsyncApiFile> => {
  const document = normalizeDocument(documentInput)
  const entries = operations(document)
  const title = options.title ?? document.info.title
  const description =
    options.description ??
    document.info.description ??
    `${document.info.title} event reference`
  const pages = entries.map((entry, index) => ({
    path: `${entry.slug}.mdx`,
    content: operationPage(document, entry, index + 2),
  }))
  if (!(options.includeIndex ?? true)) return pages
  const baseUrl = options.baseUrl ?? ''
  const index = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    'order: 1',
    '---',
    '',
    `# ${title}`,
    '',
    description,
    '',
    `AsyncAPI ${document.asyncapi} · API ${document.info.version}`,
    '',
    ...entries.flatMap(entry => [
      `## [${entry.title}](${operationUrl(baseUrl, entry.slug)})`,
      '',
      `\`${entry.action.toUpperCase()} ${entry.channel}\``,
      '',
      entry.description ?? '',
      '',
    ]),
  ]
    .join('\n')
    .trim()
    .concat('\n')
  const meta = JSON.stringify(
    {
      title,
      description,
      root: options.root ?? true,
      defaultOpen: true,
      pages: ['index', ...entries.map(entry => entry.slug)],
    },
    null,
    2,
  ).concat('\n')
  return [
    { path: 'index.mdx', content: index },
    { path: 'meta.json', content: meta },
    ...pages,
  ]
}

export const generateFilesOnly = async (
  options: GenerateFilesOptions,
): Promise<ReadonlyArray<GeneratedAsyncApiFile>> =>
  generateAsyncApiFiles(await readInput(options.input), {
    ...options,
    baseUrl: options.baseUrl ?? path.basename(path.resolve(options.output)),
  })

export const generateFiles = async (
  options: GenerateFilesOptions,
): Promise<ReadonlyArray<GeneratedAsyncApiFile>> => {
  const files = await generateFilesOnly(options)
  await fs.mkdir(options.output, { recursive: true })
  const manifestPath = path.join(options.output, manifestName)
  const previous = await fs
    .readFile(manifestPath, 'utf8')
    .then(source => {
      const parsed: unknown = JSON.parse(source)
      return Array.isArray(parsed)
        ? parsed.filter(
            (entry): entry is string =>
              typeof entry === 'string' &&
              path.basename(entry) === entry &&
              entry !== manifestName,
          )
        : []
    })
    .catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    })
  const next = new Set(files.map(file => file.path))
  await Promise.all(
    previous
      .filter(filename => !next.has(filename))
      .map(filename =>
        fs
          .unlink(path.join(options.output, filename))
          .catch((error: unknown) => {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          }),
      ),
  )
  await Promise.all(
    files.map(file =>
      fs.writeFile(path.join(options.output, file.path), file.content, 'utf8'),
    ),
  )
  await fs.writeFile(
    manifestPath,
    JSON.stringify([...next].toSorted(), null, 2).concat('\n'),
    'utf8',
  )
  return files
}
