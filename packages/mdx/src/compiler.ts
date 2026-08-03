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
import { type PluggableList, unified } from 'unified'
import { parse as parseYaml } from 'yaml'

import type * as FoldkitMarkdown from '@foldkit/markdown'
import {
  type MarkdownPluginOptions,
  parseMarkdown,
} from '@foldkit/markdown/vite'
import {
  type PageFrontmatter as PageFrontmatterType,
  type PageReference,
  type StructuredDataSection,
  type TocItem as TocItemType,
  decodePageFrontmatter,
} from '@foldocs/content'
import {
  transformerMetaHighlight,
  transformerMetaWordHighlight,
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from '@shikijs/transformers'

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

export type ProcessorPlugins =
  PluggableList | ((defaults: PluggableList) => PluggableList)

export type DocumentPlugin = (
  page: CompiledPageType,
  context: Readonly<{ filePath?: string }>,
) => CompiledPageType | Promise<CompiledPageType>

const defaultRemarkPlugins: PluggableList = [
  remarkParse,
  [remarkFrontmatter, ['yaml']],
  remarkGfm,
  remarkMath,
  remarkDirective,
  remarkMdx,
]

const resolvePlugins = (
  plugins: ProcessorPlugins | undefined,
  defaults: PluggableList,
): PluggableList => {
  if (plugins === undefined) return defaults
  return typeof plugins === 'function'
    ? plugins(defaults)
    : [...defaults, ...plugins]
}

const markdownProcessor = (options: CompileOptions) =>
  unified().use(resolvePlugins(options.remarkPlugins, defaultRemarkPlugins))

export interface CompileOptions {
  readonly filePath?: string
  readonly highlight?: boolean
  readonly highlightCode?: CodeHighlighter
  /**
   * Official @foldkit/markdown parser options for `.md` documents. Island
   * schemas validate directive names and attributes during compilation.
   */
  readonly markdown?: MarkdownPluginOptions
  /** Unified Remark plugins appended to, or composed around, Foldocs defaults. */
  readonly remarkPlugins?: ProcessorPlugins
  /** Typed post-compile transforms for the serialized Foldkit document. */
  readonly documentPlugins?: ReadonlyArray<DocumentPlugin>
  /** Configure reusable file includes. Enabled by default when filePath is known. */
  readonly include?:
    | boolean
    | {
        /** Root used by `<include cwd>`. Defaults to process.cwd(). */
        readonly cwd?: string
      }
  /** Build-time resolver used by the built-in AutoTypeTable component. */
  readonly resolveAutoTypeTable?: (
    input: Readonly<{
      source: string
      name: string
      tsconfig?: string
      filePath?: string
    }>,
  ) => Promise<ReadonlyArray<AutoTypeTableProperty>>
  /** Optional build-time TypeScript transformer used by `showJs` code blocks. */
  readonly transformTypeScript?: (
    input: Readonly<{
      value: string
      language: string
      filePath?: string
    }>,
  ) => Promise<string> | string
}

export interface AutoTypeTableProperty {
  readonly name: string
  readonly type: string
  readonly description: string
  readonly default?: string
  readonly required: boolean
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
      const expression =
        'value' in attribute && typeof attribute.value === 'string'
          ? staticExpressionObject(attribute.value)
          : undefined
      if (expression === undefined)
        unsupported(
          { type: attribute.type },
          filePath,
          'Spread attributes must be a JSON object so they remain deterministic.',
        )
      Object.assign(attributes, expression)
      continue
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
      const expression = literalAttribute.value as Readonly<{ value?: unknown }>
      const expressionSource = expression.value
      if (typeof expressionSource !== 'string')
        return unsupported(
          { type: 'mdx attribute expression' },
          filePath,
          'Attribute expressions must be JSON literals.',
        )
      const value = staticExpressionValue(expressionSource)
      if (value === undefined)
        return unsupported(
          { type: 'mdx attribute expression' },
          filePath,
          'Attribute expressions must be JSON literals.',
        )
      attributes[literalAttribute.name] = value
      continue
    }
    attributes[literalAttribute.name] =
      typeof literalAttribute.value === 'string' ? literalAttribute.value : ''
  }
  return attributes
}

const staticExpressionValue = (source: string): string | undefined => {
  const normalized = source.trim()
  if (normalized.length === 0) return ''
  try {
    const value: unknown = JSON.parse(normalized)
    if (value === null) return 'null'
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    )
      return String(value)
    return JSON.stringify(value)
  } catch {
    return undefined
  }
}

const staticExpressionObject = (
  source: string,
): Readonly<Record<string, string>> | undefined => {
  try {
    const value: unknown = JSON.parse(source.trim())
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return undefined
    return Object.fromEntries(
      Object.entries(value).map(([name, entry]) => [
        name,
        typeof entry === 'string' ? entry : JSON.stringify(entry),
      ]),
    )
  } catch {
    return undefined
  }
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
    case 'mdxTextExpression': {
      const value = staticExpressionValue(String(node.value ?? ''))
      if (value !== undefined) return { _tag: 'Text', value }
      return unsupported(
        node as NodeWithPosition,
        filePath,
        'Only JSON literal expressions are serializable. Use a registered Foldkit component for runtime state.',
      )
    }
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

const codeMetaValue = (
  meta: string | undefined,
  key: string,
): string | undefined => {
  if (meta === undefined) return undefined
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const match = new RegExp(
    `(?:^|\\s)${escaped}=(?:"([^"]*)"|'([^']*)'|([^\\s]+))`,
    'u',
  ).exec(meta)
  return match?.[1] ?? match?.[2] ?? match?.[3]
}

const normalizeCodeBlock = async (
  value: string,
  language: string | undefined,
  meta: string | undefined,
  options: CompileOptions,
): Promise<Extract<Block, { _tag: 'CodeBlock' }>> => {
  let highlightedHtml: string | undefined
  const title = codeMetaValue(meta, 'title')
  const icon = codeMetaValue(meta, 'icon')
  const tab = codeMetaValue(meta, 'tab')
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
            meta: { __raw: meta ?? '' },
            transformers: [
              transformerMetaHighlight(),
              transformerMetaWordHighlight(),
              transformerNotationDiff(),
              transformerNotationErrorLevel(),
              transformerNotationFocus(),
              transformerNotationHighlight(),
              transformerNotationWordHighlight(),
            ],
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
    ...(title === undefined ? {} : { title }),
    ...(icon === undefined ? {} : { icon }),
    ...(tab === undefined ? {} : { tab }),
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
      const code = await normalizeCodeBlock(
        value,
        language,
        typeof node.meta === 'string' ? node.meta : undefined,
        options,
      )
      const meta = typeof node.meta === 'string' ? node.meta : ''
      if (
        options.transformTypeScript !== undefined &&
        /^(?:ts|tsx|typescript)$/iu.test(language ?? '') &&
        /(?:^|\s)showJs(?:\s|$)/u.test(meta)
      ) {
        const javascript = await options.transformTypeScript({
          value,
          language: language ?? 'ts',
          ...(options.filePath === undefined
            ? {}
            : { filePath: options.filePath }),
        })
        const js = await normalizeCodeBlock(
          javascript,
          'js',
          meta.replace(/(?:^|\s)showJs(?=\s|$)/u, '').trim(),
          options,
        )
        return {
          _tag: 'BlockComponent',
          name: 'Tabs',
          attributes: {
            groupId: 'typescript-javascript',
            persist: 'true',
          },
          blocks: [
            {
              _tag: 'BlockComponent',
              name: 'Tab',
              attributes: { title: 'TypeScript', value: 'typescript' },
              blocks: [code],
            },
            {
              _tag: 'BlockComponent',
              name: 'Tab',
              attributes: { title: 'JavaScript', value: 'javascript' },
              blocks: [js],
            },
          ],
        }
      }
      return code
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
      if (node.name === 'AutoTypeTable') {
        const attributes = attributesFromMdx(node as never, filePath)
        const source = attributes.source ?? attributes.path
        const name = attributes.name ?? attributes.type
        if (source === undefined || name === undefined)
          throw new Error(
            `AutoTypeTable requires source and name attributes${location(node as NodeWithPosition, filePath)}.`,
          )
        if (options.resolveAutoTypeTable === undefined)
          throw new Error(
            `AutoTypeTable requires a compiler resolver${location(node as NodeWithPosition, filePath)}. Use the @foldocs/vite integration or provide resolveAutoTypeTable.`,
          )
        const properties = await options.resolveAutoTypeTable({
          source,
          name,
          ...(attributes.tsconfig === undefined
            ? {}
            : { tsconfig: attributes.tsconfig }),
          ...(filePath === undefined ? {} : { filePath }),
        })
        return {
          _tag: 'BlockComponent',
          name: 'TypeTable',
          attributes: {},
          blocks: properties.map(property => ({
            _tag: 'BlockComponent',
            name: 'TypeTableItem',
            attributes: {
              name: property.name,
              type: property.type,
              description: property.description,
              required: String(property.required),
              ...(property.default === undefined
                ? {}
                : { default: property.default }),
            },
            blocks: [],
          })),
        }
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
    case 'mdxFlowExpression': {
      const value = staticExpressionValue(String(node.value ?? ''))
      if (value !== undefined)
        return {
          _tag: 'Paragraph',
          content: [{ _tag: 'Text', value }],
        }
      return unsupported(
        node as NodeWithPosition,
        filePath,
        'Only JSON literal expressions are serializable. Use a registered Foldkit component for runtime state.',
      )
    }
    case 'mdxjsEsm':
      return {
        _tag: 'BlockComponent',
        name: 'MdxModule',
        attributes: {},
        blocks: [],
      }
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

const linearizeBlocks = (blocks: ReadonlyArray<Block>): ReadonlyArray<Block> =>
  blocks.flatMap(block => {
    if (block._tag === 'Blockquote' || block._tag === 'BlockComponent')
      return linearizeBlocks(block.blocks)
    if (block._tag === 'List')
      return block.items.flatMap(item => linearizeBlocks(item.blocks))
    return [block]
  })

const structuredDataFromBlocks = (
  blocks: ReadonlyArray<Block>,
  title: string,
  description?: string,
): ReadonlyArray<StructuredDataSection> => {
  const sections: Array<{
    id: string
    title: string
    depth: number
    content: string[]
  }> = [
    {
      id: '',
      title,
      depth: 1,
      content: description === undefined ? [] : [description],
    },
  ]
  let current = sections[0]!
  for (const block of linearizeBlocks(blocks)) {
    if (block._tag === 'Heading' && block.level >= 2 && block.level <= 4) {
      current = {
        id: block.id,
        title: inlineText(block.content),
        depth: block.level,
        content: [],
      }
      sections.push(current)
      continue
    }
    if (block._tag === 'Heading' && block.level === 1) continue
    const text = blockText(block).replace(/\s+/gu, ' ').trim()
    if (text.length > 0) current.content.push(text)
  }
  return sections.map(section => ({
    id: section.id,
    title: section.title,
    depth: section.depth,
    content: section.content.join('\n'),
  }))
}

const inlineReferences = (
  content: ReadonlyArray<Inline>,
): ReadonlyArray<PageReference> =>
  content.flatMap(inline => {
    if (inline._tag === 'Link')
      return [
        {
          url: inline.url,
          label: inlineText(inline.content) || inline.url,
        },
        ...inlineReferences(inline.content),
      ]
    if (
      inline._tag === 'Emphasis' ||
      inline._tag === 'Strong' ||
      inline._tag === 'Strikethrough' ||
      inline._tag === 'InlineComponent'
    )
      return inlineReferences(inline.content)
    return []
  })

const referencesFromBlocks = (
  blocks: ReadonlyArray<Block>,
): ReadonlyArray<PageReference> => {
  const references = linearizeBlocks(blocks).flatMap(block => {
    if (block._tag === 'Heading' || block._tag === 'Paragraph')
      return inlineReferences(block.content)
    if (block._tag === 'Table')
      return [block.header, ...block.rows].flatMap(row =>
        row.cells.flatMap(cell => inlineReferences(cell.content)),
      )
    return []
  })
  return [
    ...new Map(
      references.map(reference => [reference.url, reference]),
    ).values(),
  ]
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
  const standardKeys = new Set([
    'title',
    'description',
    'icon',
    'label',
    'order',
    'index',
    'draft',
    'hidden',
    'keywords',
    'tags',
    'socialImage',
  ])
  const data = Object.fromEntries(
    Object.entries(raw).filter(([name]) => !standardKeys.has(name)),
  )
  return decodePageFrontmatter({
    ...raw,
    title,
    ...(Object.keys(data).length === 0 ? {} : { data }),
  })
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

const groupTabbedCodeBlocks = (
  blocks: ReadonlyArray<Block>,
): ReadonlyArray<Block> => {
  const grouped: Block[] = []
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!
    if (block._tag !== 'CodeBlock' || block.tab === undefined) {
      grouped.push(block)
      continue
    }
    const tabs: Array<Extract<Block, { _tag: 'CodeBlock' }>> = [block]
    while (index + 1 < blocks.length) {
      const candidate = blocks[index + 1]!
      if (candidate._tag !== 'CodeBlock' || candidate.tab === undefined) break
      tabs.push(candidate)
      index += 1
    }
    if (tabs.length === 1) {
      grouped.push(block)
      continue
    }
    grouped.push({
      _tag: 'BlockComponent',
      name: 'Tabs',
      attributes: { groupId: 'code-language', persist: 'true' },
      blocks: tabs.map(tab => ({
        _tag: 'BlockComponent',
        name: 'Tab',
        attributes: { title: tab.tab! },
        blocks: [tab],
      })),
    })
  }
  return grouped
}

const finishCompiledPage = (
  source: string,
  blocks: ReadonlyArray<Block>,
  rawFrontmatter: Readonly<Record<string, unknown>>,
  filePath?: string,
): CompiledPageType => {
  const groupedBlocks = groupTabbedCodeBlocks(blocks)
  const frontmatter = resolveFrontmatter(
    rawFrontmatter,
    groupedBlocks,
    filePath,
  )
  const toc: TocItemType[] = groupedBlocks
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
    document: { blocks: groupedBlocks },
    toc,
    source,
    plainText: [
      frontmatter.title,
      frontmatter.description ?? '',
      ...groupedBlocks.map(blockText),
    ]
      .filter(Boolean)
      .join('\n'),
    structuredData: structuredDataFromBlocks(
      groupedBlocks,
      frontmatter.title,
      frontmatter.description,
    ),
    references: referencesFromBlocks(groupedBlocks),
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

const includeAttributes = (
  source: string,
): Readonly<Record<string, string>> => {
  const attributes: Record<string, string> = {}
  for (const match of source.matchAll(
    /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu,
  )) {
    const name = match[1]
    if (name !== undefined)
      attributes[name] = match[2] ?? match[3] ?? match[4] ?? ''
  }
  return attributes
}

const withoutIncludedFrontmatter = (source: string): string =>
  source.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/u, '')

const fencedCode = (value: string, language: string, meta?: string): string => {
  const longest = Math.max(
    3,
    ...[...value.matchAll(/`+/gu)].map(match => match[0].length + 1),
  )
  const fence = '`'.repeat(longest)
  return `${fence}${[language, meta].filter(Boolean).join(' ')}\n${value.replace(/\n+$/u, '')}\n${fence}`
}

const extractCodeRegion = (
  source: string,
  region: string,
): string | undefined => {
  const escaped = region.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const expression = new RegExp(
    `^[^\\n]*#region\\s+${escaped}\\s*$\\r?\\n([\\s\\S]*?)^[^\\n]*#endregion(?:\\s+${escaped})?\\s*$`,
    'mu',
  )
  return expression.exec(source)?.[1]
}

const extractNamedSection = (
  source: string,
  section: string,
): string | undefined => {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const mdx = new RegExp(
    `<section\\s+[^>]*id=["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/section>`,
    'iu',
  ).exec(source)?.[1]
  if (mdx !== undefined) return mdx
  return new RegExp(
    `^:::section\\{#${escaped}\\}\\s*$\\r?\\n([\\s\\S]*?)^:::\\s*$`,
    'mu',
  ).exec(source)?.[1]
}

const extractHeadingSection = (
  source: string,
  headingId: string,
): string | undefined => {
  const lines = source.split(/\r?\n/u)
  const slugger = new GithubSlugger()
  let start = -1
  let depth = 0
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(lines[index] ?? '')
    if (match === null) continue
    const id = slugger.slug(match[2]!)
    if (id !== headingId) continue
    start = index + 1
    depth = match[1]!.length
    break
  }
  if (start === -1) return undefined
  let end = lines.length
  for (let index = start; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+/u.exec(lines[index] ?? '')
    if (match !== null && match[1]!.length <= depth) {
      end = index
      break
    }
  }
  return lines.slice(start, end).join('\n')
}

const extractIncludedFragment = (
  source: string,
  fragment: string | undefined,
): string => {
  if (fragment === undefined || fragment.length === 0) return source
  const decoded = decodeURIComponent(fragment)
  const extracted =
    extractCodeRegion(source, decoded) ??
    extractNamedSection(source, decoded) ??
    extractHeadingSection(source, decoded)
  if (extracted === undefined)
    throw new Error(
      `Unable to find included region, section, or heading #${decoded}.`,
    )
  return extracted
}

interface SourceRange {
  readonly start: number
  readonly end: number
}

/** Locate Markdown fences so documentation examples are never expanded. */
const fencedSourceRanges = (source: string): ReadonlyArray<SourceRange> => {
  const ranges: SourceRange[] = []
  let open:
    | {
        readonly start: number
        readonly marker: '`' | '~'
        readonly size: number
      }
    | undefined
  let offset = 0
  for (const line of source.match(/.*(?:\r?\n|$)/gu) ?? []) {
    const content = line.replace(/\r?\n$/u, '')
    const fence = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(content)
    if (open === undefined) {
      if (fence !== null) {
        const sequence = fence[1]!
        open = {
          start: offset,
          marker: sequence[0] as '`' | '~',
          size: sequence.length,
        }
      }
    } else {
      const closing = /^ {0,3}(`+|~+)\s*$/u.exec(content)?.[1]
      if (
        closing !== undefined &&
        closing[0] === open.marker &&
        closing.length >= open.size
      ) {
        ranges.push({ start: open.start, end: offset + line.length })
        open = undefined
      }
    }
    offset += line.length
    if (line.length === 0) break
  }
  if (open !== undefined) ranges.push({ start: open.start, end: source.length })
  return ranges
}

const resolveIncludes = async (
  source: string,
  options: CompileOptions,
  stack: ReadonlyArray<string> = [],
): Promise<string> => {
  if (options.include === false || options.filePath === undefined) return source
  const pattern = /<include\b([^>]*?)(?:\/>|>([\s\S]*?)<\/include>)/giu
  const ignored = fencedSourceRanges(source)
  let result = ''
  let offset = 0
  for (const match of source.matchAll(pattern)) {
    const index = match.index
    if (index === undefined) continue
    if (ignored.some(range => index >= range.start && index < range.end))
      continue
    result += source.slice(offset, index)
    const attributes = includeAttributes(match[1] ?? '')
    const requested = (attributes.src ?? match[2] ?? '').trim()
    if (requested.length === 0)
      throw new Error(
        `Include needs a relative path${location({ type: 'include' }, options.filePath)}.`,
      )
    const [requestedPath = '', fragment] = requested.split('#', 2)
    const cwd =
      'cwd' in attributes
        ? typeof options.include === 'object' &&
          options.include.cwd !== undefined
          ? options.include.cwd
          : process.cwd()
        : path.dirname(options.filePath)
    const includedPath = path.resolve(cwd, requestedPath)
    if (stack.includes(includedPath) || includedPath === options.filePath)
      throw new Error(
        `Circular include detected: ${[...stack, options.filePath, includedPath].join(' -> ')}`,
      )
    const includedSource = await fs.readFile(includedPath, 'utf8')
    const extracted = extractIncludedFragment(includedSource, fragment)
    const extension = path.extname(includedPath).slice(1).toLowerCase()
    if (extension === 'md' || extension === 'mdx') {
      result += await resolveIncludes(
        withoutIncludedFrontmatter(extracted),
        { ...options, filePath: includedPath },
        [...stack, options.filePath],
      )
    } else {
      result += fencedCode(
        extracted,
        attributes.lang || extension || 'text',
        attributes.meta,
      )
    }
    offset = index + match[0].length
  }
  return result + source.slice(offset)
}

const needsDeterministicMarkdownExtensions = (root: Root): boolean =>
  root.children.some(node => {
    if (node.type === 'math') return true
    return node.type === 'code' && node.lang?.toLowerCase() === 'mermaid'
  })

export const compile = async (
  source: string,
  options: CompileOptions = {},
): Promise<CompiledPageType> => {
  const applyDocumentPlugins = async (
    page: CompiledPageType,
  ): Promise<CompiledPageType> => {
    let transformed = page
    for (const plugin of options.documentPlugins ?? [])
      transformed = await plugin(transformed, {
        ...(options.filePath === undefined
          ? {}
          : { filePath: options.filePath }),
      })
    return transformed
  }
  const resolvedSource = await resolveIncludes(source, options)
  const processor = markdownProcessor(options)
  const parsed = processor.parse(resolvedSource) as Root
  const root = (await processor.run(parsed)) as Root
  if (!options.filePath?.toLowerCase().endsWith('.md'))
    return applyDocumentPlugins(
      await compileDeterministicMdx(resolvedSource, root, options),
    )

  if (needsDeterministicMarkdownExtensions(root))
    return applyDocumentPlugins(
      await compileDeterministicMdx(resolvedSource, root, options),
    )

  try {
    return applyDocumentPlugins(
      await compileFoldkitMarkdown(resolvedSource, root, options),
    )
  } catch (error) {
    // Foldocs historically supported GFM task lists. Keep that one explicit
    // extension while all standard `.md` pages use @foldkit/markdown as their
    // parser and schema validator.
    if (isTaskListExtensionError(error)) {
      // Re-run the official validation with only checkbox markers removed so
      // task-list pages cannot bypass URL, vocabulary, or island validation.
      parseMarkdown(
        withoutTaskListMarkers(
          markdownSourceWithoutFrontmatter(resolvedSource, root),
        ),
        options.markdown,
      )
      return applyDocumentPlugins(
        await compileDeterministicMdx(resolvedSource, root, options),
      )
    }
    throw error
  }
}

export const decodeCompiledPage = S.decodeUnknownSync(CompiledPage)
