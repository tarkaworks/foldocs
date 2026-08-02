import {
  type FoldocsConfig,
  type NavigationMeta,
  type NavigationMetaMap,
  type NavigationNode,
  type ResolvedFoldocsConfig,
  buildNavigation,
  localeDefinition,
  localeFromPathname,
  localeHomePath,
  localizedPathname,
  resolveConfig,
} from 'foldocs-core'
import {
  type CodeHighlighter,
  type CompiledPage,
  type MarkdownPluginOptions,
  compile,
} from 'foldocs-mdx'
import type { MarkdownIslands, MdxComponents } from 'foldocs-ui'
import { execFile as execFileCallback } from 'node:child_process'
import { promises as fs } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { promisify } from 'node:util'
import type { HtmlTagDescriptor, Plugin, ResolvedConfig } from 'vite'

import {
  type ContentAdapter,
  type PageMetadata,
  decodeContentFile,
} from '@foldocs/content'

import {
  isMarkdownPreferred,
  makeLandingMarkdown,
  makePageMarkdown,
  markdownAssetPath,
  pageUrlFromMarkdownPath,
} from './markdown.js'
import {
  type PrerenderRoute,
  prerenderRouteHtml,
  routeHtmlFile,
} from './prerender.js'

export {
  isMarkdownPreferred,
  makeLandingMarkdown,
  makePageMarkdown,
  markdownAssetPath,
  pageUrlFromMarkdownPath,
} from './markdown.js'
export {
  prerenderRouteHtml,
  routeHtmlFile,
  serializeHtml,
} from './prerender.js'

const virtualModuleId = 'virtual:foldocs'
const resolvedVirtualModuleId = `\0${virtualModuleId}`
const virtualPagePrefix = 'virtual:foldocs/page/'
const resolvedVirtualPagePrefix = `\0${virtualPagePrefix}`
const documentPattern = /\.(?:md|mdx)$/iu
const metaFileName = 'meta.json'
const execFile = promisify(execFileCallback)

interface DiscoveredPage {
  readonly moduleId: string
  readonly metadata: PageMetadata
  readonly compiled: CompiledPage
}

export interface FoldocsPluginOptions extends FoldocsConfig {
  /** Shared deterministic MDX renderers used for production route HTML. */
  readonly components?: MdxComponents
  /** Typed @foldkit/markdown island views used for production route HTML. */
  readonly islands?: MarkdownIslands
  /** Official @foldkit/markdown options used to validate `.md` islands. */
  readonly markdownOptions?: MarkdownPluginOptions
  /** Optional compiler-aware build-time code highlighter such as @foldocs/twoslash. */
  readonly highlightCode?: CodeHighlighter
}

const contentAdapterNamePattern = /^[a-z0-9][a-z0-9._-]*$/iu

const assertContentAdapters = (
  adapters: ReadonlyArray<ContentAdapter>,
): void => {
  const names = new Set<string>()
  for (const adapter of adapters) {
    if (!contentAdapterNamePattern.test(adapter.name))
      throw new TypeError(
        `Foldocs content source name ${JSON.stringify(adapter.name)} is not URL-safe.`,
      )
    if (names.has(adapter.name))
      throw new TypeError(
        `Foldocs content source ${adapter.name} is duplicated.`,
      )
    names.add(adapter.name)
  }
}

const toPosix = (value: string): string => value.split(path.sep).join('/')

const walk = async (directory: string): Promise<ReadonlyArray<string>> => {
  const entries = await fs
    .readdir(directory, { withFileTypes: true })
    .catch(error => {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return []
      throw error
    })
  const files = await Promise.all(
    entries.map(async entry => {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) return walk(target)
      return entry.isFile() && documentPattern.test(entry.name) ? [target] : []
    }),
  )
  return files.flat().sort((left, right) => left.localeCompare(right))
}

const walkAssets = async (
  directory: string,
): Promise<ReadonlyArray<string>> => {
  const entries = await fs
    .readdir(directory, { withFileTypes: true })
    .catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    })
  const files = await Promise.all(
    entries
      .filter(entry => !entry.name.startsWith('.'))
      .map(async entry => {
        const target = path.join(directory, entry.name)
        if (entry.isDirectory()) return walkAssets(target)
        return entry.isFile() &&
          !documentPattern.test(entry.name) &&
          entry.name !== metaFileName
          ? [target]
          : []
      }),
  )
  return files.flat().sort((left, right) => left.localeCompare(right))
}

const assetContentType = (file: string): string => {
  switch (path.extname(file).toLowerCase()) {
    case '.avif':
      return 'image/avif'
    case '.gif':
      return 'image/gif'
    case '.jpeg':
    case '.jpg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.svg':
      return 'image/svg+xml; charset=utf-8'
    case '.webp':
      return 'image/webp'
    case '.pdf':
      return 'application/pdf'
    case '.json':
      return 'application/json; charset=utf-8'
    default:
      return 'application/octet-stream'
  }
}

const assetPublicPath = (root: string, file: string): string =>
  toPosix(path.relative(root, file))
    .split('/')
    .filter(segment => !/^\(.+\)$/u.test(segment))
    .join('/')

const slugFromFile = (contentRoot: string, file: string): string => {
  const relative = toPosix(path.relative(contentRoot, file)).replace(
    documentPattern,
    '',
  )
  const segments = relative.split('/')
  if (segments.at(-1)?.toLowerCase() === 'index') segments.pop()
  return segments.filter(segment => !/^\(.+\)$/u.test(segment)).join('/')
}

const slugFromRelativeFile = (file: string): string => {
  const segments = file.replace(documentPattern, '').split('/')
  if (segments.at(-1)?.toLowerCase() === 'index') segments.pop()
  return segments.filter(segment => !/^\(.+\)$/u.test(segment)).join('/')
}

const dottedLocaleFile = (
  relativeFile: string,
  locales: ReadonlyArray<string>,
  defaultLocale: string,
): { readonly locale: string; readonly file: string } => {
  for (const locale of locales) {
    const marker = `.${locale}`
    const extension = path.posix.extname(relativeFile)
    const stem = relativeFile.slice(0, -extension.length)
    if (!stem.endsWith(marker)) continue
    return {
      locale,
      file: `${stem.slice(0, -marker.length)}${extension}`,
    }
  }
  return { locale: defaultLocale, file: relativeFile }
}

const discoverNavigationMeta = async (
  directory: string,
  contentDirectory = directory,
): Promise<NavigationMetaMap> => {
  const entries = await fs
    .readdir(directory, { withFileTypes: true })
    .catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    })
  const nested = await Promise.all(
    entries
      .filter(entry => entry.isDirectory())
      .map(entry =>
        discoverNavigationMeta(
          path.join(directory, entry.name),
          contentDirectory,
        ),
      ),
  )
  const metaPath = path.join(directory, metaFileName)
  const current = await fs.readFile(metaPath, 'utf8').then(
    source => {
      const parsed: unknown = JSON.parse(source)
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      )
        throw new TypeError(`${metaPath} must contain a JSON object.`)
      const value = parsed as Record<string, unknown>
      if (value.title !== undefined && typeof value.title !== 'string')
        throw new TypeError(`${metaPath} title must be a string.`)
      if (
        value.description !== undefined &&
        typeof value.description !== 'string'
      )
        throw new TypeError(`${metaPath} description must be a string.`)
      if (value.icon !== undefined && typeof value.icon !== 'string')
        throw new TypeError(`${metaPath} icon must be a string.`)
      if (
        value.defaultOpen !== undefined &&
        typeof value.defaultOpen !== 'boolean'
      )
        throw new TypeError(`${metaPath} defaultOpen must be a boolean.`)
      if (
        value.pages !== undefined &&
        (!Array.isArray(value.pages) ||
          !value.pages.every(entry => typeof entry === 'string'))
      )
        throw new TypeError(`${metaPath} pages must be an array of strings.`)
      if (value.root !== undefined && typeof value.root !== 'boolean')
        throw new TypeError(`${metaPath} root must be a boolean.`)
      const meta: NavigationMeta = {
        ...(typeof value.title === 'string' ? { title: value.title } : {}),
        ...(typeof value.description === 'string'
          ? { description: value.description }
          : {}),
        ...(typeof value.icon === 'string' ? { icon: value.icon } : {}),
        ...(typeof value.defaultOpen === 'boolean'
          ? { defaultOpen: value.defaultOpen }
          : {}),
        ...(typeof value.root === 'boolean' ? { root: value.root } : {}),
        ...(Array.isArray(value.pages)
          ? { pages: value.pages as string[] }
          : {}),
      }
      return {
        [toPosix(path.relative(contentDirectory, directory))]: meta,
      }
    },
    error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
      throw error
    },
  )
  return Object.assign({}, current, ...nested) as NavigationMetaMap
}

const joinUrl = (basePath: string, slug: string): string => {
  const value = [basePath, slug]
    .filter(Boolean)
    .join('/')
    .replace(/\/{2,}/gu, '/')
  return value.length === 0 ? '/' : value.startsWith('/') ? value : `/${value}`
}

const importSpecifier = (root: string, file: string): string => {
  const relative = toPosix(path.relative(root, file))
  return relative.startsWith('../') ? `/@fs/${toPosix(file)}` : `/${relative}`
}

const xmlEscape = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

const absoluteUrl = (baseUrl: string, pathname: string): string =>
  new URL(
    pathname.replace(/^\//u, ''),
    `${baseUrl.replace(/\/+$/u, '')}/`,
  ).toString()

export const searchIndexAssetPath = (
  localized: boolean,
  locale: string,
): string => `${localized ? `${locale}/` : ''}search-index.json`

const searchDocumentsFromPages = (pages: ReadonlyArray<DiscoveredPage>) =>
  pages.map(({ metadata }) => ({
    id: metadata.id,
    url: metadata.url,
    title: metadata.frontmatter.title,
    ...(metadata.frontmatter.description === undefined
      ? {}
      : { description: metadata.frontmatter.description }),
    content: metadata.plainText,
    locale: metadata.locale,
    ...(metadata.frontmatter.tags === undefined
      ? {}
      : { tags: metadata.frontmatter.tags }),
  }))

const metadataWithoutPageContent = (metadata: PageMetadata): PageMetadata => ({
  id: metadata.id,
  slug: metadata.slug,
  url: metadata.url,
  file: '',
  ...(metadata.locale === undefined ? {} : { locale: metadata.locale }),
  ...(metadata.translationKey === undefined
    ? {}
    : { translationKey: metadata.translationKey }),
  ...(metadata.lastModified === undefined
    ? {}
    : { lastModified: metadata.lastModified }),
  frontmatter: metadata.frontmatter,
  toc: [],
  plainText: '',
})

const navigationWithoutPageContent = (
  nodes: ReadonlyArray<NavigationNode>,
): ReadonlyArray<NavigationNode> =>
  nodes.map(node =>
    node._tag === 'Page'
      ? { ...node, page: metadataWithoutPageContent(node.page) }
      : node._tag === 'Folder'
        ? {
            ...node,
            ...(node.index === undefined
              ? {}
              : {
                  index: {
                    ...node.index,
                    page: metadataWithoutPageContent(node.index.page),
                  },
                }),
            children: navigationWithoutPageContent(node.children),
          }
        : node,
  )

const socialImageUrl = (config: ResolvedFoldocsConfig): string | undefined => {
  const image =
    config.site.socialImage ??
    (config.og.enabled
      ? ogLandingPath(config, config.i18n.defaultLocale)
      : undefined)
  if (image === undefined || config.site.baseUrl === undefined) return image
  return absoluteUrl(config.site.baseUrl, image)
}

const ogLandingPath = (config: ResolvedFoldocsConfig, locale: string): string =>
  `/${[
    config.og.directory,
    ...(config.i18n.enabled ? [locale] : []),
    'home.png',
  ].join('/')}`

const ogImagePath = (
  config: ResolvedFoldocsConfig,
  locale: string,
  slug: string,
): string =>
  `/${[
    config.og.directory,
    ...(config.i18n.enabled ? [locale] : []),
    slug.length === 0 ? 'index.png' : `${slug}.png`,
  ]
    .filter(Boolean)
    .join('/')}`

const rssAssetPath = (config: ResolvedFoldocsConfig, locale: string): string =>
  `${config.i18n.enabled && locale !== config.i18n.defaultLocale ? `${locale}/` : ''}${config.rss.path}`

const makeRss = (
  config: ResolvedFoldocsConfig,
  pages: ReadonlyArray<DiscoveredPage>,
  locale: string,
): string => {
  const channelUrl = absoluteUrl(
    config.site.baseUrl!,
    localeHomePath(config.i18n, locale),
  )
  const items = pages
    .filter(page => page.metadata.locale === locale)
    .map(({ metadata }) => {
      const href = absoluteUrl(config.site.baseUrl!, metadata.url)
      const published = metadata.lastModified
      return [
        '<item>',
        `<title>${xmlEscape(metadata.frontmatter.title)}</title>`,
        `<link>${xmlEscape(href)}</link>`,
        `<guid isPermaLink="true">${xmlEscape(href)}</guid>`,
        ...(metadata.frontmatter.description === undefined
          ? []
          : [
              `<description>${xmlEscape(metadata.frontmatter.description)}</description>`,
            ]),
        ...(published === undefined
          ? []
          : [`<pubDate>${new Date(published).toUTCString()}</pubDate>`]),
        '</item>',
      ].join('')
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${xmlEscape(config.rss.title)}</title><link>${xmlEscape(channelUrl)}</link>${config.rss.description === undefined ? '' : `<description>${xmlEscape(config.rss.description)}</description>`}<language>${xmlEscape(locale)}</language>\n${items}\n</channel></rss>\n`
}

const ogSvg = (
  siteTitle: string,
  pageTitle: string,
  description: string | undefined,
): string => {
  const titleWords = pageTitle.split(/\s+/u)
  const lines: string[] = []
  for (const word of titleWords) {
    const current = lines.at(-1)
    if (current === undefined || `${current} ${word}`.length > 34)
      lines.push(word)
    else lines[lines.length - 1] = `${current} ${word}`
  }
  const titleLines = lines.slice(0, 3)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#1c1a20"/><rect x="56" y="56" width="1088" height="518" rx="28" fill="#232127" stroke="#3d3944"/><circle cx="104" cy="108" r="18" fill="#9bd32e"/><text x="140" y="119" fill="#f7f5f8" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="600">${xmlEscape(siteTitle)}</text>${titleLines.map((line, index) => `<text x="96" y="${String(250 + index * 70)}" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-size="58" font-weight="500">${xmlEscape(line)}</text>`).join('')}${description === undefined ? '' : `<text x="96" y="500" fill="#aaa4b2" font-family="Inter,Arial,sans-serif" font-size="26">${xmlEscape(description.slice(0, 90))}</text>`}</svg>`
}

const headTags = (
  config: ResolvedFoldocsConfig,
): ReadonlyArray<HtmlTagDescriptor> => {
  const { site } = config
  const image = socialImageUrl(config)
  return [
    ...(site.description === undefined
      ? []
      : [
          {
            tag: 'meta',
            attrs: { name: 'description', content: site.description },
            injectTo: 'head' as const,
          },
          {
            tag: 'meta',
            attrs: { property: 'og:description', content: site.description },
            injectTo: 'head' as const,
          },
          {
            tag: 'meta',
            attrs: {
              name: 'twitter:description',
              content: site.description,
            },
            injectTo: 'head' as const,
          },
        ]),
    ...(site.keywords === undefined || site.keywords.length === 0
      ? []
      : [
          {
            tag: 'meta',
            attrs: { name: 'keywords', content: site.keywords.join(', ') },
            injectTo: 'head' as const,
          },
        ]),
    {
      tag: 'meta',
      attrs: { property: 'og:title', content: site.title },
      injectTo: 'head' as const,
    },
    {
      tag: 'meta',
      attrs: { property: 'og:type', content: 'website' },
      injectTo: 'head' as const,
    },
    {
      tag: 'meta',
      attrs: { name: 'twitter:title', content: site.title },
      injectTo: 'head' as const,
    },
    {
      tag: 'meta',
      attrs: {
        name: 'twitter:card',
        content: image === undefined ? 'summary' : 'summary_large_image',
      },
      injectTo: 'head' as const,
    },
    ...(image === undefined
      ? []
      : [
          {
            tag: 'meta',
            attrs: { property: 'og:image', content: image },
            injectTo: 'head' as const,
          },
          {
            tag: 'meta',
            attrs: { name: 'twitter:image', content: image },
            injectTo: 'head' as const,
          },
        ]),
    ...(site.favicon === undefined
      ? []
      : [
          {
            tag: 'link',
            attrs: { rel: 'icon', href: site.favicon },
            injectTo: 'head' as const,
          },
        ]),
    ...(config.rss.enabled && site.baseUrl !== undefined
      ? [
          {
            tag: 'link',
            attrs: {
              rel: 'alternate',
              type: 'application/rss+xml',
              title: config.rss.title,
              href: `/${rssAssetPath(config, config.i18n.defaultLocale)}`,
            },
            injectTo: 'head' as const,
          },
        ]
      : []),
  ]
}

const prepareIndexHtml = (
  html: string,
  locale: string,
  direction: 'ltr' | 'rtl',
): string => {
  const safeLocale = /^[a-z0-9-]+$/iu.test(locale) ? locale : 'en'
  const localized = html.replace(
    /<html(?:\s+lang="[^"]*")?(?:\s+dir="[^"]*")?\s*>/iu,
    `<html lang="${safeLocale}" dir="${direction}">`,
  )
  const cssLinkPattern =
    /<link\s+rel="stylesheet"[^>]*crossorigin[^>]*href="[^"]*\.css"[^>]*>/giu
  const cssLinks = localized.match(cssLinkPattern)
  if (cssLinks === null) return localized
  let result = localized
  for (const link of cssLinks) result = result.replace(link, '')
  const cleaned = cssLinks.map(link =>
    link.replace(/\s+crossorigin(?:="[^"]*")?/iu, ''),
  )
  const head = result.indexOf('<head>')
  if (head < 0) return localized
  const insertAt = head + '<head>'.length
  return `${result.slice(0, insertAt)}\n    ${cleaned.join('\n    ')}${result.slice(insertAt)}`
}

const makeLlmsIndex = (
  config: ResolvedFoldocsConfig,
  pages: ReadonlyArray<DiscoveredPage>,
  locale = config.i18n.defaultLocale,
): string => {
  const fullPath = config.i18n.enabled
    ? `/${locale}/llms-full.txt`
    : '/llms-full.txt'
  const header = [
    `# ${config.site.title}`,
    config.site.description === undefined
      ? undefined
      : `> ${config.site.description}`,
    `Every documentation page is available as Markdown by appending \`.md\` to its URL. A single-file concatenation is available at ${
      config.site.baseUrl === undefined
        ? fullPath
        : absoluteUrl(config.site.baseUrl, fullPath)
    }.`,
    '## Documentation',
  ].filter((line): line is string => line !== undefined)
  const links = pages.map(({ metadata }) => {
    const href =
      config.site.baseUrl === undefined
        ? metadata.url
        : absoluteUrl(config.site.baseUrl, metadata.url)
    const description = metadata.frontmatter.description
    return `- [${metadata.frontmatter.title}](${href})${
      description === undefined ? '' : `: ${description}`
    }`
  })
  return `${[...header, ...links].join('\n\n')}\n`
}

const makeLlmsFull = (
  config: ResolvedFoldocsConfig,
  pages: ReadonlyArray<DiscoveredPage>,
): string =>
  `${[
    `# ${config.site.title}`,
    config.site.description === undefined
      ? undefined
      : `> ${config.site.description}`,
    ...pages.map(page => {
      const source =
        config.site.baseUrl === undefined
          ? page.metadata.url
          : absoluteUrl(config.site.baseUrl, page.metadata.url)
      return `Source: ${source}\n\n${makePageMarkdown(config.site, page).trim()}`
    }),
  ]
    .filter((value): value is string => value !== undefined)
    .join('\n\n')}\n`

/**
 * Turns a directory of Markdown and deterministic MDX into typed Foldkit page
 * modules and a virtual, lazy-loaded document manifest.
 */
export const foldocs = (options: FoldocsPluginOptions): Plugin => {
  const config = resolveConfig(options)
  assertContentAdapters(config.content.sources)
  const searchIndexUrls = Object.fromEntries(
    config.i18n.locales.map(({ locale }) => [
      locale,
      `/${searchIndexAssetPath(config.i18n.enabled, locale)}`,
    ]),
  )
  let viteConfig: ResolvedConfig
  let contentRoot = ''
  const compiledCache = new Map<string, Promise<CompiledPage>>()
  const lastModifiedCache = new Map<string, Promise<string | undefined>>()
  const remoteModuleCache = new Map<
    string,
    { readonly source: string; readonly filePath: string }
  >()

  const compileFile = (
    file: string,
    highlight: boolean,
  ): Promise<CompiledPage> => {
    const cacheKey = `${file}:${highlight ? 'highlight' : 'plain'}`
    const existing = compiledCache.get(cacheKey)
    if (existing !== undefined) return existing
    const pending = fs.readFile(file, 'utf8').then(source =>
      compile(source, {
        filePath: file,
        highlight,
        ...(options.markdownOptions === undefined
          ? {}
          : { markdown: options.markdownOptions }),
        ...(options.highlightCode === undefined
          ? {}
          : { highlightCode: options.highlightCode }),
      }),
    )
    compiledCache.set(cacheKey, pending)
    return pending
  }

  const lastModifiedForFile = (file: string): Promise<string | undefined> => {
    if (config.content.lastModified === false) return Promise.resolve(undefined)
    const existing = lastModifiedCache.get(file)
    if (existing !== undefined) return existing
    const pending = (async () => {
      if (config.content.lastModified === 'git') {
        try {
          const result = await execFile(
            'git',
            ['log', '-1', '--format=%cI', '--', file],
            { cwd: viteConfig.root },
          )
          const value = result.stdout.trim()
          if (value.length > 0) return value
        } catch {
          // New/untracked files fall back to their filesystem timestamp.
        }
      }
      return (await fs.stat(file)).mtime.toISOString()
    })()
    lastModifiedCache.set(file, pending)
    return pending
  }

  const discover = async (
    highlight: boolean,
  ): Promise<ReadonlyArray<DiscoveredPage>> => {
    const localeRoots =
      config.i18n.enabled && config.i18n.parser === 'dir'
        ? config.i18n.locales.map(locale => ({
            locale: locale.locale,
            root: path.join(contentRoot, locale.locale),
          }))
        : [{ locale: config.i18n.defaultLocale, root: contentRoot }]
    const filesystemPages = (
      await Promise.all(
        localeRoots.map(async ({ locale: rootLocale, root }) => {
          const files = await walk(root)
          return Promise.all(
            files.map(async (absolutePath): Promise<DiscoveredPage> => {
              const compiled = await compileFile(absolutePath, highlight)
              const originalRelativeId = toPosix(
                path.relative(root, absolutePath),
              )
              const dotted = dottedLocaleFile(
                originalRelativeId,
                config.i18n.locales.map(entry => entry.locale),
                config.i18n.defaultLocale,
              )
              const locale =
                config.i18n.enabled && config.i18n.parser === 'dot'
                  ? dotted.locale
                  : rootLocale
              const relativeId =
                config.i18n.enabled && config.i18n.parser === 'dot'
                  ? dotted.file
                  : originalRelativeId
              const slug =
                config.i18n.enabled && config.i18n.parser === 'dot'
                  ? slugFromRelativeFile(relativeId)
                  : slugFromFile(root, absolutePath)
              const lastModified = await lastModifiedForFile(absolutePath)
              const relativeFile = toPosix(
                path.relative(viteConfig.root, absolutePath),
              )
              const docsPath = joinUrl(config.basePath, slug)
              return {
                moduleId: importSpecifier(viteConfig.root, absolutePath),
                compiled,
                metadata: {
                  id: config.i18n.enabled
                    ? `${locale}/${relativeId}`
                    : relativeId,
                  slug,
                  url: localizedPathname(config.i18n, locale, docsPath),
                  file: relativeFile,
                  locale,
                  sourceLocale: locale,
                  translationKey: slug,
                  navigationPath: relativeId,
                  ...(lastModified === undefined ? {} : { lastModified }),
                  frontmatter:
                    config.og.enabled &&
                    compiled.frontmatter.socialImage === undefined
                      ? {
                          ...compiled.frontmatter,
                          socialImage: ogImagePath(config, locale, slug),
                        }
                      : compiled.frontmatter,
                  toc: compiled.toc,
                  plainText: compiled.plainText,
                },
              }
            }),
          )
        }),
      )
    )
      .flat()
      .filter(
        ({ metadata }) =>
          !metadata.frontmatter.draft || viteConfig.command === 'serve',
      )
    remoteModuleCache.clear()
    const remotePages = (
      await Promise.all(
        config.content.sources.map(async adapter => {
          const files = await adapter.load()
          return Promise.all(
            files.map(async (unknownFile): Promise<DiscoveredPage> => {
              const file = decodeContentFile(unknownFile)
              const rawPath = toPosix(file.path).replace(/^\/+|\/+$/gu, '')
              if (
                rawPath.length === 0 ||
                rawPath.split('/').some(segment => segment === '..') ||
                !documentPattern.test(rawPath)
              )
                throw new TypeError(
                  `Foldocs content source ${adapter.name} returned invalid path ${JSON.stringify(file.path)}.`,
                )
              const segments = rawPath.split('/')
              const pathLocale = config.i18n.locales.find(
                ({ locale }) => locale === segments[0],
              )?.locale
              const dotted = dottedLocaleFile(
                rawPath,
                config.i18n.locales.map(entry => entry.locale),
                config.i18n.defaultLocale,
              )
              const locale =
                file.locale ??
                pathLocale ??
                (config.i18n.parser === 'dot'
                  ? dotted.locale
                  : config.i18n.defaultLocale)
              if (!config.i18n.locales.some(entry => entry.locale === locale))
                throw new TypeError(
                  `Foldocs content source ${adapter.name} returned unknown locale ${JSON.stringify(locale)}.`,
                )
              if (
                pathLocale !== undefined &&
                (file.locale === undefined || file.locale === pathLocale)
              )
                segments.shift()
              const relativePath =
                config.i18n.parser === 'dot' && pathLocale === undefined
                  ? dotted.file
                  : segments.join('/')
              const virtualFile = `${adapter.name}:${locale}/${relativePath}`
              const compiled = await compile(file.source, {
                filePath: virtualFile,
                highlight,
                ...(options.markdownOptions === undefined
                  ? {}
                  : { markdown: options.markdownOptions }),
                ...(options.highlightCode === undefined
                  ? {}
                  : { highlightCode: options.highlightCode }),
              })
              const slug = relativePath
                .replace(documentPattern, '')
                .split('/')
                .filter(segment => !/^\(.+\)$/u.test(segment))
                .filter((segment, index, values) =>
                  index === values.length - 1
                    ? segment.toLowerCase() !== 'index'
                    : true,
                )
                .join('/')
              const id = `${locale}/@${adapter.name}/${relativePath}`
              const moduleId = `${virtualPagePrefix}${encodeURIComponent(id)}`
              remoteModuleCache.set(
                `${resolvedVirtualPagePrefix}${encodeURIComponent(id)}`,
                { source: file.source, filePath: virtualFile },
              )
              return {
                moduleId,
                compiled,
                metadata: {
                  id,
                  slug,
                  url: localizedPathname(
                    config.i18n,
                    locale,
                    joinUrl(config.basePath, slug),
                  ),
                  file: `remote:${adapter.name}/${relativePath}`,
                  locale,
                  sourceLocale: locale,
                  translationKey: slug,
                  navigationPath: relativePath,
                  ...(file.lastModified === undefined
                    ? {}
                    : { lastModified: file.lastModified }),
                  frontmatter:
                    config.og.enabled &&
                    compiled.frontmatter.socialImage === undefined
                      ? {
                          ...compiled.frontmatter,
                          socialImage: ogImagePath(config, locale, slug),
                        }
                      : compiled.frontmatter,
                  toc: compiled.toc,
                  plainText: compiled.plainText,
                },
              }
            }),
          )
        }),
      )
    )
      .flat()
      .filter(
        ({ metadata }) =>
          !metadata.frontmatter.draft || viteConfig.command === 'serve',
      )
    const sourcePages = [...filesystemPages, ...remotePages]
    const routeOwners = new Map<string, string>()
    for (const page of sourcePages) {
      const key = `${page.metadata.sourceLocale}:${page.metadata.slug}`
      const existing = routeOwners.get(key)
      if (existing !== undefined)
        throw new TypeError(
          `Foldocs route ${page.metadata.url} is provided by both ${existing} and ${page.metadata.file}.`,
        )
      routeOwners.set(key, page.metadata.file)
    }
    const pages = config.i18n.enabled
      ? config.i18n.locales.flatMap(target => {
          const targetPages = sourcePages.filter(
            ({ metadata }) => metadata.sourceLocale === target.locale,
          )
          const fallbackPages = sourcePages.filter(
            ({ metadata }) =>
              metadata.sourceLocale === config.i18n.fallbackLocale,
          )
          const slugs = new Set([
            ...fallbackPages.map(({ metadata }) => metadata.slug),
            ...targetPages.map(({ metadata }) => metadata.slug),
          ])
          return [...slugs].flatMap(slug => {
            const source =
              targetPages.find(({ metadata }) => metadata.slug === slug) ??
              fallbackPages.find(({ metadata }) => metadata.slug === slug)
            if (source === undefined) return []
            const sourceLocale = source.metadata.sourceLocale ?? target.locale
            const relativeId = source.metadata.id.replace(
              new RegExp(`^${sourceLocale}/`, 'u'),
              '',
            )
            return [
              {
                ...source,
                metadata: {
                  ...source.metadata,
                  id: `${target.locale}/${relativeId}`,
                  url: localizedPathname(
                    config.i18n,
                    target.locale,
                    joinUrl(config.basePath, slug),
                  ),
                  locale: target.locale,
                  sourceLocale,
                  translationKey: slug,
                },
              },
            ]
          })
        })
      : sourcePages
    const localeOrder = new Map(
      config.i18n.locales.map((locale, index) => [locale.locale, index]),
    )
    return pages.sort((left, right) => {
      const byLocale =
        (localeOrder.get(left.metadata.locale ?? '') ?? 0) -
        (localeOrder.get(right.metadata.locale ?? '') ?? 0)
      if (byLocale !== 0) return byLocale
      const byOrder =
        (left.metadata.frontmatter.order ?? Number.MAX_SAFE_INTEGER) -
        (right.metadata.frontmatter.order ?? Number.MAX_SAFE_INTEGER)
      return byOrder === 0
        ? left.metadata.slug.localeCompare(right.metadata.slug)
        : byOrder
    })
  }

  const discoverNavigationData = async (
    pages: ReadonlyArray<DiscoveredPage>,
  ) => {
    const navigationMetas = Object.fromEntries(
      await Promise.all(
        config.i18n.locales.map(async ({ locale }) => {
          if (!config.i18n.enabled || config.i18n.parser === 'dot')
            return [locale, await discoverNavigationMeta(contentRoot)]
          const fallback = await discoverNavigationMeta(
            path.join(contentRoot, config.i18n.fallbackLocale),
          )
          const localized = await discoverNavigationMeta(
            path.join(contentRoot, locale),
          )
          return [locale, { ...fallback, ...localized }]
        }),
      ),
    ) as Record<string, NavigationMetaMap>
    const navigations = Object.fromEntries(
      config.i18n.locales.map(({ locale }) => [
        locale,
        buildNavigation(
          pages
            .filter(({ metadata }) => metadata.locale === locale)
            .map(({ metadata }) => metadata),
          navigationMetas[locale],
        ),
      ]),
    )
    return { navigationMetas, navigations }
  }

  const serveMarkdown = async (
    request: IncomingMessage,
    response: ServerResponse,
    next: (error?: unknown) => void,
  ): Promise<void> => {
    if (
      !config.markdown ||
      (request.method !== 'GET' && request.method !== 'HEAD')
    ) {
      next()
      return
    }
    const pathname = new URL(request.url ?? '/', 'http://foldocs.local')
      .pathname
    const explicitPageUrl = pageUrlFromMarkdownPath(pathname)
    const negotiated = isMarkdownPreferred(request.headers.accept)
    if (explicitPageUrl === undefined && !negotiated) {
      next()
      return
    }
    const negotiatedPageUrl = pathname.replace(/\/+$/u, '') || '/'
    const pageUrl = explicitPageUrl ?? negotiatedPageUrl
    try {
      const pages = await discover(false)
      const page = pages.find(({ metadata }) => metadata.url === pageUrl)
      const landingLocale = config.i18n.locales.find(
        ({ locale }) => localeHomePath(config.i18n, locale) === pageUrl,
      )?.locale
      const markdown =
        page === undefined &&
        (pageUrl === '/' || landingLocale !== undefined) &&
        config.basePath !== ''
          ? makeLandingMarkdown(
              config.site,
              pages.find(
                ({ metadata }) =>
                  metadata.slug === '' &&
                  metadata.locale ===
                    (landingLocale ?? config.i18n.defaultLocale),
              )?.metadata.url ??
                pages[0]?.metadata.url ??
                config.basePath,
              config.landing,
            )
          : page === undefined
            ? undefined
            : makePageMarkdown(config.site, page)
      if (markdown === undefined) {
        next()
        return
      }
      response.statusCode = 200
      response.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      response.setHeader(
        'Content-Language',
        page?.metadata.sourceLocale ??
          landingLocale ??
          config.i18n.defaultLocale,
      )
      response.setHeader('X-Content-Type-Options', 'nosniff')
      response.setHeader('Content-Length', String(Buffer.byteLength(markdown)))
      response.end(request.method === 'HEAD' ? undefined : markdown)
    } catch (error) {
      next(error)
    }
  }

  const serveSearchIndex = async (
    request: IncomingMessage,
    response: ServerResponse,
    next: (error?: unknown) => void,
  ): Promise<void> => {
    if (
      !config.search.staticIndex ||
      (request.method !== 'GET' && request.method !== 'HEAD')
    ) {
      next()
      return
    }
    const pathname = new URL(request.url ?? '/', 'http://foldocs.local')
      .pathname
    const locale = config.i18n.locales.find(
      ({ locale: candidate }) => searchIndexUrls[candidate] === pathname,
    )?.locale
    if (locale === undefined) {
      next()
      return
    }
    try {
      const pages = (await discover(false)).filter(
        ({ metadata }) => metadata.locale === locale,
      )
      const source = JSON.stringify(searchDocumentsFromPages(pages))
      response.statusCode = 200
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.setHeader('Content-Language', locale)
      response.setHeader('Cache-Control', 'no-store')
      response.setHeader('X-Content-Type-Options', 'nosniff')
      response.setHeader('Content-Length', String(Buffer.byteLength(source)))
      response.end(request.method === 'HEAD' ? undefined : source)
    } catch (error) {
      next(error)
    }
  }

  const serveContentAsset = async (
    request: IncomingMessage,
    response: ServerResponse,
    next: (error?: unknown) => void,
  ): Promise<void> => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      next()
      return
    }
    try {
      const pathname = decodeURIComponent(
        new URL(request.url ?? '/', 'http://foldocs.local').pathname,
      )
      const locale = localeFromPathname(config.i18n, pathname)
      const prefix = localizedPathname(config.i18n, locale, config.basePath)
      if (!pathname.startsWith(`${prefix}/`)) {
        next()
        return
      }
      const relative = pathname.slice(prefix.length + 1)
      if (
        relative.length === 0 ||
        relative.split('/').some(segment => segment === '..') ||
        documentPattern.test(relative) ||
        path.basename(relative) === metaFileName
      ) {
        next()
        return
      }
      const roots =
        config.i18n.enabled && config.i18n.parser === 'dir'
          ? [
              path.join(contentRoot, locale),
              ...(locale === config.i18n.fallbackLocale
                ? []
                : [path.join(contentRoot, config.i18n.fallbackLocale)]),
            ]
          : [contentRoot]
      let file: string | undefined
      for (const root of roots) {
        file = (await walkAssets(root)).find(
          candidate => assetPublicPath(root, candidate) === relative,
        )
        if (file !== undefined) break
      }
      if (file === undefined) {
        next()
        return
      }
      const source = await fs.readFile(file)
      response.statusCode = 200
      response.setHeader('Content-Type', assetContentType(file))
      response.setHeader('X-Content-Type-Options', 'nosniff')
      response.setHeader('Content-Length', String(source.byteLength))
      response.end(request.method === 'HEAD' ? undefined : source)
    } catch (error) {
      next(error)
    }
  }

  const servePrerenderedHtml = async (
    request: IncomingMessage,
    response: ServerResponse,
    next: (error?: unknown) => void,
  ): Promise<void> => {
    if (
      !config.prerender ||
      (request.method !== 'GET' && request.method !== 'HEAD')
    ) {
      next()
      return
    }
    try {
      const pathname = decodeURIComponent(
        new URL(request.url ?? '/', 'http://foldocs.local').pathname,
      )
      if (
        path.extname(pathname) !== '' ||
        pathname.split('/').some(segment => segment === '..')
      ) {
        next()
        return
      }
      const outDir = path.resolve(viteConfig.root, viteConfig.build.outDir)
      const file = path.resolve(outDir, routeHtmlFile(pathname))
      if (file !== outDir && !file.startsWith(`${outDir}${path.sep}`)) {
        next()
        return
      }
      const source = await fs.readFile(file).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
        throw error
      })
      if (source === undefined) {
        next()
        return
      }
      response.statusCode = 200
      response.setHeader('Content-Type', 'text/html; charset=utf-8')
      response.setHeader('X-Content-Type-Options', 'nosniff')
      response.setHeader('Content-Length', String(source.byteLength))
      response.end(request.method === 'HEAD' ? undefined : source)
    } catch (error) {
      next(error)
    }
  }

  return {
    name: 'foldocs',
    enforce: 'pre',
    configResolved(resolved) {
      viteConfig = resolved
      contentRoot = path.resolve(resolved.root, config.content.dir)
    },
    configureServer(server) {
      server.watcher.add(contentRoot)
      server.middlewares.use((request, response, next) => {
        void serveContentAsset(request, response, assetError => {
          if (assetError !== undefined) {
            next(assetError)
            return
          }
          void serveSearchIndex(request, response, error => {
            if (error !== undefined) next(error)
            else void serveMarkdown(request, response, next)
          })
        })
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        void serveContentAsset(request, response, assetError => {
          if (assetError !== undefined) {
            next(assetError)
            return
          }
          void serveSearchIndex(request, response, error => {
            if (error !== undefined) next(error)
            else
              void serveMarkdown(request, response, markdownError => {
                if (markdownError !== undefined) next(markdownError)
                else void servePrerenderedHtml(request, response, next)
              })
          })
        })
      })
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const defaultLocale = localeDefinition(
          config.i18n,
          config.i18n.defaultLocale,
        )
        return {
          html: prepareIndexHtml(html, defaultLocale.locale, defaultLocale.dir),
          tags: [...headTags(config)],
        }
      },
    },
    resolveId(id) {
      if (id === virtualModuleId) return resolvedVirtualModuleId
      if (id.startsWith(virtualPagePrefix)) return `\0${id}`
      return undefined
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        const pages = await discover(false)
        const { navigationMetas, navigations } =
          await discoverNavigationData(pages)
        const clientNavigations = config.search.staticIndex
          ? Object.fromEntries(
              Object.entries(navigations).map(([locale, nodes]) => [
                locale,
                navigationWithoutPageContent(nodes),
              ]),
            )
          : navigations
        const navigationMeta = navigationMetas[config.i18n.defaultLocale] ?? {}
        const navigation = clientNavigations[config.i18n.defaultLocale] ?? []
        const entries = pages.map(({ moduleId, metadata }) => {
          const clientMetadata = config.search.staticIndex
            ? metadataWithoutPageContent(metadata)
            : metadata
          return `{ ...${JSON.stringify(clientMetadata)}, load: () => import(${JSON.stringify(moduleId)}) }`
        })
        return [
          `export const siteConfig = ${JSON.stringify(config.site)};`,
          `export const basePath = ${JSON.stringify(config.basePath)};`,
          `export const layout = ${JSON.stringify(config.layout)};`,
          `export const landing = ${JSON.stringify(config.landing)};`,
          `export const banner = ${JSON.stringify(config.banner)};`,
          `export const feedback = ${JSON.stringify(config.feedback)};`,
          `export const i18n = ${JSON.stringify(config.i18n)};`,
          `export const markdown = ${JSON.stringify(config.markdown)};`,
          `export const searchIndexUrls = ${JSON.stringify(searchIndexUrls)};`,
          `export const navigationMeta = ${JSON.stringify(navigationMeta)};`,
          `export const navigationMetas = ${JSON.stringify(navigationMetas)};`,
          `export const manifest = [${entries.join(',\n')}];`,
          `export const navigation = ${JSON.stringify(navigation)};`,
          `export const navigations = ${JSON.stringify(clientNavigations)};`,
          'export default manifest;',
        ].join('\n')
      }
      if (id.startsWith(resolvedVirtualPagePrefix)) {
        const remote = remoteModuleCache.get(id)
        if (remote === undefined)
          throw new TypeError(`Unknown Foldocs remote page module: ${id}`)
        const page = await compile(remote.source, {
          filePath: remote.filePath,
          highlight: true,
          ...(options.markdownOptions === undefined
            ? {}
            : { markdown: options.markdownOptions }),
          ...(options.highlightCode === undefined
            ? {}
            : { highlightCode: options.highlightCode }),
        })
        return `export default ${JSON.stringify(page)};`
      }
      const cleanId = id.split('?', 1)[0] ?? id
      if (
        documentPattern.test(cleanId) &&
        path.resolve(cleanId).startsWith(contentRoot)
      ) {
        const page = await compileFile(path.resolve(cleanId), true)
        return `export default ${JSON.stringify(page)};`
      }
      return undefined
    },
    async handleHotUpdate(context) {
      if (
        path.basename(context.file) === metaFileName &&
        path.resolve(context.file).startsWith(contentRoot)
      ) {
        const virtualModule = context.server.moduleGraph.getModuleById(
          resolvedVirtualModuleId,
        )
        if (virtualModule !== undefined)
          context.server.moduleGraph.invalidateModule(virtualModule)
        return virtualModule === undefined
          ? context.modules
          : [...context.modules, virtualModule]
      }
      if (
        !documentPattern.test(context.file) ||
        !path.resolve(context.file).startsWith(contentRoot)
      ) {
        return undefined
      }
      compiledCache.delete(`${context.file}:highlight`)
      compiledCache.delete(`${context.file}:plain`)
      const virtualModule = context.server.moduleGraph.getModuleById(
        resolvedVirtualModuleId,
      )
      if (virtualModule !== undefined)
        context.server.moduleGraph.invalidateModule(virtualModule)
      return virtualModule === undefined
        ? context.modules
        : [...context.modules, virtualModule]
    },
    async generateBundle() {
      const pages = await discover(false)
      for (const { locale } of config.i18n.locales) {
        const roots =
          config.i18n.enabled && config.i18n.parser === 'dir'
            ? [
                path.join(contentRoot, config.i18n.fallbackLocale),
                ...(locale === config.i18n.fallbackLocale
                  ? []
                  : [path.join(contentRoot, locale)]),
              ]
            : [contentRoot]
        const assets = new Map<string, string>()
        for (const root of roots) {
          for (const file of await walkAssets(root)) {
            const publicPath = assetPublicPath(root, file)
            const existing = assets.get(publicPath)
            if (
              existing !== undefined &&
              path.dirname(existing) === path.dirname(file)
            )
              throw new TypeError(
                `Foldocs content assets ${existing} and ${file} map to the same public path.`,
              )
            assets.set(publicPath, file)
          }
        }
        for (const [publicPath, file] of assets) {
          const url = localizedPathname(
            config.i18n,
            locale,
            joinUrl(config.basePath, publicPath),
          )
          this.emitFile({
            type: 'asset',
            fileName: url.replace(/^\/+/, ''),
            source: await fs.readFile(file),
          })
        }
      }
      if (config.search.staticIndex) {
        for (const { locale } of config.i18n.locales) {
          const localizedPages = pages.filter(
            ({ metadata }) => metadata.locale === locale,
          )
          this.emitFile({
            type: 'asset',
            fileName: searchIndexAssetPath(config.i18n.enabled, locale),
            source: JSON.stringify(searchDocumentsFromPages(localizedPages)),
          })
        }
      }
      if (config.markdown) {
        for (const page of pages) {
          this.emitFile({
            type: 'asset',
            fileName: markdownAssetPath(page.metadata.url),
            source: makePageMarkdown(config.site, page),
          })
        }
        const landingLocales = config.i18n.enabled
          ? config.i18n.locales.map(({ locale }) => locale)
          : [config.i18n.defaultLocale]
        for (const locale of landingLocales) {
          const landingUrl = localeHomePath(config.i18n, locale)
          if (pages.some(({ metadata }) => metadata.url === landingUrl))
            continue
          this.emitFile({
            type: 'asset',
            fileName: markdownAssetPath(landingUrl),
            source: makeLandingMarkdown(
              config.site,
              pages.find(
                ({ metadata }) =>
                  metadata.slug === '' && metadata.locale === locale,
              )?.metadata.url ??
                pages[0]?.metadata.url ??
                localizedPathname(config.i18n, locale, config.basePath),
              config.landing,
            ),
          })
        }
        if (config.i18n.enabled) {
          this.emitFile({
            type: 'asset',
            fileName: 'index.md',
            source: makeLandingMarkdown(
              config.site,
              localizedPathname(
                config.i18n,
                config.i18n.defaultLocale,
                config.basePath,
              ),
              config.landing,
            ),
          })
        }
      }
      if (config.llms) {
        for (const { locale } of config.i18n.locales) {
          const localizedPages = pages.filter(
            ({ metadata }) => metadata.locale === locale,
          )
          const directory = config.i18n.enabled ? `${locale}/` : ''
          this.emitFile({
            type: 'asset',
            fileName: `${directory}llms.txt`,
            source: makeLlmsIndex(config, localizedPages, locale),
          })
          this.emitFile({
            type: 'asset',
            fileName: `${directory}llms-full.txt`,
            source: makeLlmsFull(config, localizedPages),
          })
        }
        if (config.i18n.enabled) {
          const defaultPages = pages.filter(
            ({ metadata }) => metadata.locale === config.i18n.defaultLocale,
          )
          this.emitFile({
            type: 'asset',
            fileName: 'llms.txt',
            source: makeLlmsIndex(
              config,
              defaultPages,
              config.i18n.defaultLocale,
            ),
          })
          this.emitFile({
            type: 'asset',
            fileName: 'llms-full.txt',
            source: makeLlmsFull(config, defaultPages),
          })
        }
      }
      if (config.rss.enabled) {
        if (config.site.baseUrl === undefined) {
          this.warn(
            'Foldocs skipped RSS because site.baseUrl is not configured.',
          )
        } else {
          for (const { locale } of config.i18n.locales) {
            this.emitFile({
              type: 'asset',
              fileName: rssAssetPath(config, locale),
              source: makeRss(config, pages, locale),
            })
          }
        }
      }
      if (config.og.enabled) {
        const { default: sharp } = await import('sharp')
        for (const { locale } of config.i18n.locales) {
          this.emitFile({
            type: 'asset',
            fileName: ogLandingPath(config, locale).replace(/^\/+/, ''),
            source: await sharp(
              Buffer.from(
                ogSvg(
                  config.site.title,
                  config.landing.headline ?? config.site.title,
                  config.landing.description ?? config.site.description,
                ),
              ),
            )
              .png()
              .toBuffer(),
          })
        }
        for (const { metadata } of pages) {
          const locale = metadata.locale ?? config.i18n.defaultLocale
          const generatedPath = ogImagePath(config, locale, metadata.slug)
          if (metadata.frontmatter.socialImage !== generatedPath) continue
          this.emitFile({
            type: 'asset',
            fileName: generatedPath.replace(/^\/+/, ''),
            source: await sharp(
              Buffer.from(
                ogSvg(
                  config.site.title,
                  metadata.frontmatter.title,
                  metadata.frontmatter.description,
                ),
              ),
            )
              .png()
              .toBuffer(),
          })
        }
      }
      if (config.sitemap) {
        if (config.site.baseUrl === undefined) {
          this.warn(
            'Foldocs skipped sitemap.xml because site.baseUrl is not configured.',
          )
        } else {
          const routeGroups = new Map<string, Map<string, string>>()
          const addRoute = (key: string, locale: string, url: string): void => {
            const routes = routeGroups.get(key) ?? new Map<string, string>()
            routes.set(locale, url)
            routeGroups.set(key, routes)
          }
          for (const { locale } of config.i18n.locales)
            addRoute('__home__', locale, localeHomePath(config.i18n, locale))
          for (const { metadata } of pages)
            addRoute(
              metadata.translationKey ?? metadata.slug,
              metadata.locale ?? config.i18n.defaultLocale,
              metadata.url,
            )
          const urls = [...routeGroups.values()]
            .flatMap(routes => {
              const alternateLinks = config.i18n.enabled
                ? [
                    ...config.i18n.locales.flatMap(({ locale }) => {
                      const url = routes.get(locale)
                      return url === undefined
                        ? []
                        : [
                            `<xhtml:link rel="alternate" hreflang="${xmlEscape(locale)}" href="${xmlEscape(absoluteUrl(config.site.baseUrl!, url))}"/>`,
                          ]
                    }),
                    ...(routes.get(config.i18n.defaultLocale) === undefined
                      ? []
                      : [
                          `<xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(absoluteUrl(config.site.baseUrl!, routes.get(config.i18n.defaultLocale)!))}"/>`,
                        ]),
                  ].join('')
                : ''
              return [...routes.values()].map(
                url =>
                  `  <url><loc>${xmlEscape(absoluteUrl(config.site.baseUrl!, url))}</loc>${alternateLinks}</url>`,
              )
            })
            .join('\n')
          this.emitFile({
            type: 'asset',
            fileName: 'sitemap.xml',
            source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`,
          })
        }
      }
    },
    async writeBundle(outputOptions) {
      if (!config.prerender) return
      const outDir = path.resolve(
        viteConfig.root,
        outputOptions.dir ?? viteConfig.build.outDir,
      )
      const template = await fs.readFile(
        path.join(outDir, 'index.html'),
        'utf8',
      )
      const pages = await discover(true)
      const { navigations } = await discoverNavigationData(pages)
      const routes: PrerenderRoute[] = pages.map(page => ({
        url: page.metadata.url,
        locale: page.metadata.locale ?? config.i18n.defaultLocale,
        page,
      }))
      if (config.basePath !== '') {
        for (const { locale } of config.i18n.locales) {
          const url = localeHomePath(config.i18n, locale)
          if (!pages.some(page => page.metadata.url === url))
            routes.push({ url, locale })
        }
      }
      if (config.i18n.enabled) {
        routes.push({
          url: '/',
          canonicalUrl: localeHomePath(config.i18n, config.i18n.defaultLocale),
          locale: config.i18n.defaultLocale,
        })
      }
      const uniqueRoutes = new Map(routes.map(route => [route.url, route]))
      await Promise.all(
        [...uniqueRoutes.values()].map(async route => {
          const outputFile = path.join(outDir, routeHtmlFile(route.url))
          await fs.mkdir(path.dirname(outputFile), { recursive: true })
          await fs.writeFile(
            outputFile,
            prerenderRouteHtml(
              template,
              config,
              pages,
              navigations,
              route,
              options.components,
              options.islands,
            ),
          )
        }),
      )
      this.info(`Foldocs prerendered ${String(uniqueRoutes.size)} HTML routes.`)
    },
  }
}
