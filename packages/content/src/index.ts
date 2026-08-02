import { Schema as S } from 'effect'

/** Author-controlled metadata shared by every Foldocs content source. */
export const PageFrontmatter = S.Struct({
  title: S.String,
  description: S.optionalKey(S.String),
  icon: S.optionalKey(S.String),
  label: S.optionalKey(S.String),
  order: S.optionalKey(S.Number),
  /** Use an `index` page as its parent folder's linked sidebar row. */
  index: S.optionalKey(S.Boolean),
  draft: S.optionalKey(S.Boolean),
  hidden: S.optionalKey(S.Boolean),
  keywords: S.optionalKey(S.Array(S.String)),
  tags: S.optionalKey(S.Array(S.String)),
  socialImage: S.optionalKey(S.String),
})
export type PageFrontmatter = typeof PageFrontmatter.Type

export const TocItem = S.Struct({
  id: S.String,
  title: S.String,
  depth: S.Number,
})
export type TocItem = typeof TocItem.Type

/** Serializable metadata kept in the eagerly loaded document manifest. */
export const PageMetadata = S.Struct({
  id: S.String,
  slug: S.String,
  url: S.String,
  file: S.String,
  locale: S.optionalKey(S.String),
  sourceLocale: S.optionalKey(S.String),
  translationKey: S.optionalKey(S.String),
  navigationPath: S.optionalKey(S.String),
  frontmatter: PageFrontmatter,
  toc: S.Array(TocItem),
  plainText: S.String,
})
export type PageMetadata = typeof PageMetadata.Type

export interface ContentPage<Data> {
  readonly metadata: PageMetadata
  readonly data: Data
}

/** A content source is intentionally independent from Vite and Foldkit. */
export interface ContentSource<Data> {
  readonly name: string
  readonly load: () => Promise<ReadonlyArray<ContentPage<Data>>>
}

/** A Markdown/MDX file supplied by a remote service or CMS. */
export const ContentFile = S.Struct({
  path: S.String,
  source: S.String,
  locale: S.optionalKey(S.String),
})
export type ContentFile = typeof ContentFile.Type

/** Build-time source consumed by the Foldocs Vite plugin. */
export interface ContentAdapter {
  readonly name: string
  readonly load: () => Promise<ReadonlyArray<ContentFile>>
}

export const defineContentAdapter = (
  name: string,
  load: ContentAdapter['load'],
): ContentAdapter => ({ name, load })

export const decodePageFrontmatter = S.decodeUnknownSync(PageFrontmatter)
export const decodePageMetadata = S.decodeUnknownSync(PageMetadata)
export const decodeContentFile = S.decodeUnknownSync(ContentFile)
