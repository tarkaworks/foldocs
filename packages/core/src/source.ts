import type { PageMetadata } from '@foldocs/content'

import type { PageManifest, PageManifestEntry } from './manifest.js'
import {
  type NavigationFolder,
  type NavigationMeta,
  type NavigationMetaMap,
  type NavigationNode,
  type NavigationPage,
  buildNavigation,
} from './navigation.js'

export interface SourcePageFile<Page> {
  readonly type: 'page'
  readonly path: string
  readonly data: PageManifestEntry<Page>
}

export interface SourceMetaFile {
  readonly type: 'meta'
  readonly path: string
  readonly data: NavigationMeta
}

export type SourceFile<Page> = SourcePageFile<Page> | SourceMetaFile

export interface StaticSource<Page> {
  readonly files: ReadonlyArray<SourceFile<Page>>
}

export interface SourceStorage<Page> {
  readonly read: (path: string) => SourceFile<Page> | undefined
  readonly write: (file: SourceFile<Page>) => void
  readonly delete: (path: string) => boolean
  readonly list: () => ReadonlyArray<SourceFile<Page>>
}

export interface LoaderPluginContext<Page> {
  readonly storage: SourceStorage<Page>
}

export interface LoaderPlugin<Page> {
  readonly name?: string
  readonly transformStorage?: (context: LoaderPluginContext<Page>) => void
  readonly transformPageTree?: (
    tree: ReadonlyArray<NavigationNode>,
    context: LoaderPluginContext<Page>,
  ) => ReadonlyArray<NavigationNode>
}

export interface LoaderOptions<Page> {
  readonly source: PageManifest<Page> | StaticSource<Page>
  readonly baseUrl?: string
  readonly plugins?: ReadonlyArray<LoaderPlugin<Page>>
}

export interface LanguageEntry<Page> {
  readonly language: string
  readonly pages: ReadonlyArray<PageManifestEntry<Page>>
  readonly pageTree: ReadonlyArray<NavigationNode>
}

export interface ContentLoader<Page> {
  readonly getPage: (
    slugs: string | ReadonlyArray<string>,
    locale?: string,
  ) => PageManifestEntry<Page> | undefined
  readonly getPages: (locale?: string) => ReadonlyArray<PageManifestEntry<Page>>
  readonly getPageTree: (locale?: string) => ReadonlyArray<NavigationNode>
  readonly getNodePage: (
    node: NavigationPage,
  ) => PageManifestEntry<Page> | undefined
  readonly getNodeMeta: (node: NavigationFolder) => NavigationMeta | undefined
  readonly getLanguages: () => ReadonlyArray<LanguageEntry<Page>>
  readonly generateParams: () => ReadonlyArray<
    Readonly<{ slug: ReadonlyArray<string>; lang?: string }>
  >
  readonly serializePageTree: (
    tree?: ReadonlyArray<NavigationNode>,
  ) => Promise<ReadonlyArray<NavigationNode>>
}

const normalizePath = (value: string): string =>
  value.replace(/^\.\//u, '').replace(/^\/+|\/+$/gu, '')

const metadataPath = (value: string): string => {
  const normalized = normalizePath(value)
  return normalized.endsWith('meta.json')
    ? normalized
    : `${normalized.length === 0 ? '' : `${normalized}/`}meta.json`
}

const isStaticSource = <Page>(
  source: PageManifest<Page> | StaticSource<Page>,
): source is StaticSource<Page> => !Array.isArray(source)

const createStorage = <Page>(
  source: PageManifest<Page> | StaticSource<Page>,
): SourceStorage<Page> => {
  const initial: ReadonlyArray<SourceFile<Page>> = isStaticSource(source)
    ? source.files
    : source.map(page => ({
        type: 'page' as const,
        path: normalizePath(page.file || page.id),
        data: page,
      }))
  const files = new Map(
    initial.map(file => [normalizePath(file.path), file] as const),
  )
  return {
    read: path => files.get(normalizePath(path)),
    write: file => files.set(normalizePath(file.path), file),
    delete: path => files.delete(normalizePath(path)),
    list: () => [...files.values()],
  }
}

const metaMapFromStorage = <Page>(
  storage: SourceStorage<Page>,
): NavigationMetaMap =>
  Object.fromEntries(
    storage.list().flatMap(file => {
      if (file.type !== 'meta') return []
      const path = normalizePath(file.path).replace(/\/?meta\.json$/iu, '')
      return [[path, file.data]]
    }),
  )

const stripBase = (slug: string, baseUrl: string): string => {
  const normalizedBase = normalizePath(baseUrl)
  const normalizedSlug = normalizePath(slug)
  if (normalizedBase.length === 0) return normalizedSlug
  return normalizedSlug.startsWith(`${normalizedBase}/`)
    ? normalizedSlug.slice(normalizedBase.length + 1)
    : normalizedSlug === normalizedBase
      ? ''
      : normalizedSlug
}

/** Build a framework-independent, synchronous loader over a static source. */
export const loader = <Page>(
  options: LoaderOptions<Page>,
): ContentLoader<Page> => {
  const storage = createStorage(options.source)
  const context: LoaderPluginContext<Page> = { storage }
  for (const plugin of options.plugins ?? []) plugin.transformStorage?.(context)

  const pages = storage
    .list()
    .flatMap(file => (file.type === 'page' ? [file.data] : []))
  const metadata = metaMapFromStorage(storage)
  const locales = [
    ...new Set(
      pages.flatMap(page => (page.locale === undefined ? [] : [page.locale])),
    ),
  ].sort()
  const pagesFor = (locale?: string) =>
    pages.filter(page => locale === undefined || page.locale === locale)
  const treeFor = (locale?: string): ReadonlyArray<NavigationNode> => {
    const navigationPages = pagesFor(locale).map(page => {
      if (locale === undefined || page.navigationPath !== undefined) return page
      const file = normalizePath(page.file || page.id)
      const prefix = `${locale}/`
      return {
        ...page,
        navigationPath: file.startsWith(prefix)
          ? file.slice(prefix.length)
          : file,
      }
    })
    let tree = buildNavigation(navigationPages, metadata)
    for (const plugin of options.plugins ?? [])
      tree = plugin.transformPageTree?.(tree, context) ?? tree
    return tree
  }
  const baseUrl = options.baseUrl ?? '/docs'

  return {
    getPage: (slugs, locale) => {
      const slug = stripBase(
        typeof slugs === 'string' ? slugs : slugs.join('/'),
        baseUrl,
      )
      return pagesFor(locale).find(page => page.slug === slug)
    },
    getPages: pagesFor,
    getPageTree: treeFor,
    getNodePage: node => pages.find(page => page.id === node.page.id),
    getNodeMeta: node =>
      metadata[node.directory] ??
      (storage.read(metadataPath(node.directory))?.type === 'meta'
        ? (storage.read(metadataPath(node.directory)) as SourceMetaFile).data
        : undefined),
    getLanguages: () =>
      (locales.length === 0 ? [''] : locales).map(language => ({
        language,
        pages: pagesFor(language.length === 0 ? undefined : language),
        pageTree: treeFor(language.length === 0 ? undefined : language),
      })),
    generateParams: () =>
      pages.map(page => ({
        slug: page.slug.split('/').filter(Boolean),
        ...(page.locale === undefined ? {} : { lang: page.locale }),
      })),
    serializePageTree: async tree =>
      structuredClone(tree ?? treeFor()) as ReadonlyArray<NavigationNode>,
  }
}

export interface DynamicSource<Page> {
  readonly files: () => Promise<ReadonlyArray<SourceFile<Page>>>
  readonly configure?: (loader: {
    readonly invalidate: (source?: string) => void
    readonly revalidate: (source?: string) => Promise<ContentLoader<Page>>
  }) => void
}

export interface DynamicContentLoader<Page> {
  readonly get: () => Promise<ContentLoader<Page>>
  readonly invalidate: (source?: string) => void
  readonly revalidate: (source?: string) => Promise<ContentLoader<Page>>
}

/** Cache and explicitly revalidate a runtime content source. */
export const dynamicLoader = <Page>(
  source: DynamicSource<Page>,
  options: Omit<LoaderOptions<Page>, 'source'> = {},
): DynamicContentLoader<Page> => {
  let cached: Promise<ContentLoader<Page>> | undefined
  const build = async (): Promise<ContentLoader<Page>> =>
    loader({ ...options, source: { files: await source.files() } })
  const get = (): Promise<ContentLoader<Page>> => (cached ??= build())
  const invalidate = (_source?: string): void => {
    cached = undefined
  }
  const revalidate = async (_source?: string): Promise<ContentLoader<Page>> => {
    const pending = build()
    cached = pending
    try {
      return await pending
    } catch (error) {
      if (cached === pending) cached = undefined
      throw error
    }
  }
  source.configure?.({ invalidate, revalidate })
  return { get, invalidate, revalidate }
}

export const defineLoaderPlugin = <Page>(
  plugin: LoaderPlugin<Page>,
): LoaderPlugin<Page> => plugin

export const defineStaticSource = <Page>(
  files: ReadonlyArray<SourceFile<Page>>,
): StaticSource<Page> => ({ files })

export type { PageMetadata }
