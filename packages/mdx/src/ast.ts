import { Schema as S } from 'effect'

import { PageFrontmatter, TocItem } from '@foldocs/content'

export type Text = Readonly<{ _tag: 'Text'; value: string }>
export type InlineCode = Readonly<{ _tag: 'InlineCode'; value: string }>
export type InlineMath = Readonly<{
  _tag: 'InlineMath'
  value: string
  html: string
}>
export type HardBreak = Readonly<{ _tag: 'HardBreak' }>
export type Emphasis = Readonly<{
  _tag: 'Emphasis'
  content: ReadonlyArray<Inline>
}>
export type Strong = Readonly<{
  _tag: 'Strong'
  content: ReadonlyArray<Inline>
}>
export type Strikethrough = Readonly<{
  _tag: 'Strikethrough'
  content: ReadonlyArray<Inline>
}>
export type Link = Readonly<{
  _tag: 'Link'
  url: string
  title?: string
  content: ReadonlyArray<Inline>
}>
export type Image = Readonly<{
  _tag: 'Image'
  url: string
  alt: string
  title?: string
  width?: number
  height?: number
}>
export type InlineComponent = Readonly<{
  _tag: 'InlineComponent'
  name: string
  attributes: Readonly<Record<string, string>>
  content: ReadonlyArray<Inline>
}>

export type Inline =
  | Text
  | InlineCode
  | InlineMath
  | HardBreak
  | Emphasis
  | Strong
  | Strikethrough
  | Link
  | Image
  | InlineComponent

export const Inline: S.Codec<Inline, Inline> = S.suspend(() =>
  S.Union([
    Text,
    InlineCode,
    InlineMath,
    HardBreak,
    Emphasis,
    Strong,
    Strikethrough,
    Link,
    Image,
    InlineComponent,
  ]),
)

export const Text = S.Struct({ _tag: S.Literal('Text'), value: S.String })
export const InlineCode = S.Struct({
  _tag: S.Literal('InlineCode'),
  value: S.String,
})
export const InlineMath = S.Struct({
  _tag: S.Literal('InlineMath'),
  value: S.String,
  html: S.String,
})
export const HardBreak = S.Struct({ _tag: S.Literal('HardBreak') })
export const Emphasis = S.Struct({
  _tag: S.Literal('Emphasis'),
  content: S.Array(Inline),
})
export const Strong = S.Struct({
  _tag: S.Literal('Strong'),
  content: S.Array(Inline),
})
export const Strikethrough = S.Struct({
  _tag: S.Literal('Strikethrough'),
  content: S.Array(Inline),
})
export const Link = S.Struct({
  _tag: S.Literal('Link'),
  url: S.String,
  title: S.optionalKey(S.String),
  content: S.Array(Inline),
})
export const Image = S.Struct({
  _tag: S.Literal('Image'),
  url: S.String,
  alt: S.String,
  title: S.optionalKey(S.String),
  width: S.optionalKey(S.Number),
  height: S.optionalKey(S.Number),
})
export const InlineComponent = S.Struct({
  _tag: S.Literal('InlineComponent'),
  name: S.String,
  attributes: S.Record(S.String, S.String),
  content: S.Array(Inline),
})

export type Heading = Readonly<{
  _tag: 'Heading'
  id: string
  level: number
  content: ReadonlyArray<Inline>
}>
export type Paragraph = Readonly<{
  _tag: 'Paragraph'
  content: ReadonlyArray<Inline>
}>
export type CodeBlock = Readonly<{
  _tag: 'CodeBlock'
  value: string
  language?: string
  meta?: string
  highlightedHtml?: string
}>
export type MathBlock = Readonly<{
  _tag: 'MathBlock'
  value: string
  html: string
}>
export type Mermaid = Readonly<{
  _tag: 'Mermaid'
  value: string
}>
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'
export type PackageInstallCommand = Readonly<{
  manager: PackageManager
  value: string
  highlightedHtml?: string
}>
export type PackageInstall = Readonly<{
  _tag: 'PackageInstall'
  source: string
  sourceLanguage: 'npm' | 'package-install'
  defaultManager: PackageManager
  commands: ReadonlyArray<PackageInstallCommand>
  meta?: string
}>
export type ListItem = Readonly<{
  _tag: 'ListItem'
  blocks: ReadonlyArray<Block>
  checked?: boolean
}>
export type List = Readonly<{
  _tag: 'List'
  ordered: boolean
  start?: number
  items: ReadonlyArray<ListItem>
}>
export type Blockquote = Readonly<{
  _tag: 'Blockquote'
  blocks: ReadonlyArray<Block>
}>
export type ThematicBreak = Readonly<{ _tag: 'ThematicBreak' }>
export type TableCell = Readonly<{
  _tag: 'TableCell'
  content: ReadonlyArray<Inline>
}>
export type TableRow = Readonly<{
  _tag: 'TableRow'
  cells: ReadonlyArray<TableCell>
}>
export type Table = Readonly<{
  _tag: 'Table'
  alignments: ReadonlyArray<'none' | 'left' | 'center' | 'right'>
  header: TableRow
  rows: ReadonlyArray<TableRow>
}>
export type BlockComponent = Readonly<{
  _tag: 'BlockComponent'
  name: string
  attributes: Readonly<Record<string, string>>
  blocks: ReadonlyArray<Block>
}>

export type Block =
  | Heading
  | Paragraph
  | CodeBlock
  | MathBlock
  | Mermaid
  | PackageInstall
  | List
  | Blockquote
  | ThematicBreak
  | Table
  | BlockComponent

export const Block: S.Codec<Block, Block> = S.suspend(() =>
  S.Union([
    Heading,
    Paragraph,
    CodeBlock,
    MathBlock,
    Mermaid,
    PackageInstall,
    List,
    Blockquote,
    ThematicBreak,
    Table,
    BlockComponent,
  ]),
)

export const Heading = S.Struct({
  _tag: S.Literal('Heading'),
  id: S.String,
  level: S.Number,
  content: S.Array(Inline),
})
export const Paragraph = S.Struct({
  _tag: S.Literal('Paragraph'),
  content: S.Array(Inline),
})
export const CodeBlock = S.Struct({
  _tag: S.Literal('CodeBlock'),
  value: S.String,
  language: S.optionalKey(S.String),
  meta: S.optionalKey(S.String),
  highlightedHtml: S.optionalKey(S.String),
})
export const MathBlock = S.Struct({
  _tag: S.Literal('MathBlock'),
  value: S.String,
  html: S.String,
})
export const Mermaid = S.Struct({
  _tag: S.Literal('Mermaid'),
  value: S.String,
})
export const PackageManager = S.Literals(['npm', 'pnpm', 'yarn', 'bun'])
export const PackageInstallCommand = S.Struct({
  manager: PackageManager,
  value: S.String,
  highlightedHtml: S.optionalKey(S.String),
})
export const PackageInstall = S.Struct({
  _tag: S.Literal('PackageInstall'),
  source: S.String,
  sourceLanguage: S.Literals(['npm', 'package-install']),
  defaultManager: PackageManager,
  commands: S.Array(PackageInstallCommand),
  meta: S.optionalKey(S.String),
})
export const ListItem = S.Struct({
  _tag: S.Literal('ListItem'),
  blocks: S.Array(Block),
  checked: S.optionalKey(S.Boolean),
})
export const List = S.Struct({
  _tag: S.Literal('List'),
  ordered: S.Boolean,
  start: S.optionalKey(S.Number),
  items: S.Array(ListItem),
})
export const Blockquote = S.Struct({
  _tag: S.Literal('Blockquote'),
  blocks: S.Array(Block),
})
export const ThematicBreak = S.Struct({ _tag: S.Literal('ThematicBreak') })
export const TableCell = S.Struct({
  _tag: S.Literal('TableCell'),
  content: S.Array(Inline),
})
export const TableRow = S.Struct({
  _tag: S.Literal('TableRow'),
  cells: S.Array(TableCell),
})
export const Table = S.Struct({
  _tag: S.Literal('Table'),
  alignments: S.Array(S.Literals(['none', 'left', 'center', 'right'])),
  header: TableRow,
  rows: S.Array(TableRow),
})
export const BlockComponent = S.Struct({
  _tag: S.Literal('BlockComponent'),
  name: S.String,
  attributes: S.Record(S.String, S.String),
  blocks: S.Array(Block),
})

export const Document = S.Struct({ blocks: S.Array(Block) })
export type Document = typeof Document.Type

/** Runtime-safe compiled document schema with no parser or highlighter imports. */
export const CompiledPage = S.Struct({
  frontmatter: PageFrontmatter,
  document: Document,
  toc: S.Array(TocItem),
  source: S.String,
  plainText: S.String,
})
export type CompiledPage = typeof CompiledPage.Type

export const decodeDocument = S.decodeUnknownSync(Document)
