import type {
  Block,
  BlockComponent,
  Document,
  Inline,
  TableRow,
} from './ast.js'

export interface MarkdownSerializeOptions {
  /** Production origin used to make root-relative links agent-friendly. */
  readonly baseUrl?: string
}

const resolveUrl = (value: string, baseUrl?: string): string => {
  if (baseUrl === undefined || !value.startsWith('/')) return value
  return new URL(
    value.replace(/^\//u, ''),
    `${baseUrl.replace(/\/+$/u, '')}/`,
  ).toString()
}

const inlineCode = (value: string): string => {
  const fence = value.includes('`') ? '``' : '`'
  const padding = /^\s|\s$/u.test(value) ? ' ' : ''
  return `${fence}${padding}${value}${padding}${fence}`
}

const renderInline = (
  inline: Inline,
  options: MarkdownSerializeOptions,
): string => {
  switch (inline._tag) {
    case 'Text':
      return inline.value
    case 'InlineCode':
      return inlineCode(inline.value)
    case 'InlineMath':
      return `$${inline.value}$`
    case 'HardBreak':
      return '  \n'
    case 'Emphasis':
      return `_${renderInlines(inline.content, options)}_`
    case 'Strong':
      return `**${renderInlines(inline.content, options)}**`
    case 'Strikethrough':
      return `~~${renderInlines(inline.content, options)}~~`
    case 'Link': {
      const title =
        inline.title === undefined
          ? ''
          : ` \"${inline.title.replaceAll('"', '\\"')}\"`
      return `[${renderInlines(inline.content, options)}](${resolveUrl(inline.url, options.baseUrl)}${title})`
    }
    case 'Image': {
      const title =
        inline.title === undefined
          ? ''
          : ` \"${inline.title.replaceAll('"', '\\"')}\"`
      return `![${inline.alt}](${resolveUrl(inline.url, options.baseUrl)}${title})`
    }
    case 'InlineComponent': {
      const content = renderInlines(inline.content, options)
      if (content.length > 0) return content
      return (
        inline.attributes.label ??
        inline.attributes.title ??
        inline.attributes.value ??
        `<!-- ${inline.name}: no static content available for Markdown export -->`
      )
    }
  }
}

const renderInlines = (
  content: ReadonlyArray<Inline>,
  options: MarkdownSerializeOptions,
): string => content.map(inline => renderInline(inline, options)).join('')

const indent = (value: string, prefix: string): string =>
  value
    .split('\n')
    .map(line => (line.length === 0 ? line : `${prefix}${line}`))
    .join('\n')

const tableRow = (row: TableRow, options: MarkdownSerializeOptions): string =>
  `| ${row.cells
    .map(cell =>
      renderInlines(cell.content, options)
        .replaceAll('|', '\\|')
        .replaceAll('\n', ' '),
    )
    .join(' | ')} |`

const renderComponent = (
  component: BlockComponent,
  options: MarkdownSerializeOptions,
): string => {
  const body = renderBlocks(component.blocks, options)
  const title = component.attributes.title

  if (component.name === 'Callout' || component.name === 'Note') {
    const kind = (component.attributes.type ?? 'NOTE').toUpperCase()
    const header = `> [!${kind}]${title === undefined ? '' : ` ${title}`}`
    return body.length === 0 ? header : `${header}\n${indent(body, '> ')}`
  }

  if (component.name === 'Card' && title !== undefined) {
    const href = component.attributes.href
    const heading =
      href === undefined
        ? `### ${title}`
        : `### [${title}](${resolveUrl(href, options.baseUrl)})`
    return body.length === 0 ? heading : `${heading}\n\n${body}`
  }

  if (component.name === 'MdxModule') return ''

  if (body.length > 0)
    return title === undefined ? body : `**${title}**\n\n${body}`
  if (title !== undefined) return `**${title}**`
  const fallback =
    component.attributes.label ??
    component.attributes.value ??
    component.attributes.caption
  if (fallback !== undefined) return fallback
  return `<!-- ${component.name}: no static content available for Markdown export -->`
}

const renderBlock = (
  block: Block,
  options: MarkdownSerializeOptions,
): string => {
  switch (block._tag) {
    case 'Heading':
      return `${'#'.repeat(Math.max(1, Math.min(6, block.level)))} ${renderInlines(block.content, options)}`
    case 'Paragraph':
      return renderInlines(block.content, options)
    case 'CodeBlock': {
      const longestFence = Math.max(
        3,
        ...[...block.value.matchAll(/`+/gu)].map(([value]) => value.length + 1),
      )
      const fence = '`'.repeat(longestFence)
      const info = [block.language, block.meta].filter(Boolean).join(' ')
      return `${fence}${info}\n${block.value.replace(/\n+$/u, '')}\n${fence}`
    }
    case 'MathBlock':
      return `$$\n${block.value}\n$$`
    case 'Mermaid':
      return `\`\`\`mermaid\n${block.value.replace(/\n+$/u, '')}\n\`\`\``
    case 'PackageInstall': {
      const longestFence = Math.max(
        3,
        ...[...block.source.matchAll(/`+/gu)].map(
          ([value]) => value.length + 1,
        ),
      )
      const fence = '`'.repeat(longestFence)
      const info = [block.sourceLanguage, block.meta].filter(Boolean).join(' ')
      return `${fence}${info}\n${block.source.replace(/\n+$/u, '')}\n${fence}`
    }
    case 'List':
      return block.items
        .map((item, index) => {
          const marker = block.ordered
            ? `${(block.start ?? 1) + index}. `
            : '- '
          const check =
            item.checked === undefined ? '' : `[${item.checked ? 'x' : ' '}] `
          const body = renderBlocks(item.blocks, options)
          const lines = body.split('\n')
          const first = lines[0] ?? ''
          const rest = lines
            .slice(1)
            .map(line =>
              line.length === 0 ? line : `${' '.repeat(marker.length)}${line}`,
            )
          return `${marker}${check}${first}${rest.length === 0 ? '' : `\n${rest.join('\n')}`}`
        })
        .join('\n')
    case 'Blockquote':
      return indent(renderBlocks(block.blocks, options), '> ')
    case 'ThematicBreak':
      return '---'
    case 'Table': {
      const alignment = block.alignments.map(value => {
        switch (value) {
          case 'left':
            return ':---'
          case 'center':
            return ':---:'
          case 'right':
            return '---:'
          default:
            return '---'
        }
      })
      return [
        tableRow(block.header, options),
        `| ${alignment.join(' | ')} |`,
        ...block.rows.map(row => tableRow(row, options)),
      ].join('\n')
    }
    case 'BlockComponent':
      return renderComponent(block, options)
  }
}

const renderBlocks = (
  blocks: ReadonlyArray<Block>,
  options: MarkdownSerializeOptions,
): string =>
  blocks
    .map(block => renderBlock(block, options).trim())
    .filter(value => value.length > 0)
    .join('\n\n')

/** Serializes Foldocs' deterministic MDX AST into portable Markdown. */
export const documentToMarkdown = (
  document: Document,
  options: MarkdownSerializeOptions = {},
): string => `${renderBlocks(document.blocks, options).trim()}\n`
