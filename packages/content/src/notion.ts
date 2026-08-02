type RichText = Readonly<{
  readonly plain_text?: string
  readonly href?: string | null
  readonly annotations?: Readonly<{
    readonly bold?: boolean
    readonly italic?: boolean
    readonly strikethrough?: boolean
    readonly code?: boolean
  }>
}>

type NotionProperty = Readonly<Record<string, unknown>>

type NotionPage = Readonly<{
  readonly id: string
  readonly last_edited_time?: string
  readonly properties?: Readonly<Record<string, NotionProperty>>
}>

type NotionBlock = Readonly<{
  readonly id: string
  readonly type: string
  readonly has_children?: boolean
  readonly [key: string]: unknown
}>

interface Paginated<T> {
  readonly results: ReadonlyArray<T>
  readonly has_more?: boolean
  readonly next_cursor?: string | null
}

export interface NotionClientLike {
  readonly dataSources: {
    readonly query: (
      input: Readonly<Record<string, unknown>> & {
        readonly data_source_id: string
        readonly start_cursor?: string
      },
    ) => Promise<Paginated<NotionPage>>
  }
  readonly blocks: {
    readonly children: {
      readonly list: (input: {
        readonly block_id: string
        readonly page_size?: number
        readonly start_cursor?: string
      }) => Promise<Paginated<NotionBlock>>
    }
  }
}

export interface NotionOptions {
  readonly client: NotionClientLike
  /** Notion data source ID (the post-2025-09-03 API), not a database ID. */
  readonly dataSourceId: string
  readonly name?: string
  readonly locale?: string
  readonly baseDir?: string
  readonly query?: Readonly<Record<string, unknown>>
  readonly properties?: {
    readonly title?: string
    readonly slug?: string
    readonly description?: string
    readonly tags?: string
    readonly locale?: string
  }
}

interface NotionContentFile {
  readonly path: string
  readonly source: string
  readonly locale?: string
  readonly lastModified?: string
}

interface NotionContentAdapter {
  readonly name: string
  readonly load: () => Promise<ReadonlyArray<NotionContentFile>>
}

const markdownEscape = (value: string): string =>
  value.replace(/([\\`*_[\]<>])/gu, '\\$1')

const richText = (values: unknown): string =>
  (Array.isArray(values) ? (values as RichText[]) : [])
    .map(value => {
      let text = markdownEscape(value.plain_text ?? '')
      if (value.annotations?.code) text = `\`${text.replaceAll('`', '\\`')}\``
      if (value.annotations?.bold) text = `**${text}**`
      if (value.annotations?.italic) text = `_${text}_`
      if (value.annotations?.strikethrough) text = `~~${text}~~`
      return value.href == null ? text : `[${text}](${value.href})`
    })
    .join('')

const propertyValues = (property: NotionProperty | undefined): unknown[] => {
  if (property === undefined) return []
  for (const key of ['title', 'rich_text', 'multi_select', 'select']) {
    const value = property[key]
    if (Array.isArray(value)) return value
    if (value !== undefined && value !== null) return [value]
  }
  const formula = property.formula
  if (typeof formula === 'object' && formula !== null) return [formula]
  return []
}

const propertyText = (property: NotionProperty | undefined): string =>
  propertyValues(property)
    .map(value => {
      if (typeof value === 'string') return value
      if (typeof value !== 'object' || value === null) return ''
      const record = value as Record<string, unknown>
      if (typeof record.plain_text === 'string') return record.plain_text
      if (typeof record.name === 'string') return record.name
      for (const key of ['string', 'number', 'url'])
        if (typeof record[key] === 'string' || typeof record[key] === 'number')
          return String(record[key])
      return ''
    })
    .filter(Boolean)
    .join(' ')

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')

const blockValue = (block: NotionBlock): Record<string, unknown> => {
  const value = block[block.type]
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

const indent = (value: string, prefix: string): string =>
  value
    .split('\n')
    .map(line => (line.length === 0 ? line : `${prefix}${line}`))
    .join('\n')

const paginatedChildren = async (
  client: NotionClientLike,
  blockId: string,
): Promise<ReadonlyArray<NotionBlock>> => {
  const blocks: NotionBlock[] = []
  let cursor: string | undefined
  do {
    const response = await client.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      ...(cursor === undefined ? {} : { start_cursor: cursor }),
    })
    blocks.push(...response.results)
    cursor =
      response.has_more && response.next_cursor != null
        ? response.next_cursor
        : undefined
  } while (cursor !== undefined)
  return blocks
}

const blocksToMarkdown = async (
  client: NotionClientLike,
  blocks: ReadonlyArray<NotionBlock>,
): Promise<string> => {
  const output: string[] = []
  for (const block of blocks) {
    const value = blockValue(block)
    const text = richText(value.rich_text)
    const children = block.has_children
      ? await blocksToMarkdown(
          client,
          await paginatedChildren(client, block.id),
        )
      : ''
    switch (block.type) {
      case 'paragraph':
        output.push([text, children].filter(Boolean).join('\n\n'))
        break
      case 'heading_1':
      case 'heading_2':
      case 'heading_3':
        output.push(
          `${'#'.repeat(Number(block.type.at(-1)))} ${text}${children.length === 0 ? '' : `\n\n${children}`}`,
        )
        break
      case 'bulleted_list_item':
        output.push(
          `- ${text}${children.length === 0 ? '' : `\n${indent(children, '  ')}`}`,
        )
        break
      case 'numbered_list_item':
        output.push(
          `1. ${text}${children.length === 0 ? '' : `\n${indent(children, '   ')}`}`,
        )
        break
      case 'to_do':
        output.push(
          `- [${value.checked === true ? 'x' : ' '}] ${text}${children.length === 0 ? '' : `\n${indent(children, '  ')}`}`,
        )
        break
      case 'quote':
        output.push(indent([text, children].filter(Boolean).join('\n\n'), '> '))
        break
      case 'callout':
        output.push(
          `> [!NOTE]\n${indent([text, children].filter(Boolean).join('\n\n'), '> ')}`,
        )
        break
      case 'code': {
        const language =
          typeof value.language === 'string' ? value.language : 'text'
        const code = richText(value.rich_text)
        output.push(`\`\`\`${language}\n${code}\n\`\`\``)
        break
      }
      case 'equation': {
        const expression =
          typeof value.expression === 'string' ? value.expression : ''
        output.push(`$$\n${expression}\n$$`)
        break
      }
      case 'divider':
        output.push('---')
        break
      case 'toggle':
        output.push(
          `<Accordion title="${text.replaceAll('"', '&quot;')}">\n\n${children}\n\n</Accordion>`,
        )
        break
      case 'bookmark': {
        const url = typeof value.url === 'string' ? value.url : ''
        if (url.length > 0) output.push(`[${url}](${url})`)
        break
      }
      case 'image': {
        const source =
          typeof value.external === 'object' && value.external !== null
            ? (value.external as Record<string, unknown>).url
            : typeof value.file === 'object' && value.file !== null
              ? (value.file as Record<string, unknown>).url
              : undefined
        if (typeof source === 'string')
          output.push(`![${richText(value.caption)}](${source})`)
        break
      }
      default:
        if (children.length > 0) output.push(children)
    }
  }
  return output.filter(Boolean).join('\n\n')
}

const yamlString = (value: string): string => JSON.stringify(value)

/** Creates a build-time ContentAdapter for the current Notion data-source API. */
export const notion = (options: NotionOptions): NotionContentAdapter => ({
  name: options.name ?? 'notion',
  load: async () => {
    const pages: NotionPage[] = []
    let cursor: string | undefined
    do {
      const response = await options.client.dataSources.query({
        data_source_id: options.dataSourceId,
        page_size: 100,
        ...(options.query ?? {}),
        ...(cursor === undefined ? {} : { start_cursor: cursor }),
      })
      pages.push(...response.results)
      cursor =
        response.has_more && response.next_cursor != null
          ? response.next_cursor
          : undefined
    } while (cursor !== undefined)

    const names = {
      title: options.properties?.title ?? 'Name',
      slug: options.properties?.slug ?? 'Slug',
      description: options.properties?.description ?? 'Description',
      tags: options.properties?.tags ?? 'Tags',
      locale: options.properties?.locale ?? 'Locale',
    }
    const paths = new Set<string>()
    return Promise.all(
      pages.map(async page => {
        const properties = page.properties ?? {}
        const title = propertyText(properties[names.title]) || 'Untitled'
        const configuredSlug = propertyText(properties[names.slug])
        const slug = slugify(configuredSlug || title) || page.id
        const locale =
          propertyText(properties[names.locale]) || options.locale || undefined
        const baseDir = (options.baseDir ?? '').replace(/^\/+|\/+$/gu, '')
        const path = `${baseDir.length === 0 ? '' : `${baseDir}/`}${slug}.mdx`
        if (paths.has(path))
          throw new TypeError(`Notion pages produced duplicate path ${path}.`)
        paths.add(path)
        const description = propertyText(properties[names.description])
        const tags = propertyValues(properties[names.tags])
          .map(value =>
            typeof value === 'object' && value !== null
              ? String((value as Record<string, unknown>).name ?? '')
              : String(value),
          )
          .filter(Boolean)
        const body = await blocksToMarkdown(
          options.client,
          await paginatedChildren(options.client, page.id),
        )
        const frontmatter = [
          '---',
          `title: ${yamlString(title)}`,
          ...(description.length === 0
            ? []
            : [`description: ${yamlString(description)}`]),
          ...(tags.length === 0 ? [] : [`tags: ${JSON.stringify(tags)}`]),
          '---',
        ].join('\n')
        return {
          path,
          source: `${frontmatter}\n\n${body}\n`,
          ...(locale === undefined ? {} : { locale }),
          ...(page.last_edited_time === undefined
            ? {}
            : { lastModified: page.last_edited_time }),
        }
      }),
    )
  },
})
