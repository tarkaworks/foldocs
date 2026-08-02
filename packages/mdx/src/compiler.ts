import { Option, Schema as S } from 'effect'
import GithubSlugger from 'github-slugger'
import { imageSize } from 'image-size'
import katex from 'katex'
import type {
  BlockContent as MdastBlockContent,
  ListItem as MdastListItem,
  Table as MdastTable,
  PhrasingContent,
  Root,
  RootContent,
} from 'mdast'
import type {} from 'mdast-util-directive'
import type {} from 'mdast-util-mdx-jsx'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import npmToYarn from 'npm-to-yarn'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { codeToHtml } from 'shiki'
import { unified } from 'unified'
import { parse as parseYaml } from 'yaml'

import type * as FoldkitMarkdown from '@foldkit/markdown'
import {
  type MarkdownPluginOptions,
  parseMarkdown,
} from '@foldkit/markdown/vite'
import {
  type PageFrontmatter as PageFrontmatterType,
  type TocItem as TocItemType,
  decodePageFrontmatter,
} from '@foldocs/content'

import type {
  Block,
  BlockComponent,
  CompiledPage as CompiledPageType,
  Inline,
  InlineComponent,
  PackageManager,
  Table,
  TableRow,
} from './ast.js'
import { CompiledPage } from './ast.js'

const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkDirective)
  .use(remarkMdx)
  .freeze()

export interface CompileOptions {
  readonly filePath?: string
  readonly highlight?: boolean
  readonly highlightCode?: CodeHighlighter
  /**
   * Official @foldkit/markdown parser options for `.md` documents. Island
   * schemas validate directive names and attributes during compilation.
   */
  readonly markdown?: MarkdownPluginOptions
}

export type { MarkdownPluginOptions } from '@foldkit/markdown/vite'

export interface CodeHighlightInput {
  readonly value: string
  readonly language: string
  readonly meta?: string
  readonly filePath?: string
}

export type CodeHighlighter = (
  input: CodeHighlightInput,
) => Promise<string | undefined>

type NodeWithPosition = Readonly<{
  type: string
  position?: Readonly<{ start: Readonly<{ line: number }> }> | undefined
}>

const location = (node: NodeWithPosition, filePath?: string): string => {
  const file = filePath === undefined ? '' : `${filePath}`
  const line = node.position?.start.line
  if (file.length === 0 && line === undefined) return ''
  return ` (${file}${line === undefined ? '' : `:${line}`})`
}

const unsupported = (
  node: NodeWithPosition,
  filePath: string | undefined,
  guidance?: string,
): never => {
  throw new Error(
    `Unsupported MDX node "${node.type}"${location(node, filePath)}.${
      guidance === undefined ? '' : ` ${guidance}`
    }`,
  )
}

const safeUrl = (
  url: string,
  node: NodeWithPosition,
  filePath?: string,
): string => {
  const compact = url.replace(/[\u0000-\u0020]/gu, '')
  if (
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/u.test(compact) &&
    !/^(?:https?|mailto|tel):/iu.test(compact)
  ) {
    throw new Error(`Unsafe URL scheme in "${url}"${location(node, filePath)}.`)
  }
  return url
}

const attributesFromMdx = (
  node: {
    attributes?: ReadonlyArray<
      | {
          type: 'mdxJsxAttribute'
          name: string
          value?: string | null | object
        }
      | { type: string }
    >
  },
  filePath?: string,
): Readonly<Record<string, string>> => {
  const attributes: Record<string, string> = {}
  for (const attribute of node.attributes ?? []) {
    if (attribute.type !== 'mdxJsxAttribute' || !('name' in attribute)) {
      unsupported(
        { type: attribute.type },
        filePath,
        'Spread attributes are not deterministic and cannot be statically indexed.',
      )
    }
    const literalAttribute = attribute as {
      readonly type: 'mdxJsxAttribute'
      readonly name: string
      readonly value?: string | null | object
    }
    if (
      literalAttribute.value !== undefined &&
      literalAttribute.value !== null &&
      typeof literalAttribute.value !== 'string'
    ) {
      unsupported(
        { type: 'mdx attribute expression' },
        filePath,
        'Use a literal string attribute. Interactive values belong in a Foldkit component model.',
      )
    }
    attributes[literalAttribute.name] =
      typeof literalAttribute.value === 'string' ? literalAttribute.value : ''
  }
  return attributes
}

const attributesFromDirective = (
  attributes:
    Readonly<Record<string, string | null | undefined>> | null | undefined,
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(attributes ?? {}).map(([name, value]) => [
      name,
      value ?? '',
    ]),
  )

const inlineText = (content: ReadonlyArray<Inline>): string =>
  content
    .map(node => {
      switch (node._tag) {
        case 'Text':
        case 'InlineCode':
        case 'InlineMath':
          return node.value
        case 'HardBreak':
          return '\n'
        case 'Emphasis':
        case 'Strong':
        case 'Strikethrough':
        case 'Link':
        case 'InlineComponent':
          return inlineText(node.content)
        case 'Image':
          return node.alt
      }
    })
    .join('')

const normalizeInline = (
  node: PhrasingContent | Record<string, unknown>,
  filePath?: string,
): Inline => {
  switch (node.type) {
    case 'text':
      return { _tag: 'Text', value: String(node.value) }
    case 'inlineCode':
      return { _tag: 'InlineCode', value: String(node.value) }
    case 'inlineMath': {
      const value = String(node.value)
      return {
        _tag: 'InlineMath',
        value,
        html: katex.renderToString(value, {
          displayMode: false,
          output: 'htmlAndMathml',
          throwOnError: false,
        }),
      }
    }
    case 'break':
      return { _tag: 'HardBreak' }
    case 'emphasis':
      return {
        _tag: 'Emphasis',
        content: (node.children as PhrasingContent[]).map(child =>
          normalizeInline(child, filePath),
        ),
      }
    case 'strong':
      return {
        _tag: 'Strong',
        content: (node.children as PhrasingContent[]).map(child =>
          normalizeInline(child, filePath),
        ),
      }
    case 'delete':
      return {
        _tag: 'Strikethrough',
        content: (node.children as PhrasingContent[]).map(child =>
          normalizeInline(child, filePath),
        ),
      }
    case 'link': {
      const title = node.title
      return {
        _tag: 'Link',
        url: safeUrl(String(node.url), node as NodeWithPosition, filePath),
        ...(typeof title === 'string' ? { title } : {}),
        content: (node.children as PhrasingContent[]).map(child =>
          normalizeInline(child, filePath),
        ),
      }
    }
    case 'image': {
      const title = node.title
      return {
        _tag: 'Image',
        url: safeUrl(String(node.url), node as NodeWithPosition, filePath),
        alt: typeof node.alt === 'string' ? node.alt : '',
        ...(typeof title === 'string' ? { title } : {}),
      }
    }
    case 'mdxJsxTextElement': {
      if (typeof node.name !== 'string') {
        unsupported(
          node as NodeWithPosition,
          filePath,
          'Fragments are not supported inline.',
        )
      }
      const name = node.name as string
      const component: InlineComponent = {
        _tag: 'InlineComponent',
        name,
        attributes: attributesFromMdx(node as never, filePath),
        content: (
          node.children as Array<PhrasingContent | Record<string, unknown>>
        ).map(child => normalizeInline(child, filePath)),
      }
      return component
    }
    case 'mdxTextExpression':
      return unsupported(
        node as NodeWithPosition,
        filePath,
        'JavaScript expressions are not serializable. Use a registered Foldkit component.',
      )
    default:
      return unsupported(node as NodeWithPosition, filePath)
  }
}

const normalizeTable = (node: MdastTable, filePath?: string): Table => {
  const rows: TableRow[] = node.children.map(row => ({
    _tag: 'TableRow',
    cells: row.children.map(cell => ({
      _tag: 'TableCell',
      content: cell.children.map(child => normalizeInline(child, filePath)),
    })),
  }))
  const header = rows[0]
  if (header === undefined) {
    return unsupported(node, filePath, 'A table must contain a header row.')
  }
  return {
    _tag: 'Table',
    alignments: (node.align ?? []).map(alignment => alignment ?? 'none'),
    header,
    rows: rows.slice(1),
  }
}

const normalizeListItem = async (
  node: MdastListItem,
  slugger: GithubSlugger,
  options: CompileOptions,
): Promise<import('./ast.js').ListItem> => ({
  _tag: 'ListItem',
  blocks: await Promise.all(
    node.children.map(child => normalizeBlock(child, slugger, options)),
  ),
  ...(typeof node.checked === 'boolean' ? { checked: node.checked } : {}),
})

const withCodeLineNumbers = (highlightedHtml: string): string => {
  let line = 0
  const numbered = highlightedHtml.replace(
    /<span class="line">/gu,
    () => `<span class="line" data-line="${String(++line)}">`,
  )
  const digits = Math.max(2, String(Math.max(1, line)).length)
  return numbered.replace('<pre ', `<pre data-line-digits="${digits}" `)
}

const normalizeCodeBlock = async (
  value: string,
  language: string | undefined,
  meta: string | undefined,
  options: CompileOptions,
): Promise<Extract<Block, { _tag: 'CodeBlock' }>> => {
  let highlightedHtml: string | undefined
  if (options.highlight !== false) {
    try {
      const custom = await options.highlightCode?.({
        value,
        language: language ?? 'text',
        ...(meta === undefined ? {} : { meta }),
        ...(options.filePath === undefined
          ? {}
          : { filePath: options.filePath }),
      })
      highlightedHtml = withCodeLineNumbers(
        custom ??
          (await codeToHtml(value, {
            lang: language ?? 'text',
            themes: { light: 'github-light', dark: 'github-dark' },
            defaultColor: false,
          })),
      )
    } catch {
      highlightedHtml = undefined
    }
  }
  return {
    _tag: 'CodeBlock',
    value,
    ...(language === undefined ? {} : { language }),
    ...(meta === undefined ? {} : { meta }),
    ...(highlightedHtml === undefined ? {} : { highlightedHtml }),
  }
}

const packageManagers = ['npm', 'pnpm', 'yarn', 'bun'] as const
const convertPackageCommand = npmToYarn as unknown as (
  command: string,
  manager: PackageManager,
) => string

const convertPackageCommandLines = (
  command: string,
  manager: PackageManager,
): string =>
  command
    .split('\n')
    .map(line => convertPackageCommand(line, manager))
    .join('\n')

const normalizePackageInstall = async (
  source: string,
  sourceLanguage: 'npm' | 'package-install',
  meta: string | undefined,
  options: CompileOptions,
): Promise<Extract<Block, { _tag: 'PackageInstall' }>> => {
  const trimmed = source.trimStart()
  const command =
    sourceLanguage === 'package-install' &&
    !/^(?:npm|npx)(?:\s|$)/u.test(trimmed)
      ? `npm install ${source}`
      : source
  const commands = await Promise.all(
    packageManagers.map(async manager => {
      const highlighted = await normalizeCodeBlock(
        convertPackageCommandLines(command, manager),
        'bash',
        meta,
        options,
      )
      return {
        manager,
        value: highlighted.value,
        ...(highlighted.highlightedHtml === undefined
          ? {}
          : { highlightedHtml: highlighted.highlightedHtml }),
      }
    }),
  )
  return {
    _tag: 'PackageInstall',
    source,
    sourceLanguage,
    defaultManager: 'npm',
    commands,
    ...(meta === undefined ? {} : { meta }),
  }
}

const normalizeBlock = async (
  node: RootContent | MdastBlockContent | Record<string, unknown>,
  slugger: GithubSlugger,
  options: CompileOptions,
): Promise<Block> => {
  const filePath = options.filePath
  switch (node.type) {
    case 'heading': {
      const content = (node.children as PhrasingContent[]).map(child =>
        normalizeInline(child, filePath),
      )
      return {
        _tag: 'Heading',
        id: slugger.slug(inlineText(content)),
        level: Number(node.depth),
        content,
      }
    }
    case 'paragraph':
      return {
        _tag: 'Paragraph',
        content: (node.children as PhrasingContent[]).map(child =>
          normalizeInline(child, filePath),
        ),
      }
    case 'code': {
      const value = String(node.value)
      const language = typeof node.lang === 'string' ? node.lang : undefined
      const packageLanguage = language?.toLowerCase()
      if (packageLanguage === 'mermaid') return { _tag: 'Mermaid', value }
      if (packageLanguage === 'npm' || packageLanguage === 'package-install')
        return normalizePackageInstall(
          value,
          packageLanguage,
          typeof node.meta === 'string' ? node.meta : undefined,
          options,
        )
      return normalizeCodeBlock(
        value,
        language,
        typeof node.meta === 'string' ? node.meta : undefined,
        options,
      )
    }
    case 'math': {
      const value = String(node.value)
      return {
        _tag: 'MathBlock',
        value,
        html: katex.renderToString(value, {
          displayMode: true,
          output: 'htmlAndMathml',
          throwOnError: false,
        }),
      }
    }
    case 'list':
      return {
        _tag: 'List',
        ordered: node.ordered === true,
        ...(typeof node.start === 'number' ? { start: node.start } : {}),
        items: await Promise.all(
          (node.children as MdastListItem[]).map(child =>
            normalizeListItem(child, slugger, options),
          ),
        ),
      }
    case 'blockquote':
      return {
        _tag: 'Blockquote',
        blocks: await Promise.all(
          (node.children as MdastBlockContent[]).map(child =>
            normalizeBlock(child, slugger, options),
          ),
        ),
      }
    case 'thematicBreak':
      return { _tag: 'ThematicBreak' }
    case 'table':
      return normalizeTable(node as unknown as MdastTable, filePath)
    case 'leafDirective':
    case 'containerDirective': {
      const component: BlockComponent = {
        _tag: 'BlockComponent',
        name: String(node.name),
        attributes: attributesFromDirective(node.attributes as never),
        blocks:
          node.type === 'leafDirective'
            ? []
            : await Promise.all(
                (node.children as MdastBlockContent[]).map(child =>
                  normalizeBlock(child, slugger, options),
                ),
              ),
      }
      return component
    }
    case 'mdxJsxFlowElement': {
      if (typeof node.name !== 'string') {
        return unsupported(
          node as NodeWithPosition,
          filePath,
          'Fragments are not supported.',
        )
      }
      if (node.name === 'DynamicCodeBlock') {
        const attributes = attributesFromMdx(node as never, filePath)
        const value = attributes.code ?? ''
        return normalizeCodeBlock(
          value,
          attributes.lang ?? attributes.language,
          attributes.meta,
          options,
        )
      }
      return {
        _tag: 'BlockComponent',
        name: node.name,
        attributes: attributesFromMdx(node as never, filePath),
        blocks: await Promise.all(
          (
            node.children as Array<MdastBlockContent | Record<string, unknown>>
          ).map(child => normalizeBlock(child, slugger, options)),
        ),
      }
    }
    case 'mdxFlowExpression':
    case 'mdxjsEsm':
      return unsupported(
        node as NodeWithPosition,
        filePath,
        'Foldocs MDX is deterministic: register a Foldkit component instead of executing module code.',
      )
    case 'html':
      return unsupported(
        node as NodeWithPosition,
        filePath,
        'Raw HTML is disabled. Use an MDX component so output remains typed and auditable.',
      )
    default:
      return unsupported(node as NodeWithPosition, filePath)
  }
}

/**
 * Adapts the official @foldkit/markdown AST into Foldocs' enriched document
 * shape. Foldkit remains the parser and validator; this layer only adds the
 * heading ids, highlighted code, and component node names needed by the docs
 * shell, search index, and deterministic MDX compatibility renderer.
 */
const normalizeFoldkitInline = (node: FoldkitMarkdown.Inline): Inline => {
  switch (node._tag) {
    case 'Text':
    case 'InlineCode':
      return { _tag: node._tag, value: node.value }
    case 'HardBreak':
      return { _tag: 'HardBreak' }
    case 'Emphasis':
    case 'Strong':
    case 'Strikethrough':
      return {
        _tag: node._tag,
        content: node.content.map(normalizeFoldkitInline),
      }
    case 'Link': {
      const title = Option.getOrUndefined(node.maybeTitle)
      return {
        _tag: 'Link',
        url: node.url,
        ...(title === undefined ? {} : { title }),
        content: node.content.map(normalizeFoldkitInline),
      }
    }
    case 'Image': {
      const title = Option.getOrUndefined(node.maybeTitle)
      return {
        _tag: 'Image',
        url: node.url,
        alt: node.alt,
        ...(title === undefined ? {} : { title }),
      }
    }
  }
}

const foldkitAlignment = (
  alignment: FoldkitMarkdown.Alignment,
): 'none' | 'left' | 'center' | 'right' => {
  switch (alignment) {
    case 'None':
      return 'none'
    case 'Left':
      return 'left'
    case 'Center':
      return 'center'
    case 'Right':
      return 'right'
  }
}

const normalizeFoldkitTableRow = (row: FoldkitMarkdown.TableRow): TableRow => ({
  _tag: 'TableRow',
  cells: row.cells.map(cell => ({
    _tag: 'TableCell',
    content: cell.content.map(normalizeFoldkitInline),
  })),
})

const normalizeFoldkitBlock = async (
  node: FoldkitMarkdown.Block,
  slugger: GithubSlugger,
  options: CompileOptions,
): Promise<Block> => {
  switch (node._tag) {
    case 'Heading': {
      const content = node.content.map(normalizeFoldkitInline)
      return {
        _tag: 'Heading',
        id: slugger.slug(inlineText(content)),
        level: node.level,
        content,
      }
    }
    case 'Paragraph':
      return {
        _tag: 'Paragraph',
        content: node.content.map(normalizeFoldkitInline),
      }
    case 'CodeBlock': {
      const language = Option.getOrUndefined(node.maybeLanguage)
      const packageLanguage = language?.toLowerCase()
      if (packageLanguage === 'mermaid')
        return { _tag: 'Mermaid', value: node.value }
      if (packageLanguage === 'npm' || packageLanguage === 'package-install')
        return normalizePackageInstall(
          node.value,
          packageLanguage,
          Option.getOrUndefined(node.maybeMeta),
          options,
        )
      return normalizeCodeBlock(
        node.value,
        language,
        Option.getOrUndefined(node.maybeMeta),
        options,
      )
    }
    case 'List':
      return {
        _tag: 'List',
        ordered: node.isOrdered,
        ...(Option.isSome(node.maybeStartNumber)
          ? { start: node.maybeStartNumber.value }
          : {}),
        items: await Promise.all(
          node.items.map(async item => ({
            _tag: 'ListItem' as const,
            blocks: await Promise.all(
              item.blocks.map(block =>
                normalizeFoldkitBlock(block, slugger, options),
              ),
            ),
          })),
        ),
      }
    case 'Blockquote':
      return {
        _tag: 'Blockquote',
        blocks: await Promise.all(
          node.blocks.map(block =>
            normalizeFoldkitBlock(block, slugger, options),
          ),
        ),
      }
    case 'ThematicBreak':
      return { _tag: 'ThematicBreak' }
    case 'Table':
      return {
        _tag: 'Table',
        alignments: node.alignments.map(foldkitAlignment),
        header: normalizeFoldkitTableRow(node.headerRow),
        rows: node.bodyRows.map(normalizeFoldkitTableRow),
      }
    case 'Island':
      return {
        _tag: 'BlockComponent',
        name: node.name,
        attributes: node.attributes,
        blocks: await Promise.all(
          node.blocks.map(block =>
            normalizeFoldkitBlock(block, slugger, options),
          ),
        ),
      }
  }
}

const blockText = (block: Block): string => {
  switch (block._tag) {
    case 'Heading':
    case 'Paragraph':
      return inlineText(block.content)
    case 'CodeBlock':
      return block.value
    case 'MathBlock':
    case 'Mermaid':
      return block.value
    case 'PackageInstall':
      return (
        block.commands.find(command => command.manager === block.defaultManager)
          ?.value ?? block.source
      )
    case 'List':
      return block.items.flatMap(item => item.blocks.map(blockText)).join(' ')
    case 'Blockquote':
    case 'BlockComponent':
      return block.blocks.map(blockText).join(' ')
    case 'Table':
      return [block.header, ...block.rows]
        .flatMap(row => row.cells.map(cell => inlineText(cell.content)))
        .join(' ')
    case 'ThematicBreak':
      return ''
  }
}

const frontmatterFromRoot = (
  root: Root,
  filePath?: string,
): Readonly<Record<string, unknown>> => {
  const yaml = root.children.find(node => node.type === 'yaml') as
    { type: 'yaml'; value: string } | undefined
  if (yaml === undefined) return {}
  const parsed = parseYaml(yaml.value)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `Frontmatter must be a YAML object${location(yaml, filePath)}.`,
    )
  }
  return parsed as Record<string, unknown>
}

const resolveFrontmatter = (
  raw: Readonly<Record<string, unknown>>,
  blocks: ReadonlyArray<Block>,
  filePath?: string,
): PageFrontmatterType => {
  const firstHeading = blocks.find(block => block._tag === 'Heading')
  const title =
    typeof raw.title === 'string'
      ? raw.title
      : firstHeading?._tag === 'Heading'
        ? inlineText(firstHeading.content)
        : undefined
  if (title === undefined || title.trim().length === 0) {
    throw new Error(
      `Document${filePath === undefined ? '' : ` ${filePath}`} needs a frontmatter title or heading.`,
    )
  }
  return decodePageFrontmatter({ ...raw, title })
}

const markdownSourceWithoutFrontmatter = (
  source: string,
  root: Root,
): string => {
  const first = root.children[0]
  if (first?.type !== 'yaml') return source
  const endOffset = first.position?.end.offset
  if (endOffset === undefined) return source
  // Preserve newlines so errors from @foldkit/markdown still point at the
  // original source line while keeping page metadata outside its vocabulary.
  return `${source.slice(0, endOffset).replace(/[^\r\n]/gu, ' ')}${source.slice(endOffset)}`
}

const finishCompiledPage = (
  source: string,
  blocks: ReadonlyArray<Block>,
  rawFrontmatter: Readonly<Record<string, unknown>>,
  filePath?: string,
): CompiledPageType => {
  const frontmatter = resolveFrontmatter(rawFrontmatter, blocks, filePath)
  const toc: TocItemType[] = blocks
    .filter(
      (block): block is Extract<Block, { _tag: 'Heading' }> =>
        block._tag === 'Heading' && block.level >= 2 && block.level <= 4,
    )
    .map(heading => ({
      id: heading.id,
      title: inlineText(heading.content),
      depth: heading.level,
    }))
  return {
    frontmatter,
    document: { blocks },
    toc,
    source,
    plainText: [
      frontmatter.title,
      frontmatter.description ?? '',
      ...blocks.map(blockText),
    ]
      .filter(Boolean)
      .join('\n'),
  }
}

const enrichImage = async (
  inline: Inline,
  filePath: string | undefined,
): Promise<Inline> => {
  if (inline._tag === 'Image' && filePath !== undefined) {
    if (/^(?:[a-z]+:|\/|#)/iu.test(inline.url)) return inline
    try {
      const cleanUrl = decodeURIComponent(inline.url.split(/[?#]/u)[0] ?? '')
      const dimensions = imageSize(
        await fs.readFile(path.resolve(path.dirname(filePath), cleanUrl)),
      )
      return {
        ...inline,
        ...(dimensions.width === undefined ? {} : { width: dimensions.width }),
        ...(dimensions.height === undefined
          ? {}
          : { height: dimensions.height }),
      }
    } catch {
      return inline
    }
  }
  if (
    inline._tag === 'Emphasis' ||
    inline._tag === 'Strong' ||
    inline._tag === 'Strikethrough' ||
    inline._tag === 'Link' ||
    inline._tag === 'InlineComponent'
  )
    return {
      ...inline,
      content: await Promise.all(
        inline.content.map(child => enrichImage(child, filePath)),
      ),
    }
  return inline
}

const enrichBlockImages = async (
  block: Block,
  filePath: string | undefined,
): Promise<Block> => {
  if (block._tag === 'Heading' || block._tag === 'Paragraph')
    return {
      ...block,
      content: await Promise.all(
        block.content.map(inline => enrichImage(inline, filePath)),
      ),
    }
  if (block._tag === 'List')
    return {
      ...block,
      items: await Promise.all(
        block.items.map(async item => ({
          ...item,
          blocks: await Promise.all(
            item.blocks.map(child => enrichBlockImages(child, filePath)),
          ),
        })),
      ),
    }
  if (block._tag === 'Blockquote' || block._tag === 'BlockComponent')
    return {
      ...block,
      blocks: await Promise.all(
        block.blocks.map(child => enrichBlockImages(child, filePath)),
      ),
    }
  if (block._tag === 'Table')
    return {
      ...block,
      header: {
        ...block.header,
        cells: await Promise.all(
          block.header.cells.map(async cell => ({
            ...cell,
            content: await Promise.all(
              cell.content.map(inline => enrichImage(inline, filePath)),
            ),
          })),
        ),
      },
      rows: await Promise.all(
        block.rows.map(async row => ({
          ...row,
          cells: await Promise.all(
            row.cells.map(async cell => ({
              ...cell,
              content: await Promise.all(
                cell.content.map(inline => enrichImage(inline, filePath)),
              ),
            })),
          ),
        })),
      ),
    }
  return block
}

const compileDeterministicMdx = async (
  source: string,
  root: Root,
  options: CompileOptions,
): Promise<CompiledPageType> => {
  const slugger = new GithubSlugger()
  const contentNodes = root.children.filter(node => node.type !== 'yaml')
  const blocks = await Promise.all(
    contentNodes.map(node => normalizeBlock(node, slugger, options)),
  )
  return finishCompiledPage(
    source,
    await Promise.all(
      blocks.map(block => enrichBlockImages(block, options.filePath)),
    ),
    frontmatterFromRoot(root, options.filePath),
    options.filePath,
  )
}

const compileFoldkitMarkdown = async (
  source: string,
  root: Root,
  options: CompileOptions,
): Promise<CompiledPageType> => {
  const document = parseMarkdown(
    markdownSourceWithoutFrontmatter(source, root),
    options.markdown,
  )
  const slugger = new GithubSlugger()
  const blocks = await Promise.all(
    document.blocks.map(block =>
      normalizeFoldkitBlock(block, slugger, options),
    ),
  )
  return finishCompiledPage(
    source,
    await Promise.all(
      blocks.map(block => enrichBlockImages(block, options.filePath)),
    ),
    frontmatterFromRoot(root, options.filePath),
    options.filePath,
  )
}

const isTaskListExtensionError = (error: unknown): boolean =>
  error instanceof Error &&
  error.message.includes('Unsupported markdown node "task list item"')

const withoutTaskListMarkers = (source: string): string =>
  source.replace(/^(\s*(?:[-+*]|\d+[.)])\s+)\[[ xX]\](?=\s)/gmu, '$1')

const needsDeterministicMarkdownExtensions = (root: Root): boolean =>
  root.children.some(node => {
    if (node.type === 'math') return true
    return node.type === 'code' && node.lang?.toLowerCase() === 'mermaid'
  })

export const compile = async (
  source: string,
  options: CompileOptions = {},
): Promise<CompiledPageType> => {
  const root = processor.parse(source) as Root
  if (!options.filePath?.toLowerCase().endsWith('.md'))
    return compileDeterministicMdx(source, root, options)

  if (needsDeterministicMarkdownExtensions(root))
    return compileDeterministicMdx(source, root, options)

  try {
    return await compileFoldkitMarkdown(source, root, options)
  } catch (error) {
    // Foldocs historically supported GFM task lists. Keep that one explicit
    // extension while all standard `.md` pages use @foldkit/markdown as their
    // parser and schema validator.
    if (isTaskListExtensionError(error)) {
      // Re-run the official validation with only checkbox markers removed so
      // task-list pages cannot bypass URL, vocabulary, or island validation.
      parseMarkdown(
        withoutTaskListMarkers(markdownSourceWithoutFrontmatter(source, root)),
        options.markdown,
      )
      return compileDeterministicMdx(source, root, options)
    }
    throw error
  }
}

export const decodeCompiledPage = S.decodeUnknownSync(CompiledPage)
