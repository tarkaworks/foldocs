import { type HtmlBuilder, inertHtml } from 'foldkit/html'
import {
  type NavigationNode,
  type PageManifest,
  type ResolvedFoldocsConfig,
  adjacentPages,
  buildSeoJsonLd,
  formatSeoTitle,
  localeDefinition,
  localeHomePath,
  localizedPathname,
  navigationFolderKeysForUrl,
  navigationForUrl,
  navigationTabsForUrl,
  openGraphLocale,
  robotsContent,
  serializeJsonLd,
} from 'foldocs-core'
import type { CompiledPage } from 'foldocs-mdx'
import {
  type LocaleLink,
  type MarkdownIslands,
  type MdxComponents,
  docsLayout,
  landingLayout,
} from 'foldocs-ui'

import type { PageMetadata } from '@foldocs/content'

export interface PrerenderPage {
  readonly metadata: PageMetadata
  readonly compiled: CompiledPage
}

export interface PrerenderRoute {
  /** Output URL. Root aliases may differ from the canonical content URL. */
  readonly url: string
  readonly canonicalUrl?: string
  readonly locale: string
  readonly page?: PrerenderPage
}

interface StaticVNode {
  readonly sel?: string
  readonly data?: Readonly<{
    attrs?: Readonly<Record<string, unknown>>
    props?: Readonly<Record<string, unknown>>
    class?: Readonly<Record<string, boolean>>
    dataset?: Readonly<Record<string, unknown>>
    style?: Readonly<Record<string, unknown>>
  }>
  readonly children?: ReadonlyArray<StaticVNode | string>
  readonly text?: string
}

const escapeText = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const escapeAttribute = (value: string): string =>
  escapeText(value).replaceAll('"', '&quot;')

const voidElements = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

const propertyName = (name: string): string => {
  if (name === 'className') return 'class'
  if (name === 'htmlFor') return 'for'
  if (name === 'tabIndex') return 'tabindex'
  if (name === 'readOnly') return 'readonly'
  return name
}

const primitiveAttribute = (
  target: Map<string, string | true>,
  name: string,
  value: unknown,
): void => {
  if (value === true) target.set(name, true)
  else if (typeof value === 'string' || typeof value === 'number')
    target.set(name, String(value))
}

const serializeNode = (
  value: StaticVNode | string | null,
  root = false,
): string => {
  if (value === null) return ''
  if (typeof value === 'string') return escapeText(value)
  if (value.sel === undefined) return escapeText(value.text ?? '')
  if (value.sel === '!') return ''

  const attributes = new Map<string, string | true>()
  const data = value.data
  const classes = Object.entries(data?.class ?? {})
    .filter(([, enabled]) => enabled)
    .map(([name]) => name)
  if (classes.length > 0) attributes.set('class', classes.join(' '))
  for (const [name, attribute] of Object.entries(data?.attrs ?? {}))
    primitiveAttribute(attributes, name, attribute)
  for (const [name, attribute] of Object.entries(data?.dataset ?? {}))
    primitiveAttribute(attributes, `data-${name}`, attribute)

  const props = data?.props ?? {}
  for (const [name, property] of Object.entries(props)) {
    if (name === 'innerHTML' || name === 'textContent') continue
    primitiveAttribute(attributes, propertyName(name), property)
  }
  const style = Object.entries(data?.style ?? {})
    .filter(
      (entry): entry is [string, string | number] =>
        typeof entry[1] === 'string' || typeof entry[1] === 'number',
    )
    .map(([name, styleValue]) => `${name}:${String(styleValue)}`)
    .join(';')
  if (style.length > 0) attributes.set('style', style)
  if (root) attributes.set('id', 'root')

  const serializedAttributes = [...attributes]
    .map(([name, attribute]) =>
      attribute === true
        ? ` ${name}`
        : ` ${name}="${escapeAttribute(attribute)}"`,
    )
    .join('')
  const tag = value.sel
  if (voidElements.has(tag)) return `<${tag}${serializedAttributes}>`

  const rawHtml = props.innerHTML
  const textContent = props.textContent
  const content =
    typeof rawHtml === 'string'
      ? rawHtml
      : typeof textContent === 'string'
        ? escapeText(textContent)
        : value.children !== undefined
          ? value.children.map(child => serializeNode(child)).join('')
          : escapeText(value.text ?? '')
  return `<${tag}${serializedAttributes}>${content}</${tag}>`
}

/** Serializes Foldkit's VNode output for production route HTML. */
export const serializeHtml = (value: unknown): string =>
  serializeNode(value as StaticVNode | null, true)

const absoluteUrl = (baseUrl: string, pathname: string): string =>
  new URL(
    pathname.replace(/^\//u, ''),
    `${baseUrl.replace(/\/+$/u, '')}/`,
  ).toString()

const docsUrlFor = (
  config: ResolvedFoldocsConfig,
  pages: ReadonlyArray<PrerenderPage>,
  locale: string,
): string =>
  pages.find(
    ({ metadata }) => metadata.locale === locale && metadata.slug === '',
  )?.metadata.url ??
  pages.find(({ metadata }) => metadata.locale === locale)?.metadata.url ??
  localizedPathname(config.i18n, locale, config.basePath)

const localeLinksFor = (
  config: ResolvedFoldocsConfig,
  pages: ReadonlyArray<PrerenderPage>,
  route: PrerenderRoute,
): ReadonlyArray<LocaleLink> => {
  const translationKey =
    route.page?.metadata.translationKey ?? route.page?.metadata.slug
  return config.i18n.locales.map(definition => {
    const translated =
      translationKey === undefined
        ? undefined
        : pages.find(
            ({ metadata }) =>
              metadata.locale === definition.locale &&
              (metadata.translationKey ?? metadata.slug) === translationKey,
          )?.metadata.url
    return {
      locale: definition.locale,
      name: definition.name,
      dir: definition.dir,
      href:
        translated ??
        (route.page === undefined
          ? localeHomePath(config.i18n, definition.locale)
          : localizedPathname(
              config.i18n,
              definition.locale,
              route.page.metadata.url,
            )),
      current: definition.locale === route.locale,
    }
  })
}

const collapsedNavigationGroups = (
  nodes: ReadonlyArray<NavigationNode>,
  expandedGroups: ReadonlySet<string> = new Set(),
  parentKey = '',
): ReadonlyArray<string> =>
  nodes.flatMap(node => {
    if (node._tag !== 'Folder') return []
    const key = `${parentKey}/${node.segment}`
    return [
      ...(node.defaultOpen || expandedGroups.has(key) ? [] : [key]),
      ...collapsedNavigationGroups(node.children, expandedGroups, key),
    ]
  })

// This is a serialization-only sentinel, not an application Message.
// oxlint-disable-next-line foldkit/prefer-callable-message-constructor
const staticMessage = { _tag: 'FoldocsPrerender' } as const
// Prerendering deliberately discards event data during serialization. The
// inert builder is therefore the correct detached builder at this boundary.
const staticHtml = inertHtml as unknown as HtmlBuilder<typeof staticMessage>

const renderRouteBody = (
  config: ResolvedFoldocsConfig,
  pages: ReadonlyArray<PrerenderPage>,
  navigations: Readonly<Record<string, ReadonlyArray<NavigationNode>>>,
  route: PrerenderRoute,
  components?: MdxComponents,
  islands?: MarkdownIslands,
): string => {
  const definition = localeDefinition(config.i18n, route.locale)
  const locales = localeLinksFor(config, pages, route)
  const docsUrl = docsUrlFor(config, pages, route.locale)
  const search = {
    searchOpen: false,
    searchQuery: '',
    searchResults: [],
    searchLoading: false,
    searchError: '',
    activeSearchResultIndex: -1,
    availableSearchTags: [],
    selectedSearchTags: [],
    translations: definition.ui,
    actions: {
      toggleSearch: staticMessage,
      closeSearch: staticMessage,
      updateSearch: () => staticMessage,
      searchKeyDown: () => staticMessage,
      selectSearchResult: () => staticMessage,
      toggleSearchTag: () => staticMessage,
    },
  } as const

  if (route.page === undefined) {
    return serializeHtml(
      landingLayout(
        {
          site: config.site,
          landing: config.landing,
          ...(config.banner === undefined ? {} : { banner: config.banner }),
          bannerDismissed: false,
          docsUrl,
          homeUrl: localeHomePath(config.i18n, route.locale),
          locales,
          currentLocale: route.locale,
          theme: 'light',
          themePreference: 'system',
          copiedText: '',
          ...search,
          actions: {
            ...search.actions,
            selectTheme: () => staticMessage,
            copyText: () => staticMessage,
            openExternal: () => staticMessage,
            dismissBanner: staticMessage,
          },
        },
        staticHtml,
      ),
    )
  }

  const manifest: PageManifest<CompiledPage> = pages.map(page => ({
    ...page.metadata,
    load: async () => ({ default: page.compiled }),
  }))
  const completeNavigation = navigations[route.locale] ?? []
  const navigation = navigationForUrl(
    completeNavigation,
    route.page.metadata.url,
  )
  const adjacent = adjacentPages(manifest, route.page.metadata.url, navigation)
  const markdownUrl =
    route.page.metadata.url === '/'
      ? '/index.md'
      : `${route.page.metadata.url.replace(/\/+$/u, '')}.md`
  return serializeHtml(
    docsLayout(
      {
        site: config.site,
        preset: config.layout.preset,
        navigation,
        tabs: navigationTabsForUrl(completeNavigation, route.page.metadata.url),
        currentUrl: route.page.metadata.url,
        page: route.page.compiled,
        ...(route.page.metadata.lastModified === undefined
          ? {}
          : { lastModified: route.page.metadata.lastModified }),
        ...(adjacent.previous === undefined
          ? {}
          : { previous: adjacent.previous }),
        ...(adjacent.next === undefined ? {} : { next: adjacent.next }),
        sidebarOpen: false,
        collapsedSidebarGroups: collapsedNavigationGroups(
          navigation,
          new Set(
            navigationFolderKeysForUrl(navigation, route.page.metadata.url),
          ),
        ),
        activeTocId: '',
        mobileTocOpen: false,
        narrowViewport: false,
        theme: 'light',
        themePreference: 'system',
        docsUrl,
        homeUrl: localeHomePath(config.i18n, route.locale),
        locales,
        currentLocale: route.locale,
        markdownUrl,
        markdownEnabled: config.markdown,
        ...(config.landing.footer === undefined
          ? {}
          : { footer: config.landing.footer }),
        ...(config.banner === undefined ? {} : { banner: config.banner }),
        bannerDismissed: false,
        ...(config.feedback === undefined ? {} : { feedback: config.feedback }),
        feedbackStatus: 'idle',
        copyMarkdownStatus: 'idle',
        ...search,
        actions: {
          ...search.actions,
          toggleSidebar: staticMessage,
          closeSidebar: staticMessage,
          toggleSidebarGroup: () => staticMessage,
          setMobileTocOpen: () => staticMessage,
          selectToc: () => staticMessage,
          selectTheme: () => staticMessage,
          copyMarkdown: staticMessage,
          dismissBanner: staticMessage,
          openImage: () => staticMessage,
          closeImage: staticMessage,
          submitFeedback: () => staticMessage,
        },
        markdown: {
          ...(islands === undefined ? {} : { islands }),
          ...(components === undefined ? {} : { components }),
          copyCode: () => staticMessage,
          toc: route.page.compiled.toc,
          selectToc: () => staticMessage,
          copyLabel: definition.ui.copy,
          copiedLabel: definition.ui.copied,
          copyAriaLabel: definition.ui.copyCode,
          copiedAriaLabel: definition.ui.codeCopied,
        },
      },
      staticHtml,
    ),
  )
}

const stripRouteMetadata = (html: string): string =>
  html
    .replace(/<title>[^<]*<\/title>\s*/giu, '')
    .replace(
      /<meta\b(?=[^>]*(?:name|property)=["'](?:description|keywords|author|generator|robots|googlebot|og:title|og:description|og:type|og:url|og:site_name|og:locale|og:locale:alternate|og:image|og:image:alt|og:image:width|og:image:height|og:image:type|article:modified_time|article:tag|twitter:title|twitter:description|twitter:image|twitter:image:alt|twitter:card|twitter:site|twitter:creator)["'])[^>]*>\s*/giu,
      '',
    )
    .replace(
      /<link\b(?=[^>]*rel=["'](?:canonical|alternate)["'])[^>]*>\s*/giu,
      '',
    )
    .replace(
      /<script\b(?=[^>]*(?:id=["']foldocs-json-ld["']|data-foldocs-json-ld))[\s\S]*?<\/script>\s*/giu,
      '',
    )

const replaceRoot = (html: string, body: string): string => {
  const pattern = /<div\s+id=["']root["'][^>]*>\s*<\/div>/iu
  if (!pattern.test(html))
    throw new Error(
      'Foldocs prerendering requires an empty <div id="root"></div> in index.html.',
    )
  return html.replace(pattern, body)
}

/** Injects route metadata and a fully rendered Foldkit document into Vite HTML. */
export const prerenderRouteHtml = (
  template: string,
  config: ResolvedFoldocsConfig,
  pages: ReadonlyArray<PrerenderPage>,
  navigations: Readonly<Record<string, ReadonlyArray<NavigationNode>>>,
  route: PrerenderRoute,
  components?: MdxComponents,
  islands?: MarkdownIslands,
): string => {
  const definition = localeDefinition(config.i18n, route.locale)
  const contentPath =
    route.canonicalUrl ?? route.page?.metadata.url ?? route.url
  const routeTitle =
    route.page === undefined
      ? config.site.title
      : route.page.metadata.frontmatter.title
  const title = formatSeoTitle(
    routeTitle,
    config.site.title,
    config.seo.titleTemplate,
  )
  const description =
    route.page?.metadata.frontmatter.description ?? config.site.description
  const keywords =
    route.page?.metadata.frontmatter.keywords ?? config.site.keywords
  const canonical =
    config.site.baseUrl === undefined
      ? undefined
      : absoluteUrl(config.site.baseUrl, contentPath)
  const configuredImage =
    route.page?.metadata.frontmatter.socialImage ??
    config.site.socialImage ??
    (config.og.enabled
      ? `/${[
          config.og.directory,
          ...(config.i18n.enabled ? [route.locale] : []),
          'home.png',
        ].join('/')}`
      : undefined)
  const image =
    configuredImage === undefined || config.site.baseUrl === undefined
      ? configuredImage
      : absoluteUrl(config.site.baseUrl, configuredImage)
  const localeLinks = localeLinksFor(config, pages, route)
  const imageAlt =
    route.page === undefined
      ? `${config.site.title} social preview`
      : `${routeTitle} — ${config.site.title}`
  const generatedImage =
    configuredImage !== undefined &&
    config.og.enabled &&
    configuredImage.replace(/^\/+/, '').startsWith(`${config.og.directory}/`)
  const routeLocale = openGraphLocale(route.locale)
  const alternateOgLocales = localeLinks
    .filter(link => link.locale !== route.locale)
    .map(link => openGraphLocale(link.locale))
  const pageAncestors =
    route.page === undefined
      ? []
      : pages
          .filter(
            page =>
              page.metadata.locale === route.locale &&
              page.metadata.url !== route.page?.metadata.url &&
              route.page?.metadata.url.startsWith(`${page.metadata.url}/`),
          )
          .sort(
            (left, right) =>
              left.metadata.url.length - right.metadata.url.length,
          )
  const breadcrumbs =
    route.page === undefined
      ? undefined
      : [
          {
            name: config.site.title,
            url: localeHomePath(config.i18n, route.locale),
          },
          ...pageAncestors.map(page => ({
            name: page.metadata.frontmatter.title,
            url: page.metadata.url,
          })),
          {
            name: route.page.metadata.frontmatter.title,
            url: route.page.metadata.url,
          },
        ]
  const jsonLd = buildSeoJsonLd({
    kind: route.page === undefined ? 'landing' : 'page',
    site: config.site,
    seo: config.seo,
    title: routeTitle,
    ...(description === undefined ? {} : { description }),
    ...(canonical === undefined ? {} : { url: canonical }),
    ...(image === undefined ? {} : { image }),
    locale: route.locale,
    locales: config.i18n.locales.map(locale => locale.locale),
    ...(route.page?.metadata.lastModified === undefined
      ? {}
      : { lastModified: route.page.metadata.lastModified }),
    ...((keywords === undefined || keywords.length === 0) &&
    (route.page?.metadata.frontmatter.tags === undefined ||
      route.page.metadata.frontmatter.tags.length === 0)
      ? {}
      : {
          keywords: [
            ...(keywords ?? []),
            ...(route.page?.metadata.frontmatter.tags ?? []),
          ],
        }),
    ...(breadcrumbs === undefined ? {} : { breadcrumbs }),
  })
  const robotDirectives = robotsContent(config.seo)
  const metadata = [
    `<title>${escapeText(title)}</title>`,
    ...(description === undefined
      ? []
      : [
          `<meta name="description" content="${escapeAttribute(description)}">`,
          `<meta property="og:description" content="${escapeAttribute(description)}">`,
          `<meta name="twitter:description" content="${escapeAttribute(description)}">`,
        ]),
    ...(keywords === undefined || keywords.length === 0
      ? []
      : [
          `<meta name="keywords" content="${escapeAttribute(keywords.join(', '))}">`,
        ]),
    `<meta name="generator" content="Foldocs">`,
    `<meta name="author" content="${escapeAttribute(config.seo.author.name)}">`,
    `<meta name="robots" content="${escapeAttribute(robotDirectives)}">`,
    `<meta name="googlebot" content="${escapeAttribute(robotDirectives)}">`,
    `<meta property="og:title" content="${escapeAttribute(title)}">`,
    `<meta property="og:type" content="${route.page === undefined ? 'website' : 'article'}">`,
    `<meta property="og:site_name" content="${escapeAttribute(config.site.title)}">`,
    `<meta property="og:locale" content="${escapeAttribute(routeLocale)}">`,
    ...alternateOgLocales.map(
      locale =>
        `<meta property="og:locale:alternate" content="${escapeAttribute(locale)}">`,
    ),
    `<meta name="twitter:title" content="${escapeAttribute(title)}">`,
    `<meta name="twitter:card" content="${image === undefined ? 'summary' : 'summary_large_image'}">`,
    ...(config.seo.twitterSite === undefined
      ? []
      : [
          `<meta name="twitter:site" content="${escapeAttribute(config.seo.twitterSite)}">`,
        ]),
    ...(config.seo.twitterCreator === undefined
      ? []
      : [
          `<meta name="twitter:creator" content="${escapeAttribute(config.seo.twitterCreator)}">`,
        ]),
    ...(image === undefined
      ? []
      : [
          `<meta property="og:image" content="${escapeAttribute(image)}">`,
          `<meta property="og:image:alt" content="${escapeAttribute(imageAlt)}">`,
          ...(generatedImage
            ? [
                `<meta property="og:image:width" content="${String(config.og.width)}">`,
                `<meta property="og:image:height" content="${String(config.og.height)}">`,
                `<meta property="og:image:type" content="image/png">`,
              ]
            : []),
          `<meta name="twitter:image" content="${escapeAttribute(image)}">`,
          `<meta name="twitter:image:alt" content="${escapeAttribute(imageAlt)}">`,
        ]),
    ...(route.page?.metadata.lastModified === undefined
      ? []
      : [
          `<meta property="article:modified_time" content="${escapeAttribute(route.page.metadata.lastModified)}">`,
        ]),
    ...(route.page?.metadata.frontmatter.tags ?? []).map(
      tag => `<meta property="article:tag" content="${escapeAttribute(tag)}">`,
    ),
    ...(canonical === undefined
      ? []
      : [
          `<link rel="canonical" href="${escapeAttribute(canonical)}">`,
          `<meta property="og:url" content="${escapeAttribute(canonical)}">`,
          ...localeLinks.map(
            link =>
              `<link rel="alternate" hreflang="${escapeAttribute(link.locale)}" href="${escapeAttribute(absoluteUrl(config.site.baseUrl!, link.href))}" data-foldocs-i18n="true">`,
          ),
          `<link rel="alternate" hreflang="x-default" href="${escapeAttribute(absoluteUrl(config.site.baseUrl!, localeLinks.find(link => link.locale === config.i18n.defaultLocale)?.href ?? contentPath))}" data-foldocs-i18n="true">`,
        ]),
    ...(config.rss.enabled && config.site.baseUrl !== undefined
      ? [
          `<link rel="alternate" type="application/rss+xml" title="${escapeAttribute(config.rss.title)}" href="${escapeAttribute(absoluteUrl(config.site.baseUrl, `/${config.i18n.enabled && route.locale !== config.i18n.defaultLocale ? `${route.locale}/` : ''}${config.rss.path}`))}">`,
        ]
      : []),
    ...(jsonLd === undefined
      ? []
      : [
          `<script id="foldocs-json-ld" type="application/ld+json" data-foldocs-json-ld>${serializeJsonLd(jsonLd)}</script>`,
        ]),
  ].join('\n    ')
  const localized = stripRouteMetadata(template).replace(
    /<html(?:\s+lang="[^"]*")?(?:\s+dir="[^"]*")?\s*>/iu,
    `<html lang="${escapeAttribute(definition.locale)}" dir="${definition.dir}">`,
  )
  const withHead = localized.replace('</head>', `    ${metadata}\n  </head>`)
  return replaceRoot(
    withHead,
    renderRouteBody(config, pages, navigations, route, components, islands),
  )
}

export const routeHtmlFile = (url: string): string => {
  const route = url.replace(/^\/+|\/+$/gu, '')
  return route.length === 0 ? 'index.html' : `${route}/index.html`
}
