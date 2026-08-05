import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'

import type {
  GenerateFilesOptions,
  GeneratedOpenApiFile,
  JsonObject,
  OpenApiDocument,
  OpenApiGenerationOptions,
  OpenApiInput,
} from './types.js'

export type {
  GeneratedOpenApiFile,
  GenerateFilesOptions,
  JsonObject,
  OpenApiDocument,
  OpenApiGenerationOptions,
  OpenApiInput,
} from './types.js'

const methods = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
  'trace',
] as const
const generatedManifestName = '.foldocs-openapi.json'

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asObject = (value: unknown): JsonObject | undefined =>
  isObject(value) ? value : undefined

const asObjects = (value: unknown): ReadonlyArray<JsonObject> =>
  Array.isArray(value) ? value.filter(isObject) : []

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

const asStringArray = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []

const escapeYamlString = (value: string): string => JSON.stringify(value)

const escapeTable = (value: string): string =>
  value.replaceAll('|', '\\|').replaceAll('\n', ' ')

const slugify = (value: string): string => {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
  return slug.length === 0 ? 'operation' : slug
}

const decodePointer = (value: string): string =>
  value.replaceAll('~1', '/').replaceAll('~0', '~')

const resolveReference = (
  document: OpenApiDocument,
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
    cursor = current[decodePointer(segment)]
  }
  return asObject(cursor)
}

const schemaType = (document: OpenApiDocument, value: unknown): string => {
  const schema = resolveReference(document, value)
  if (schema === undefined) return 'unknown'
  const type = asString(schema.type)
  const format = asString(schema.format)
  if (type !== undefined)
    return format === undefined ? type : `${type}<${format}>`
  if (Array.isArray(schema.oneOf)) return 'oneOf'
  if (Array.isArray(schema.anyOf)) return 'anyOf'
  if (Array.isArray(schema.allOf)) return 'allOf'
  return schema.properties === undefined ? 'unknown' : 'object'
}

const schemaExample = (
  document: OpenApiDocument,
  value: unknown,
  seen = new Set<JsonObject>(),
): unknown => {
  const schema = resolveReference(document, value)
  if (schema === undefined || seen.has(schema)) return null
  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default
  const examples = Array.isArray(schema.examples) ? schema.examples : []
  if (examples.length > 0) return examples[0]
  seen.add(schema)
  const type = asString(schema.type)
  if (type === 'array') return [schemaExample(document, schema.items, seen)]
  const properties = asObject(schema.properties)
  if (type === 'object' || properties !== undefined) {
    return Object.fromEntries(
      Object.entries(properties ?? {}).map(([name, property]) => [
        name,
        schemaExample(document, property, new Set(seen)),
      ]),
    )
  }
  if (type === 'integer' || type === 'number') return 0
  if (type === 'boolean') return false
  return 'string'
}

const schemaSection = (document: OpenApiDocument, value: unknown): string => {
  const schema = resolveReference(document, value)
  if (schema === undefined) return ''
  const properties = asObject(schema.properties)
  const required = new Set(asStringArray(schema.required))
  const rows = Object.entries(properties ?? {}).map(([name, property]) => {
    const resolved = resolveReference(document, property) ?? {}
    return `| \`${escapeTable(name)}\` | \`${escapeTable(schemaType(document, property))}\` | ${required.has(name) ? 'Yes' : 'No'} | ${escapeTable(asString(resolved.description) ?? '—')} |`
  })
  const table =
    rows.length === 0
      ? ''
      : [
          '| Field | Type | Required | Description |',
          '| --- | --- | --- | --- |',
          ...rows,
        ].join('\n')
  const example = schemaExample(document, schema)
  return [
    table,
    ['```json', JSON.stringify(example, null, 2), '```'].join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n')
}

const parameterRows = (
  document: OpenApiDocument,
  parameters: ReadonlyArray<unknown>,
): string => {
  const rows = parameters.flatMap(entry => {
    const parameter = resolveReference(document, entry)
    if (parameter === undefined) return []
    const name = asString(parameter.name)
    const location = asString(parameter.in)
    if (name === undefined || location === undefined) return []
    return [
      `| \`${escapeTable(name)}\` | ${escapeTable(location)} | ${parameter.required === true ? 'Yes' : 'No'} | \`${escapeTable(schemaType(document, parameter.schema))}\` | ${escapeTable(asString(parameter.description) ?? '—')} |`,
    ]
  })
  if (rows.length === 0) return ''
  return [
    '## Parameters',
    '',
    '| Name | In | Required | Type | Description |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n')
}

const requestBodySection = (
  document: OpenApiDocument,
  value: unknown,
): string => {
  const body = resolveReference(document, value)
  const content = asObject(body?.content)
  if (body === undefined || content === undefined) return ''
  const [mediaType, media] = Object.entries(content)[0] ?? []
  const schema = asObject(media)?.schema
  if (mediaType === undefined) return ''
  return [
    '## Request body',
    '',
    `${body.required === true ? 'Required' : 'Optional'} · \`${mediaType}\``,
    asString(body.description) ?? '',
    schemaSection(document, schema),
  ]
    .filter(Boolean)
    .join('\n\n')
}

const responseSections = (
  document: OpenApiDocument,
  value: unknown,
): string => {
  const responses = asObject(value)
  if (responses === undefined) return ''
  const sections = Object.entries(responses).flatMap(([status, candidate]) => {
    const response = resolveReference(document, candidate)
    if (response === undefined) return []
    const content = asObject(response.content)
    const [mediaType, media] = Object.entries(content ?? {})[0] ?? []
    const schema = asObject(media)?.schema
    return [
      [
        `### ${status} ${asString(response.description) ?? 'Response'}`,
        mediaType === undefined ? '' : `\`${mediaType}\``,
        schemaSection(document, schema),
      ]
        .filter(Boolean)
        .join('\n\n'),
    ]
  })
  return sections.length === 0 ? '' : ['## Responses', ...sections].join('\n\n')
}

const serverUrl = (document: OpenApiDocument): string =>
  asString(asObjects(document.servers)[0]?.url) ?? 'https://api.example.com'

const codeSamples = (
  document: OpenApiDocument,
  method: string,
  route: string,
  operation: JsonObject,
  languages: NonNullable<OpenApiGenerationOptions['codeSamples']>,
): string => {
  const url = `${serverUrl(document).replace(/\/+$/u, '')}${route}`
  const body = resolveReference(document, operation.requestBody)
  const media = Object.entries(asObject(body?.content) ?? {})[0]?.[1]
  const example = schemaExample(document, asObject(media)?.schema)
  const bodyJson = body === undefined ? undefined : JSON.stringify(example)
  const curl = [
    `curl --request ${method.toUpperCase()}`,
    `--url ${JSON.stringify(url)}`,
    ...(bodyJson === undefined
      ? []
      : ["--header 'content-type: application/json'", `--data '${bodyJson}'`]),
  ].join(' ')
  const javascript = [
    `const response = await fetch(${JSON.stringify(url)}, {`,
    `  method: ${JSON.stringify(method.toUpperCase())},`,
    ...(bodyJson === undefined
      ? []
      : [
          '  headers: { "content-type": "application/json" },',
          `  body: JSON.stringify(${JSON.stringify(example, null, 2).replaceAll('\n', '\n  ')}),`,
        ]),
    '});',
    '',
    'const data = await response.json();',
  ].join('\n')
  const samples = {
    curl: { language: 'bash', title: 'cURL', value: curl },
    typescript: {
      language: 'ts',
      title: 'TypeScript',
      value: javascript,
    },
    python: {
      language: 'python',
      title: 'Python',
      value: [
        'import requests',
        '',
        `response = requests.request(${JSON.stringify(method.toUpperCase())}, ${JSON.stringify(url)}${bodyJson === undefined ? '' : `, json=${JSON.stringify(example)}`})`,
        'data = response.json()',
      ].join('\n'),
    },
    go: {
      language: 'go',
      title: 'Go',
      value: [
        `request, err := http.NewRequest(${JSON.stringify(method.toUpperCase())}, ${JSON.stringify(url)}, ${bodyJson === undefined ? 'nil' : `strings.NewReader(${JSON.stringify(bodyJson)})`})`,
        'if err != nil { panic(err) }',
        ...(bodyJson === undefined
          ? []
          : ['request.Header.Set("content-type", "application/json")']),
        'response, err := http.DefaultClient.Do(request)',
        'if err != nil { panic(err) }',
        'defer response.Body.Close()',
      ].join('\n'),
    },
    java: {
      language: 'java',
      title: 'Java',
      value: [
        'var client = java.net.http.HttpClient.newHttpClient();',
        `var request = java.net.http.HttpRequest.newBuilder(java.net.URI.create(${JSON.stringify(url)}))`,
        ...(bodyJson === undefined
          ? [
              `  .method(${JSON.stringify(method.toUpperCase())}, java.net.http.HttpRequest.BodyPublishers.noBody())`,
            ]
          : [
              '  .header("content-type", "application/json")',
              `  .method(${JSON.stringify(method.toUpperCase())}, java.net.http.HttpRequest.BodyPublishers.ofString(${JSON.stringify(bodyJson)}))`,
            ]),
        '  .build();',
        'var response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());',
      ].join('\n'),
    },
    php: {
      language: 'php',
      title: 'PHP',
      value: [
        '$curl = curl_init();',
        `curl_setopt($curl, CURLOPT_URL, ${JSON.stringify(url)});`,
        `curl_setopt($curl, CURLOPT_CUSTOMREQUEST, ${JSON.stringify(method.toUpperCase())});`,
        ...(bodyJson === undefined
          ? []
          : [
              `curl_setopt($curl, CURLOPT_POSTFIELDS, ${JSON.stringify(bodyJson)});`,
              'curl_setopt($curl, CURLOPT_HTTPHEADER, ["content-type: application/json"]);',
            ]),
        'curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);',
        '$response = curl_exec($curl);',
      ].join('\n'),
    },
    csharp: {
      language: 'csharp',
      title: 'C#',
      value: [
        'using var client = new HttpClient();',
        `using var request = new HttpRequestMessage(new HttpMethod(${JSON.stringify(method.toUpperCase())}), ${JSON.stringify(url)});`,
        ...(bodyJson === undefined
          ? []
          : [
              `request.Content = new StringContent(${JSON.stringify(bodyJson)}, Encoding.UTF8, "application/json");`,
            ]),
        'using var response = await client.SendAsync(request);',
        'var data = await response.Content.ReadAsStringAsync();',
      ].join('\n'),
    },
  } as const
  return [
    '## Request examples',
    '',
    ...languages.flatMap(language => {
      const sample = samples[language]
      return [
        `\`\`\`${sample.language} tab=${JSON.stringify(sample.title)}`,
        sample.value,
        '```',
        '',
      ]
    }),
  ].join('\n')
}

const playground = (
  document: OpenApiDocument,
  entry: OperationEntry,
): string => {
  const body = resolveReference(document, entry.operation.requestBody)
  const media = Object.entries(asObject(body?.content) ?? {})[0]?.[1]
  const example =
    body === undefined
      ? ''
      : JSON.stringify(
          schemaExample(document, asObject(media)?.schema),
          null,
          2,
        )
  const url = `${serverUrl(document).replace(/\/+$/u, '')}${entry.route}`
  return `<ApiPlayground id=${JSON.stringify(entry.slug)} method=${JSON.stringify(entry.method.toUpperCase())} url=${JSON.stringify(url)} body=${JSON.stringify(encodeURIComponent(example))} />`
}

interface OperationEntry {
  readonly method: string
  readonly route: string
  readonly pathItem: JsonObject
  readonly operation: JsonObject
  readonly title: string
  readonly description?: string
  readonly slug: string
  readonly tags: ReadonlyArray<string>
}

const operations = (
  document: OpenApiDocument,
): ReadonlyArray<OperationEntry> => {
  const used = new Map<string, number>()
  return Object.entries(document.paths).flatMap(([route, pathItemValue]) => {
    const pathItem = resolveReference(document, pathItemValue)
    if (pathItem === undefined) return []
    return methods.flatMap(method => {
      const operation = resolveReference(document, pathItem[method])
      if (operation === undefined) return []
      const title =
        asString(operation.summary) ??
        asString(operation.operationId) ??
        `${method.toUpperCase()} ${route}`
      const base = slugify(
        asString(operation.operationId) ?? `${method}-${route}`,
      )
      const count = used.get(base) ?? 0
      used.set(base, count + 1)
      return [
        {
          method,
          route,
          pathItem,
          operation,
          title,
          ...(asString(operation.description) === undefined
            ? {}
            : { description: asString(operation.description)! }),
          slug: count === 0 ? base : `${base}-${String(count + 1)}`,
          tags: asStringArray(operation.tags),
        },
      ]
    })
  })
}

const operationMarkdown = (
  document: OpenApiDocument,
  entry: OperationEntry,
  order: number,
  options: OpenApiGenerationOptions,
): string => {
  const parameters = [
    ...(Array.isArray(entry.pathItem.parameters)
      ? entry.pathItem.parameters
      : []),
    ...(Array.isArray(entry.operation.parameters)
      ? entry.operation.parameters
      : []),
  ]
  const description =
    entry.description ?? `${entry.method.toUpperCase()} ${entry.route}`
  const frontmatter = [
    '---',
    `title: ${escapeYamlString(entry.title)}`,
    `description: ${escapeYamlString(description)}`,
    `label: ${escapeYamlString(`${entry.method.toUpperCase()} ${entry.route}`)}`,
    `order: ${String(order)}`,
    ...(entry.tags.length === 0
      ? []
      : ['tags:', ...entry.tags.map(tag => `  - ${escapeYamlString(tag)}`)]),
    '---',
  ].join('\n')
  return [
    frontmatter,
    `# ${entry.title}`,
    `\`${entry.method.toUpperCase()} ${entry.route}\``,
    entry.description ?? '',
    parameterRows(document, parameters),
    requestBodySection(document, entry.operation.requestBody),
    options.playground === false ? '' : playground(document, entry),
    codeSamples(
      document,
      entry.method,
      entry.route,
      entry.operation,
      options.codeSamples ?? ['curl', 'typescript', 'python', 'go'],
    ),
    responseSections(document, entry.operation.responses),
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim()
    .concat('\n')
}

const normalizeDocument = (value: unknown): OpenApiDocument => {
  if (!isObject(value)) throw new TypeError('OpenAPI input must be an object.')
  const info = asObject(value.info)
  const paths = asObject(value.paths)
  const title = asString(info?.title)
  const version = asString(info?.version)
  if (title === undefined || version === undefined || paths === undefined)
    throw new TypeError(
      'OpenAPI input requires info.title, info.version, and a paths object.',
    )
  if (
    asString(value.openapi) === undefined &&
    asString(value.swagger) === undefined
  )
    throw new TypeError('OpenAPI input requires an openapi or swagger version.')
  return value as OpenApiDocument
}

export const parseOpenApi = (source: string): OpenApiDocument =>
  normalizeDocument(parseYaml(source))

const readInput = async (input: OpenApiInput): Promise<OpenApiDocument> => {
  if (isObject(input)) return normalizeDocument(input)
  const target = input instanceof URL ? input : new URL(input, 'file:///')
  if (target.protocol === 'http:' || target.protocol === 'https:') {
    const response = await fetch(target)
    if (!response.ok)
      throw new Error(
        `Unable to load ${target.toString()}: ${String(response.status)} ${response.statusText}`,
      )
    return parseOpenApi(await response.text())
  }
  const filename =
    input instanceof URL || input.startsWith('file:')
      ? target
      : path.resolve(input)
  return parseOpenApi(await fs.readFile(filename, 'utf8'))
}

const joinUrl = (base: string, slug: string): string =>
  base.length === 0
    ? `./${slug}`
    : `${base.replace(/\/+$/u, '')}/${slug}`.replace(/\/{2,}/gu, '/')

const groupByTags = (
  entries: ReadonlyArray<OperationEntry>,
): ReadonlyMap<string, ReadonlyArray<OperationEntry>> => {
  const groups = new Map<string, OperationEntry[]>()
  for (const entry of entries) {
    const tags = entry.tags.length === 0 ? ['Other'] : entry.tags
    for (const tag of tags) {
      const existing = groups.get(tag)
      if (existing !== undefined) {
        existing.push(entry)
      } else {
        groups.set(tag, [entry])
      }
    }
  }
  return groups
}

export const generateOpenApiFiles = (
  documentInput: OpenApiDocument,
  options: OpenApiGenerationOptions = {},
): ReadonlyArray<GeneratedOpenApiFile> => {
  const document = normalizeDocument(documentInput)
  const entries = operations(document)
  const includeIndex = options.includeIndex ?? true
  const title = options.title ?? document.info.title
  const description =
    options.description ??
    document.info.description ??
    `${document.info.title} API reference`
  const baseUrl = options.baseUrl ?? ''
  const pages = entries.map((entry, index) => ({
    path: `${entry.slug}.mdx`,
    content: operationMarkdown(document, entry, index + 2, options),
  }))
  if (!includeIndex) return pages

  const groups = groupByTags(entries)

  const index = [
    '---',
    `title: ${escapeYamlString(title)}`,
    `description: ${escapeYamlString(description)}`,
    'order: 1',
    'index: true',
    '---',
    '',
    `# ${title}`,
    '',
    description,
    '',
    `OpenAPI ${document.openapi ?? document.swagger} · API ${document.info.version}`,
    '',
    '<ApiCards>',
    '',
    ...entries.flatMap(entry => [
      `<ApiCard href=${JSON.stringify(joinUrl(baseUrl, entry.slug))} method=${JSON.stringify(entry.method.toUpperCase())} title=${JSON.stringify(entry.title)} description=${JSON.stringify(entry.description ?? '')} />`,
      '',
    ]),
    '</ApiCards>',
  ]
    .join('\n')
    .trim()
    .concat('\n')

  const pagesOrder: Array<string> = ['index']
  for (const [tag, tagEntries] of groups) {
    pagesOrder.push(`---${tag}---`)
    for (const entry of tagEntries) {
      pagesOrder.push(entry.slug)
    }
  }

  const meta = JSON.stringify(
    {
      title,
      description,
      root: options.root ?? true,
      defaultOpen: true,
      pages: pagesOrder,
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
): Promise<ReadonlyArray<GeneratedOpenApiFile>> =>
  generateOpenApiFiles(await readInput(options.input), {
    ...options,
    baseUrl: options.baseUrl ?? path.basename(path.resolve(options.output)),
  })

/** Generates a managed Foldocs content directory from an OpenAPI document. */
export const generateFiles = async (
  options: GenerateFilesOptions,
): Promise<ReadonlyArray<GeneratedOpenApiFile>> => {
  const files = await generateFilesOnly(options)
  await fs.mkdir(options.output, { recursive: true })
  const manifestPath = path.join(options.output, generatedManifestName)
  const previous = await fs
    .readFile(manifestPath, 'utf8')
    .then(source => {
      const parsed: unknown = JSON.parse(source)
      return Array.isArray(parsed)
        ? parsed.filter(
            (entry): entry is string =>
              typeof entry === 'string' &&
              path.basename(entry) === entry &&
              entry !== generatedManifestName,
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
