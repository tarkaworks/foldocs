import { Schema as S } from "effect";

/** Author-controlled metadata shared by every Effectdocs content source. */
export const PageFrontmatter = S.Struct({
  title: S.String,
  description: S.optionalKey(S.String),
  icon: S.optionalKey(S.String),
  label: S.optionalKey(S.String),
  order: S.optionalKey(S.Number),
  draft: S.optionalKey(S.Boolean),
  hidden: S.optionalKey(S.Boolean),
  keywords: S.optionalKey(S.Array(S.String)),
  tags: S.optionalKey(S.Array(S.String)),
});
export type PageFrontmatter = typeof PageFrontmatter.Type;

export const TocItem = S.Struct({
  id: S.String,
  title: S.String,
  depth: S.Number,
});
export type TocItem = typeof TocItem.Type;

/** Serializable metadata kept in the eagerly loaded document manifest. */
export const PageMetadata = S.Struct({
  id: S.String,
  slug: S.String,
  url: S.String,
  file: S.String,
  frontmatter: PageFrontmatter,
  toc: S.Array(TocItem),
  plainText: S.String,
});
export type PageMetadata = typeof PageMetadata.Type;

export interface ContentPage<Data> {
  readonly metadata: PageMetadata;
  readonly data: Data;
}

/** A content source is intentionally independent from Vite and Foldkit. */
export interface ContentSource<Data> {
  readonly name: string;
  readonly load: () => Promise<ReadonlyArray<ContentPage<Data>>>;
}

export const decodePageFrontmatter = S.decodeUnknownSync(PageFrontmatter);
export const decodePageMetadata = S.decodeUnknownSync(PageMetadata);
