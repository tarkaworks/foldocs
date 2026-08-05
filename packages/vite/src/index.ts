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
  navigationContextForUrl,
  openGraphLocale,
  resolveConfig,
  robotsContent,
} from 'foldocs-core'
import {
  type CodeHighlighter,
  type CompileOptions,
  type CompiledPage,
  type DocumentPlugin,
  type MarkdownPluginOptions,
  type ProcessorPlugins,
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
import { generateTypeTable, transpileTypeScript } from '@foldocs/typescript'

import {
  isMarkdownPreferred,
  makeLandingMarkdown,
  makePageMarkdown,
  markdownAssetPath,
  pageUrlFromMarkdownPath,
} from './markdown.js'
import { renderOgImage } from './og.js'
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
export { defaultOgImageTemplate, renderOgImage } from './og.js'
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
  /** Unified Remark plugins composed with the default Foldocs preset. */
  readonly remarkPlugins?: ProcessorPlugins
  /** Typed transforms applied after parsing and before manifest generation. */
  readonly documentPlugins?: ReadonlyArray<DocumentPlugin>
  /** Reusable Markdown/MDX and code-file include behavior. */
  readonly include?: CompileOptions['include']
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
        value.collapsible !== undefined &&
        typeof value.collapsible !== 'boolean'
      )
        throw new TypeError(`${metaPath} collapsible must be a boolean.`)
      if (
        value.pages !== undefined &&
        (!Array.isArray(value.pages) ||
          !value.pages.every(entry => typeof entry === 'string'))
      )
        throw new TypeError(`${metaPath} pages must be an array of strings.`)
      if (value.root !== undefined && typeof value.root !== 'boolean')
        throw new TypeError(`${metaPath} root must be a boolean.`)
      if (
        value.pagesIndex !== undefined &&
        typeof value.pagesIndex !== 'string'
      )
        throw new TypeError(`${metaPath} pagesIndex must be a string.`)
      const meta: NavigationMeta = {
        ...(typeof value.title === 'string' ? { title: value.title } : {}),
        ...(typeof value.description === 'string'
          ? { description: value.description }
          : {}),
        ...(typeof value.icon === 'string' ? { icon: value.icon } : {}),
        ...(typeof value.defaultOpen === 'boolean'
          ? { defaultOpen: value.defaultOpen }
          : {}),
        ...(typeof value.collapsible === 'boolean'
          ? { collapsible: value.collapsible }
          : {}),
        ...(typeof value.root === 'boolean' ? { root: value.root } : {}),
        ...(typeof value.pagesIndex === 'string'
          ? { pagesIndex: value.pagesIndex }
          : {}),
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

const searchDocumentsFromPages = (
  pages: ReadonlyArray<DiscoveredPage>,
  navigations: Readonly<Record<string, ReadonlyArray<NavigationNode>>> = {},
) =>
  pages.flatMap(({ metadata, compiled }) => {
    const navigation = navigations[metadata.locale ?? ''] ?? []
    const context = navigationContextForUrl(navigation, metadata.url) ?? []
    const structuredData = compiled.structuredData ?? []
    const sections =
      structuredData.length === 0
        ? [
            {
              id: '',
              title: metadata.frontmatter.title,
              content: metadata.plainText,
            },
          ]
        : structuredData
    return sections.map(section => {
      const isPage = section.id.length === 0
      return {
        id: isPage ? metadata.id : `${metadata.id}#${section.id}`,
        url: isPage ? metadata.url : `${metadata.url}#${section.id}`,
        title: section.title,
        type: isPage ? ('page' as const) : ('section' as const),
        pageId: metadata.id,
        pageTitle: metadata.frontmatter.title,
        ...(isPage ? {} : { sectionId: section.id }),
        breadcrumbs: isPage
          ? [...context]
          : [...context, metadata.frontmatter.title],
        ...(metadata.frontmatter.description === undefined || !isPage
          ? {}
          : { description: metadata.frontmatter.description }),
        content: section.content,
        locale: metadata.locale,
        ...(metadata.frontmatter.tags === undefined
          ? {}
          : { tags: metadata.frontmatter.tags }),
      }
    })
  })

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
  structuredData: [],
  references: metadata.references ?? [],
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
            ...(node.index === undefined || node.index._tag === 'Link'
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

const headTags = (
  config: ResolvedFoldocsConfig,
): ReadonlyArray<HtmlTagDescriptor> => {
  const { site } = config
  const image = socialImageUrl(config)
  const imageAlt = `${site.title} social preview`
  const robotDirectives = robotsContent(config.seo)
  const fontStyles = [
    config.fonts.sans.length > 0
      ? `--fd-font-sans: ${config.fonts.sans.join(', ')};`
      : '',
    config.fonts.mono.length > 0
      ? `--fd-font-mono: ${config.fonts.mono.join(', ')};`
      : '',
  ]
    .filter(Boolean)
    .join(' ')
  const hasCustomFonts =
    fontStyles.length > 0 &&
    fontStyles !==
      '--fd-font-sans: Inter, sans-serif; --fd-font-mono: JetBrains Mono, monospace;'
  return [
    ...(hasCustomFonts
      ? [
          {
            tag: 'style' as const,
            children: `:root { ${fontStyles} }`,
            injectTo: 'head' as const,
          },
        ]
      : []),
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
      attrs: { name: 'generator', content: 'Foldocs' },
      injectTo: 'head' as const,
    },
    {
      tag: 'meta',
      attrs: { name: 'author', content: config.seo.author.name },
      injectTo: 'head' as const,
    },
    {
      tag: 'meta',
      attrs: { name: 'robots', content: robotDirectives },
      injectTo: 'head' as const,
    },
    {
      tag: 'meta',
      attrs: { name: 'googlebot', content: robotDirectives },
      injectTo: 'head' as const,
    },
    {
      tag: 'meta',
      attrs: { property: 'og:title', content: site.title },
      injectTo: 'head' as const,
    },
    {
      tag: 'meta',
      attrs: { property: 'og:site_name', content: site.title },
      injectTo: 'head' as const,
    },
    {
      tag: 'meta',
      attrs: {
        property: 'og:locale',
        content: openGraphLocale(config.i18n.defaultLocale),
      },
      injectTo: 'head' as const,
    },
    {
      tag: 'meta',
      attrs: { property: 'og:type', content: 'website' },
      injectTo: 'head' as const,
    },
    ...(config.seo.twitterSite === undefined
      ? []
      : [
          {
            tag: 'meta',
            attrs: { name: 'twitter:site', content: config.seo.twitterSite },
            injectTo: 'head' as const,
          },
        ]),
    ...(config.seo.twitterCreator === undefined
      ? []
      : [
          {
            tag: 'meta',
            attrs: {
              name: 'twitter:creator',
              content: config.seo.twitterCreator,
            },
            injectTo: 'head' as const,
          },
        ]),
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
            attrs: { property: 'og:image:alt', content: imageAlt },
            injectTo: 'head' as const,
          },
          ...(site.socialImage === undefined && config.og.enabled
            ? [
                {
                  tag: 'meta',
                  attrs: {
                    property: 'og:image:width',
                    content: String(config.og.width),
                  },
                  injectTo: 'head' as const,
                },
                {
                  tag: 'meta',
                  attrs: {
                    property: 'og:image:height',
                    content: String(config.og.height),
                  },
                  injectTo: 'head' as const,
                },
                {
                  tag: 'meta',
                  attrs: { property: 'og:image:type', content: 'image/png' },
                  injectTo: 'head' as const,
                },
              ]
            : []),
          {
            tag: 'meta',
            attrs: { name: 'twitter:image', content: image },
            injectTo: 'head' as const,
          },
          {
            tag: 'meta',
            attrs: { name: 'twitter:image:alt', content: imageAlt },
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
    ...(config.analytics.enabled && config.analytics.provider === 'plausible'
      ? [
          {
            tag: 'script',
            attrs: {
              defer: '',
              'data-domain': config.analytics.domain ?? '',
              src: 'https://plausible.io/js/script.js',
            },
            injectTo: 'head' as const,
          },
        ]
      : []),
    ...(config.analytics.enabled && config.analytics.provider === 'umami'
      ? [
          {
            tag: 'script',
            attrs: {
              defer: '',
              'data-website-id': config.analytics.domain ?? '',
              src: `${config.analytics.apiHost ?? 'https://umami.example.com'}/script.js`,
            },
            injectTo: 'head' as const,
          },
        ]
      : []),
    ...(config.analytics.enabled && config.analytics.provider === 'ga4'
      ? [
          {
            tag: 'script',
            attrs: {
              async: '',
              src: `https://www.googletagmanager.com/gtag/js?id=${config.analytics.measurementId ?? ''}`,
            },
            injectTo: 'head' as const,
          },
          {
            tag: 'script',
            children: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${config.analytics.measurementId ?? ''}');`,
            injectTo: 'head' as const,
          },
        ]
      : []),
    {
      tag: 'script',
      children: `(function(){
        try {
          var tabs = JSON.parse(localStorage.getItem('fd-tabs') || '{}');
          var groups = document.querySelectorAll('[data-tab-group]');
          groups.forEach(function(group) {
            var groupId = group.getAttribute('data-tab-group');
            if (groupId && tabs[groupId]) {
              var buttons = group.querySelectorAll('[data-tab-value]');
              buttons.forEach(function(btn) {
                if (btn.getAttribute('data-tab-value') === tabs[groupId]) {
                  btn.click();
                }
              });
            }
          });
          var observer = new MutationObserver(function() {
            var groups = document.querySelectorAll('[data-tab-group]');
            groups.forEach(function(group) {
              var groupId = group.getAttribute('data-tab-group');
              if (groupId) {
                var active = group.querySelector('[aria-selected="true"]');
                if (active) {
                  tabs[groupId] = active.getAttribute('data-tab-value');
                  localStorage.setItem('fd-tabs', JSON.stringify(tabs));
                }
              }
            });
          });
          document.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-tab-value]');
            if (btn) {
              var group = btn.closest('[data-tab-group]');
              if (group) {
                var groupId = group.getAttribute('data-tab-group');
                if (groupId) {
                  tabs[groupId] = btn.getAttribute('data-tab-value');
                  localStorage.setItem('fd-tabs', JSON.stringify(tabs));
                }
              }
            }
          });
        } catch(e) {}
      })();`,
      injectTo: 'body' as const,
    },
    {
      tag: 'script',
      children: `(function(){
        try {
          var tocLinks = document.querySelectorAll('.fd-toc a');
          if (tocLinks.length === 0) return;
          var headings = [];
          tocLinks.forEach(function(link) {
            var id = link.getAttribute('href');
            if (id && id.startsWith('#')) {
              var heading = document.getElementById(id.slice(1));
              if (heading) headings.push({ el: heading, link: link });
            }
          });
          if (headings.length === 0) return;
          var currentActive = null;
          var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
              if (entry.isIntersecting) {
                var item = headings.find(function(h) { return h.el === entry.target; });
                if (item) {
                  if (currentActive) currentActive.link.classList.remove('fd-toc-active');
                  item.link.classList.add('fd-toc-active');
                  currentActive = item;
                }
              }
            });
          }, { rootMargin: '-80px 0px -80% 0px', threshold: 0 });
          headings.forEach(function(item) { observer.observe(item.el); });
          window.addEventListener('beforeunload', function() { observer.disconnect(); });
        } catch(e) {}
      })();`,
      injectTo: 'body' as const,
    },
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
  const landingSocialImages = Object.fromEntries(
    config.i18n.locales.flatMap(({ locale }) => {
      const image =
        config.site.socialImage ??
        (config.og.enabled ? ogLandingPath(config, locale) : undefined)
      return image === undefined ? [] : [[locale, image]]
    }),
  )
  let viteConfig: ResolvedConfig
  let contentRoot = ''
  const compiledCache = new Map<string, Promise<CompiledPage>>()
  const lastModifiedCache = new Map<string, Promise<string | undefined>>()
  const remoteModuleCache = new Map<
    string,
    { readonly source: string; readonly filePath: string }
  >()

  const resolveAutoTypeTable: NonNullable<
    CompileOptions['resolveAutoTypeTable']
  > = async ({ source, name, tsconfig, filePath }) => {
    const baseDirectory =
      filePath === undefined || filePath.includes(':')
        ? viteConfig.root
        : path.dirname(filePath)
    return generateTypeTable(path.resolve(baseDirectory, source), name, {
      ...(tsconfig === undefined
        ? {}
        : { tsconfig: path.resolve(baseDirectory, tsconfig) }),
    })
  }
  const transformTypeScriptExample: NonNullable<
    CompileOptions['transformTypeScript']
  > = ({ value, language }) =>
    transpileTypeScript(value, { jsx: /tsx/iu.test(language) })

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
        ...(options.remarkPlugins === undefined
          ? {}
          : { remarkPlugins: options.remarkPlugins }),
        ...(options.documentPlugins === undefined
          ? {}
          : { documentPlugins: options.documentPlugins }),
        ...(options.include === undefined ? {} : { include: options.include }),
        resolveAutoTypeTable,
        transformTypeScript: transformTypeScriptExample,
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
                  ...(compiled.structuredData === undefined
                    ? {}
                    : { structuredData: compiled.structuredData }),
                  ...(compiled.references === undefined
                    ? {}
                    : { references: compiled.references }),
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
                ...(options.remarkPlugins === undefined
                  ? {}
                  : { remarkPlugins: options.remarkPlugins }),
                ...(options.documentPlugins === undefined
                  ? {}
                  : { documentPlugins: options.documentPlugins }),
                ...(options.include === undefined
                  ? {}
                  : { include: options.include }),
                resolveAutoTypeTable,
                transformTypeScript: transformTypeScriptExample,
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
                  ...(compiled.structuredData === undefined
                    ? {}
                    : { structuredData: compiled.structuredData }),
                  ...(compiled.references === undefined
                    ? {}
                    : { references: compiled.references }),
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
      const { navigations } = await discoverNavigationData(pages)
      const source = JSON.stringify(
        searchDocumentsFromPages(pages, navigations),
      )
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
          `export const seo = ${JSON.stringify(config.seo)};`,
          `export const og = ${JSON.stringify({ enabled: config.og.enabled, directory: config.og.directory, width: config.og.width, height: config.og.height })};`,
          `export const markdown = ${JSON.stringify(config.markdown)};`,
          `export const ai = ${JSON.stringify(config.ai)};`,
          `export const searchIndexUrls = ${JSON.stringify(searchIndexUrls)};`,
          `export const landingSocialImages = ${JSON.stringify(landingSocialImages)};`,
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
          ...(options.remarkPlugins === undefined
            ? {}
            : { remarkPlugins: options.remarkPlugins }),
          ...(options.documentPlugins === undefined
            ? {}
            : { documentPlugins: options.documentPlugins }),
          ...(options.include === undefined
            ? {}
            : { include: options.include }),
          resolveAutoTypeTable,
          transformTypeScript: transformTypeScriptExample,
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
      const { navigations } = await discoverNavigationData(pages)
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
          const isImage = /\.(png|jpe?g|gif|webp|avif)$/i.test(file)
          if (isImage && config.images.optimize) {
            const sharp = await import('sharp')
            const imageBuffer = await fs.readFile(file)
            const optimized = await sharp
              .default(imageBuffer)
              .resize({
                width: config.images.sizes[config.images.sizes.length - 1],
                withoutEnlargement: true,
              })
              .webp({ quality: 80 })
              .toBuffer()
            this.emitFile({
              type: 'asset',
              fileName: url.replace(/^\/+/, '').replace(/\.[^.]+$/, '.webp'),
              source: optimized,
            })
          } else {
            this.emitFile({
              type: 'asset',
              fileName: url.replace(/^\/+/, ''),
              source: await fs.readFile(file),
            })
          }
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
            source: JSON.stringify(
              searchDocumentsFromPages(localizedPages, navigations),
            ),
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
        const landingDescription =
          config.landing.description ?? config.site.description
        for (const { locale } of config.i18n.locales) {
          this.emitFile({
            type: 'asset',
            fileName: ogLandingPath(config, locale).replace(/^\/+/, ''),
            source: await renderOgImage(
              {
                kind: 'landing',
                site: config.site,
                title: config.site.logoText ?? config.site.title,
                ...(landingDescription === undefined
                  ? {}
                  : { description: landingDescription }),
                locale,
                slug: '',
                width: config.og.width,
                height: config.og.height,
                ...(config.og.logoSvg === undefined
                  ? {}
                  : { logoSvg: config.og.logoSvg }),
              },
              config.og.template,
            ),
          })
        }
        for (const { metadata } of pages) {
          const locale = metadata.locale ?? config.i18n.defaultLocale
          const generatedPath = ogImagePath(config, locale, metadata.slug)
          if (metadata.frontmatter.socialImage !== generatedPath) continue
          this.emitFile({
            type: 'asset',
            fileName: generatedPath.replace(/^\/+/, ''),
            source: await renderOgImage(
              {
                kind: 'page',
                site: config.site,
                title: metadata.frontmatter.title,
                ...(metadata.frontmatter.description === undefined
                  ? {}
                  : { description: metadata.frontmatter.description }),
                locale,
                slug: metadata.slug,
                width: config.og.width,
                height: config.og.height,
                ...(config.og.logoSvg === undefined
                  ? {}
                  : { logoSvg: config.og.logoSvg }),
              },
              config.og.template,
            ),
          })
        }
      }
      if (config.sitemap) {
        if (config.site.baseUrl === undefined) {
          this.warn(
            'Foldocs skipped sitemap.xml because site.baseUrl is not configured.',
          )
        } else {
          const routeGroups = new Map<
            string,
            Map<
              string,
              { readonly url: string; readonly lastModified?: string }
            >
          >()
          const addRoute = (
            key: string,
            locale: string,
            url: string,
            lastModified?: string,
          ): void => {
            const routes =
              routeGroups.get(key) ??
              new Map<
                string,
                { readonly url: string; readonly lastModified?: string }
              >()
            routes.set(locale, {
              url,
              ...(lastModified === undefined ? {} : { lastModified }),
            })
            routeGroups.set(key, routes)
          }
          for (const { locale } of config.i18n.locales)
            addRoute('__home__', locale, localeHomePath(config.i18n, locale))
          for (const { metadata } of pages)
            addRoute(
              metadata.translationKey ?? metadata.slug,
              metadata.locale ?? config.i18n.defaultLocale,
              metadata.url,
              metadata.lastModified,
            )
          const urls = [...routeGroups.values()]
            .flatMap(routes => {
              const alternateLinks = config.i18n.enabled
                ? [
                    ...config.i18n.locales.flatMap(({ locale }) => {
                      const route = routes.get(locale)
                      return route === undefined
                        ? []
                        : [
                            `<xhtml:link rel="alternate" hreflang="${xmlEscape(locale)}" href="${xmlEscape(absoluteUrl(config.site.baseUrl!, route.url))}"/>`,
                          ]
                    }),
                    ...(routes.get(config.i18n.defaultLocale) === undefined
                      ? []
                      : [
                          `<xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(absoluteUrl(config.site.baseUrl!, routes.get(config.i18n.defaultLocale)!.url))}"/>`,
                        ]),
                  ].join('')
                : ''
              return [...routes.values()].map(
                route =>
                  `  <url><loc>${xmlEscape(absoluteUrl(config.site.baseUrl!, route.url))}</loc>${route.lastModified === undefined ? '' : `<lastmod>${xmlEscape(route.lastModified)}</lastmod>`}${alternateLinks}</url>`,
              )
            })
            .join('\n')
          this.emitFile({
            type: 'asset',
            fileName: 'sitemap.xml',
            source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`,
          })
          this.emitFile({
            type: 'asset',
            fileName: 'robots.txt',
            source: `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl(config.site.baseUrl, '/sitemap.xml')}\n`,
          })
        }
      }
      if (config.headers) {
        this.emitFile({
          type: 'asset',
          fileName: '_headers',
          source: [
            '/*',
            '  X-Frame-Options: DENY',
            '  X-Content-Type-Options: nosniff',
            '  Referrer-Policy: strict-origin-when-cross-origin',
            '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
            '',
            '/assets/*',
            '  Cache-Control: public, max-age=31536000, immutable',
            '',
            '*.html',
            '  Cache-Control: public, max-age=0, must-revalidate',
            '',
            '/*.txt',
            '  Content-Type: text/plain; charset=utf-8',
            '  Cache-Control: public, max-age=3600',
            '',
            '/*.xml',
            '  Content-Type: application/xml; charset=utf-8',
            '  Cache-Control: public, max-age=3600',
            '',
            '/llms-full.txt',
            '  Cache-Control: public, max-age=3600',
            '  X-Robots-Tag: index',
          ].join('\n'),
        })
      }
      if (config.redirects) {
        const lines: string[] = []
        if (config.i18n.enabled) {
          for (const { locale } of config.i18n.locales) {
            if (locale === config.i18n.defaultLocale) continue
            lines.push(`/${locale}/*  /${locale}/:splat  301`)
          }
          lines.push(`/*  /${config.i18n.defaultLocale}/:splat  301`)
        }
        if (lines.length > 0) {
          this.emitFile({
            type: 'asset',
            fileName: '_redirects',
            source: lines.join('\n'),
          })
        }
      }
      if (config.agentManifest) {
        const baseUrl = config.site.baseUrl ?? ''
        const manifest = {
          name: config.site.title,
          description: config.site.description,
          url: baseUrl,
          api: config.ai?.enabled === true ? config.ai.endpoint : undefined,
          docs: pages.map(page => ({
            title: page.metadata.frontmatter.title,
            description: page.metadata.frontmatter.description,
            url: joinUrl(baseUrl, page.metadata.url),
            lastModified: page.metadata.lastModified,
          })),
          navigation: pages.map(page => ({
            title: page.metadata.frontmatter.title,
            url: joinUrl(baseUrl, page.metadata.url),
          })),
          tools: [
            ...(config.ai?.enabled === true
              ? [
                  {
                    name: 'ask_ai',
                    description: 'Ask an AI assistant about the documentation',
                    endpoint: config.ai.endpoint,
                  },
                ]
              : []),
          ],
        }
        this.emitFile({
          type: 'asset',
          fileName: 'agent-readability.json',
          source: JSON.stringify(manifest, null, 2),
        })
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
