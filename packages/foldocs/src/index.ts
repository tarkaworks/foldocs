import { Effect, Option, Queue, Schema as S, Stream } from 'effect'
import { Command, Render, type Runtime, Subscription } from 'foldkit'
import * as Dom from 'foldkit/dom'
import { type Document, type HtmlBuilder } from 'foldkit/html'
import { m } from 'foldkit/message'
import { UrlRequest, load, pushUrl } from 'foldkit/navigation'
import { Url, toString as urlToString } from 'foldkit/url'
import {
  type BannerConfig,
  type FeedbackConfig,
  type LayoutPreset,
  type NavigationNode,
  type PageManifest,
  type ResolvedI18nConfig,
  type ResolvedLandingConfig,
  type ResolvedOgImageConfig,
  type ResolvedSeoConfig,
  type SiteConfig,
  adjacentPages,
  buildNavigation,
  buildSeoJsonLd,
  defaultLandingSections,
  defaultUiTranslations,
  findPageByUrl,
  formatSeoTitle,
  localeDefinition,
  localeFromPathname,
  localeHomePath,
  localizedPathname,
  navigationFolderKeysForUrl,
  navigationForUrl,
  navigationTabsForUrl,
  openGraphLocale,
  resolveSeoConfig,
  robotsContent,
  serializeJsonLd,
  stripLocalePrefix,
} from 'foldocs-core'
import {
  CompiledPage,
  type CompiledPage as CompiledPageType,
  type PackageManager,
} from 'foldocs-mdx/ast'
import {
  DocsMenuMessage,
  DocsMenuModel,
  FoldocsDialogMessage,
  FoldocsDialogModel,
  LanguageMenuMessage,
  LanguageMenuModel,
  type MarkdownIslands,
  type MdxComponents,
  docsLayout,
  headerLanguageMenuId,
  initAiDialog,
  initDocsMenu,
  initLandingCopyTooltip,
  initLanguageMenu,
  initSearchDialog,
  initSidebarDialog,
  landingLayout,
  layoutTabsMenuId,
  pageOpenMenuId,
  sidebarLanguageMenuId,
} from 'foldocs-ui'

import { Dialog, Menu, Tooltip } from '@foldkit/ui'
import type { AiClient } from '@foldocs/ai'
import {
  type SearchClient,
  SearchDocument,
  SearchError,
  SearchResult,
} from '@foldocs/search'

export { createAiClient } from '@foldocs/ai'

const LanguageMenu = Menu.create<string>()
const LayoutTabsMenu = Menu.create<string>()
const PageOpenMenu = Menu.create<string>()

/** Options accepted by `createDocsProgram`, built from the resolved config and `virtual:foldocs`. */
export interface DocsProgramOptions {
  readonly manifest: PageManifest<CompiledPageType>
  readonly navigation?: ReadonlyArray<NavigationNode>
  readonly navigations?: Readonly<Record<string, ReadonlyArray<NavigationNode>>>
  readonly site: SiteConfig
  readonly seo?: ResolvedSeoConfig
  readonly og?: Pick<
    ResolvedOgImageConfig,
    'enabled' | 'directory' | 'width' | 'height'
  >
  readonly layoutPreset?: LayoutPreset
  readonly landing?: ResolvedLandingConfig
  readonly banner?: BannerConfig
  readonly feedback?: FeedbackConfig
  readonly i18n?: ResolvedI18nConfig
  readonly basePath?: string
  readonly search?: SearchClient
  /** Optional server-backed assistant. Provider credentials stay behind its endpoint. */
  readonly ai?: Readonly<{ readonly client: AiClient }>
  readonly markdown?: boolean
  /** Typed `.md` directive views produced by @foldkit/markdown `islandsFor`. */
  readonly islands?: MarkdownIslands
  /** Presentational Foldkit renderers for deterministic MDX component nodes. */
  readonly components?: MdxComponents
  /** Per-locale JSON indexes emitted by the Foldocs Vite plugin. */
  readonly searchIndexUrls?: Readonly<Record<string, string>>
  /** Per-locale landing social images emitted by the Foldocs Vite plugin. */
  readonly landingSocialImages?: Readonly<Record<string, string>>
  /**
   * Page module loaded before the Foldkit runtime starts. Production entry
   * points use this to adopt prerendered HTML without briefly rendering the
   * asynchronous loading state first.
   */
  readonly preloadedPage?: PreloadedDocsPage
}

export interface PreloadedDocsPage {
  readonly pathname: string
  readonly page: CompiledPageType
}

const hasLocalePrefix = (i18n: ResolvedI18nConfig, pathname: string): boolean =>
  !i18n.enabled ||
  i18n.hideLocale !== 'never' ||
  i18n.locales.some(
    entry =>
      pathname === `/${entry.locale}` ||
      pathname.startsWith(`/${entry.locale}/`),
  )

const initialPathname = (i18n: ResolvedI18nConfig, pathname: string): string =>
  hasLocalePrefix(i18n, pathname)
    ? pathname
    : localizedPathname(i18n, i18n.defaultLocale, pathname)

/**
 * Loads only the current route chunk before Foldkit takes ownership of the
 * prerendered root. The static document remains visible while the chunk is in
 * flight, and `init` can then produce the same page VNode on its first render.
 */
export const preloadDocsPage = async (
  manifest: PageManifest<CompiledPageType>,
  i18n: ResolvedI18nConfig,
  pathname: string,
): Promise<PreloadedDocsPage | undefined> => {
  const resolvedPathname = initialPathname(i18n, pathname)
  const entry = findPageByUrl(manifest, resolvedPathname)
  if (entry === undefined) return undefined
  try {
    const { default: page } = await entry.load()
    return { pathname: resolvedPathname, page }
  } catch {
    // The normal LoadPage command retains the existing error UI and retry path.
    return undefined
  }
}

const messageFromError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * Creates the complete Foldkit program used by generated Foldocs sites.
 * The returned schemas can be passed directly to `Runtime.makeApplication`.
 */
export const createDocsProgram = (options: DocsProgramOptions) => {
  const narrowViewportQuery = '(max-width: 48rem)'
  const manifest = options.manifest
  const legacyLocale = options.site.locale ?? 'en'
  const i18n: ResolvedI18nConfig = options.i18n ?? {
    enabled: false,
    defaultLocale: legacyLocale,
    fallbackLocale: legacyLocale,
    parser: 'dir',
    hideLocale: 'never',
    locales: [
      {
        locale: legacyLocale,
        name: legacyLocale,
        dir: 'ltr',
        ui: defaultUiTranslations,
      },
    ],
  }
  const basePath = options.basePath ?? '/docs'
  const seo = options.seo ?? resolveSeoConfig(undefined, options.site)
  const landing = options.landing ?? {
    sections: defaultLandingSections,
    command: 'pnpm create foldocs@latest',
  }
  const fallbackNavigation = options.navigation ?? buildNavigation(manifest)
  const navigations = options.navigations ?? {
    [i18n.defaultLocale]: fallbackNavigation,
  }
  const navigationFor = (locale: string): ReadonlyArray<NavigationNode> =>
    navigations[locale] ??
    navigations[i18n.fallbackLocale] ??
    fallbackNavigation
  const activeSidebarGroupKeys = (pathname: string): ReadonlyArray<string> =>
    navigationFolderKeysForUrl(
      navigationFor(localeFromPathname(i18n, pathname)),
      pathname,
    )
  const revealActiveSidebarGroups = (
    groups: ReadonlyArray<string>,
    pathname: string,
  ): ReadonlyArray<string> => {
    const active = new Set(activeSidebarGroupKeys(pathname))
    return groups.filter(key => !active.has(key))
  }
  const defaultCollapsedSidebarGroups = (() => {
    const groups: string[] = []
    const visit = (
      nodes: ReadonlyArray<NavigationNode>,
      parentKey = '',
    ): void => {
      for (const node of nodes) {
        if (node._tag !== 'Folder') continue
        if (node.root) {
          visit(node.children)
          continue
        }
        const key = `${parentKey}/${node.segment}`
        if (node.collapsible && !node.defaultOpen) groups.push(key)
        visit(node.children, key)
      }
    }
    for (const navigation of Object.values(navigations)) visit(navigation)
    return groups
  })()
  const docsUrlFor = (locale: string): string =>
    manifest.find(
      page =>
        (page.locale ?? i18n.defaultLocale) === locale && page.slug === '',
    )?.url ??
    manifest.find(page => (page.locale ?? i18n.defaultLocale) === locale)
      ?.url ??
    localizedPathname(i18n, locale, basePath)
  const searchDocuments: ReadonlyArray<SearchDocument> = manifest.flatMap(
    page => {
      const sections =
        page.structuredData === undefined || page.structuredData.length === 0
          ? [
              {
                id: '',
                title: page.frontmatter.title,
                content: page.plainText,
              },
            ]
          : page.structuredData
      return sections.map(section => {
        const isPage = section.id.length === 0
        return {
          id: isPage ? page.id : `${page.id}#${section.id}`,
          url: isPage ? page.url : `${page.url}#${section.id}`,
          title: section.title,
          type: isPage ? ('page' as const) : ('section' as const),
          pageId: page.id,
          pageTitle: page.frontmatter.title,
          ...(isPage ? {} : { sectionId: section.id }),
          ...(page.frontmatter.description === undefined || !isPage
            ? {}
            : { description: page.frontmatter.description }),
          content: section.content,
          locale: page.locale ?? i18n.defaultLocale,
          ...(page.frontmatter.tags === undefined
            ? {}
            : { tags: page.frontmatter.tags }),
        }
      })
    },
  )
  const localSearch = new Map<string, Promise<SearchClient>>()
  const loadSearchDocuments = async (
    locale: string,
  ): Promise<ReadonlyArray<SearchDocument>> => {
    const indexUrl =
      options.searchIndexUrls?.[locale] ??
      options.searchIndexUrls?.[i18n.defaultLocale]
    if (indexUrl === undefined) return searchDocuments
    const response = await fetch(indexUrl, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok)
      throw new Error(
        `Unable to load ${indexUrl}: ${String(response.status)} ${response.statusText}`,
      )
    return S.decodeUnknownSync(S.Array(SearchDocument))(await response.json())
  }
  const defaultSearch: SearchClient = {
    provider: 'orama',
    search: (query, searchOptions = {}) => {
      if (query.trim().length === 0) return Effect.succeed([])
      return Effect.tryPromise({
        try: async () => {
          const locale = searchOptions.locale ?? i18n.defaultLocale
          let client = localSearch.get(locale)
          if (client === undefined) {
            client = Promise.all([
              import('@foldocs/search-orama'),
              loadSearchDocuments(locale),
            ]).then(([{ createOramaSearchClient }, documents]) =>
              createOramaSearchClient(documents),
            )
            localSearch.set(locale, client)
          }
          return Effect.runPromise((await client).search(query, searchOptions))
        },
        catch: cause => new SearchError('orama', cause),
      })
    },
  }
  const searchClient = options.search ?? defaultSearch

  const referencedPageUrl = (
    fromUrl: string,
    reference: string,
  ): string | undefined => {
    if (/^(?:[a-z]+:|#)/iu.test(reference)) return undefined
    try {
      const url = new URL(reference, `https://foldocs.local${fromUrl}`)
      return url.pathname.replace(/\/+$/u, '') || '/'
    } catch {
      return undefined
    }
  }
  const graphFor = (pathname: string) => {
    const current = findPageByUrl(manifest, pathname)
    if (current === undefined) return undefined
    const outgoing = (current.references ?? []).flatMap(reference => {
      const url = referencedPageUrl(current.url, reference.url)
      const target =
        url === undefined ? undefined : findPageByUrl(manifest, url)
      return target === undefined || target.url === current.url
        ? []
        : [
            {
              url: target.url,
              title: target.frontmatter.title,
              direction: 'outgoing' as const,
            },
          ]
    })
    const backlinks = manifest.flatMap(page => {
      if (page.url === current.url) return []
      const linksHere = (page.references ?? []).some(
        reference => referencedPageUrl(page.url, reference.url) === current.url,
      )
      return linksHere
        ? [
            {
              url: page.url,
              title: page.frontmatter.title,
              direction: 'backlink' as const,
            },
          ]
        : []
    })
    return {
      currentTitle: current.frontmatter.title,
      links: [
        ...new Map(
          [...outgoing, ...backlinks].map(link => [
            `${link.direction}:${link.url}`,
            link,
          ]),
        ).values(),
      ],
    }
  }

  const PageLoading = m('PageLoading', { pathname: S.String })
  const PageHome = m('PageHome')
  const PageReady = m('PageReady', { pathname: S.String, page: CompiledPage })
  const PageFailed = m('PageFailed', { pathname: S.String, reason: S.String })
  const PageState = S.Union([PageHome, PageLoading, PageReady, PageFailed])

  const Model = S.Struct({
    pathname: S.String,
    locale: S.String,
    page: PageState,
    sidebarOpen: S.Boolean,
    searchOpen: S.Boolean,
    searchQuery: S.String,
    searchResults: S.Array(SearchResult),
    searchError: S.String,
    searchLoading: S.Boolean,
    activeSearchResultIndex: S.Number,
    selectedSearchTags: S.Array(S.String),
    activeTocId: S.String,
    mobileTocOpen: S.Boolean,
    narrowViewport: S.Boolean,
    collapsedSidebarGroups: S.Array(S.String),
    theme: S.Literals(['light', 'dark']),
    systemTheme: S.Literals(['light', 'dark']),
    themePreference: S.Literals(['light', 'system', 'dark']),
    packageManager: S.Literals(['npm', 'pnpm', 'yarn', 'bun']),
    selectedTabs: S.Record(S.String, S.String),
    aiOpen: S.Boolean,
    aiInput: S.String,
    aiLoading: S.Boolean,
    aiError: S.String,
    aiMessages: S.Array(
      S.Struct({
        role: S.Literals(['user', 'assistant']),
        content: S.String,
        sources: S.optionalKey(
          S.Array(S.Struct({ title: S.String, url: S.String })),
        ),
      }),
    ),
    apiResponses: S.Record(
      S.String,
      S.Struct({
        loading: S.Boolean,
        status: S.String,
        body: S.String,
        error: S.String,
      }),
    ),
    apiRequestUrls: S.Record(S.String, S.String),
    apiRequestBodies: S.Record(S.String, S.String),
    copiedText: S.String,
    copyMarkdownStatus: S.Literals(['idle', 'loading', 'copied', 'error']),
    bannerDismissed: S.Boolean,
    imagePreviewUrl: S.String,
    imagePreviewAlt: S.String,
    feedbackStatus: S.Literals(['idle', 'submitting', 'submitted', 'error']),
    headerLanguageMenu: LanguageMenuModel,
    sidebarLanguageMenu: LanguageMenuModel,
    layoutTabsMenu: DocsMenuModel,
    pageOpenMenu: DocsMenuModel,
    landingCopyTooltip: Tooltip.Model,
    searchDialog: FoldocsDialogModel,
    sidebarDialog: FoldocsDialogModel,
    aiDialog: FoldocsDialogModel,
  })
  type Model = typeof Model.Type

  const CompletedNavigateInternal = m('CompletedNavigateInternal')
  const CompletedScrollToSection = m('CompletedScrollToSection')
  const CompletedLoadExternal = m('CompletedLoadExternal')
  const CompletedOpenExternalInNewTab = m('CompletedOpenExternalInNewTab')
  const ClickedLink = m('ClickedLink', { request: UrlRequest })
  const ClickedOpenExternal = m('ClickedOpenExternal', { href: S.String })
  const ChangedUrl = m('ChangedUrl', { url: Url })
  const SucceededLoadPage = m('SucceededLoadPage', {
    pathname: S.String,
    page: CompiledPage,
  })
  const FailedLoadPage = m('FailedLoadPage', {
    pathname: S.String,
    reason: S.String,
  })
  const LoadPageResult = S.Union([SucceededLoadPage, FailedLoadPage])
  const ChangedSearch = m('ChangedSearch', { query: S.String })
  const ToggledSearchTag = m('ToggledSearchTag', { tag: S.String })
  const SucceededSearch = m('SucceededSearch', {
    query: S.String,
    results: S.Array(SearchResult),
  })
  const FailedSearch = m('FailedSearch', { query: S.String, reason: S.String })
  const SearchResultMessage = S.Union([SucceededSearch, FailedSearch])
  const PressedSearchKey = m('PressedSearchKey', { key: S.String })
  const ChangedActiveSection = m('ChangedActiveSection', {
    sectionId: S.String,
  })
  const SelectedToc = m('SelectedToc', { sectionId: S.String })
  const ToggledMobileToc = m('ToggledMobileToc', { open: S.Boolean })
  const SelectedSearchResult = m('SelectedSearchResult', { url: S.String })
  const ChangedNarrowViewport = m('ChangedNarrowViewport', {
    narrow: S.Boolean,
  })
  const ToggledSidebar = m('ToggledSidebar')
  const ClosedSidebar = m('ClosedSidebar')
  const ToggledSearch = m('ToggledSearch')
  const ClosedSearch = m('ClosedSearch')
  const ToggledSidebarGroup = m('ToggledSidebarGroup', { key: S.String })
  const LoadedSidebarGroups = m('LoadedSidebarGroups', {
    groups: S.Array(S.String),
  })
  const CompletedSaveSidebarGroups = m('CompletedSaveSidebarGroups')
  const SelectedTheme = m('SelectedTheme', {
    preference: S.Literals(['light', 'system', 'dark']),
  })
  const LoadedTheme = m('LoadedTheme', {
    preference: S.Literals(['light', 'system', 'dark']),
    theme: S.Literals(['light', 'dark']),
    systemTheme: S.Literals(['light', 'dark']),
  })
  const ChangedSystemTheme = m('ChangedSystemTheme', {
    theme: S.Literals(['light', 'dark']),
  })
  const CompletedApplyTheme = m('CompletedApplyTheme')
  const CompletedRenderMermaid = m('CompletedRenderMermaid')
  const DismissedBanner = m('DismissedBanner')
  const CompletedSaveBannerDismissal = m('CompletedSaveBannerDismissal')
  const OpenedImagePreview = m('OpenedImagePreview', {
    url: S.String,
    alt: S.String,
  })
  const ClosedImagePreview = m('ClosedImagePreview')
  const SubmittedFeedback = m('SubmittedFeedback', {
    rating: S.Literals(['positive', 'negative']),
  })
  const SucceededFeedback = m('SucceededFeedback')
  const FailedFeedback = m('FailedFeedback')
  const FeedbackResult = S.Union([SucceededFeedback, FailedFeedback])
  const CompletedApplyLocaleMetadata = m('CompletedApplyLocaleMetadata')
  const CompletedSaveTheme = m('CompletedSaveTheme')
  const SelectedPackageManager = m('SelectedPackageManager', {
    manager: S.Literals(['npm', 'pnpm', 'yarn', 'bun']),
  })
  const CompletedSavePackageManager = m('CompletedSavePackageManager')
  const SelectedTab = m('SelectedTab', {
    groupId: S.String,
    value: S.String,
    persist: S.Boolean,
    updateAnchor: S.Boolean,
  })
  const LoadedTabs = m('LoadedTabs', {
    selected: S.Record(S.String, S.String),
  })
  const CompletedSaveTabs = m('CompletedSaveTabs')
  const OpenedAi = m('OpenedAi')
  const ClosedAi = m('ClosedAi')
  const ChangedAiInput = m('ChangedAiInput', { value: S.String })
  const SubmittedAi = m('SubmittedAi')
  const SucceededAi = m('SucceededAi', {
    content: S.String,
    sources: S.Array(S.Struct({ title: S.String, url: S.String })),
  })
  const FailedAi = m('FailedAi', { reason: S.String })
  const AiResult = S.Union([SucceededAi, FailedAi])
  const RequestedApi = m('RequestedApi', {
    id: S.String,
    url: S.String,
    method: S.String,
    body: S.String,
  })
  const ChangedApiRequestUrl = m('ChangedApiRequestUrl', {
    id: S.String,
    value: S.String,
  })
  const ChangedApiRequestBody = m('ChangedApiRequestBody', {
    id: S.String,
    value: S.String,
  })
  const SucceededApi = m('SucceededApi', {
    id: S.String,
    status: S.String,
    body: S.String,
  })
  const FailedApi = m('FailedApi', { id: S.String, reason: S.String })
  const ApiResult = S.Union([SucceededApi, FailedApi])
  const ClickedCopyText = m('ClickedCopyText', { value: S.String })
  const CompletedCopyText = m('CompletedCopyText', { value: S.String })
  const ClickedCopyMarkdown = m('ClickedCopyMarkdown', { url: S.String })
  const SucceededLoadMarkdown = m('SucceededLoadMarkdown', {
    markdown: S.String,
  })
  const FailedLoadMarkdown = m('FailedLoadMarkdown')
  const LoadMarkdownResult = S.Union([
    SucceededLoadMarkdown,
    FailedLoadMarkdown,
  ])
  const CompletedScrollSearchResult = m('CompletedScrollSearchResult')
  const PressedGlobalKey = m('PressedGlobalKey', {
    key: S.String,
    ctrlKey: S.Boolean,
    metaKey: S.Boolean,
  })
  const GotHeaderLanguageMenuMessage = m('GotHeaderLanguageMenuMessage', {
    message: LanguageMenuMessage,
  })
  const GotSidebarLanguageMenuMessage = m('GotSidebarLanguageMenuMessage', {
    message: LanguageMenuMessage,
  })
  const GotLayoutTabsMenuMessage = m('GotLayoutTabsMenuMessage', {
    message: DocsMenuMessage,
  })
  const GotPageOpenMenuMessage = m('GotPageOpenMenuMessage', {
    message: DocsMenuMessage,
  })
  const GotLandingCopyTooltipMessage = m('GotLandingCopyTooltipMessage', {
    message: Tooltip.Message,
  })
  const GotSearchDialogMessage = m('GotSearchDialogMessage', {
    message: FoldocsDialogMessage,
  })
  const GotSidebarDialogMessage = m('GotSidebarDialogMessage', {
    message: FoldocsDialogMessage,
  })
  const GotAiDialogMessage = m('GotAiDialogMessage', {
    message: FoldocsDialogMessage,
  })

  const Message = S.Union([
    CompletedNavigateInternal,
    CompletedScrollToSection,
    CompletedLoadExternal,
    CompletedOpenExternalInNewTab,
    ClickedLink,
    ClickedOpenExternal,
    ChangedUrl,
    SucceededLoadPage,
    FailedLoadPage,
    ChangedSearch,
    ToggledSearchTag,
    SucceededSearch,
    FailedSearch,
    PressedSearchKey,
    ChangedActiveSection,
    SelectedToc,
    ToggledMobileToc,
    SelectedSearchResult,
    ChangedNarrowViewport,
    ToggledSidebar,
    ClosedSidebar,
    ToggledSearch,
    ClosedSearch,
    ToggledSidebarGroup,
    LoadedSidebarGroups,
    CompletedSaveSidebarGroups,
    SelectedTheme,
    LoadedTheme,
    ChangedSystemTheme,
    CompletedApplyTheme,
    CompletedRenderMermaid,
    DismissedBanner,
    CompletedSaveBannerDismissal,
    OpenedImagePreview,
    ClosedImagePreview,
    SubmittedFeedback,
    SucceededFeedback,
    FailedFeedback,
    CompletedApplyLocaleMetadata,
    CompletedSaveTheme,
    SelectedPackageManager,
    CompletedSavePackageManager,
    SelectedTab,
    LoadedTabs,
    CompletedSaveTabs,
    OpenedAi,
    ClosedAi,
    ChangedAiInput,
    SubmittedAi,
    SucceededAi,
    FailedAi,
    RequestedApi,
    ChangedApiRequestUrl,
    ChangedApiRequestBody,
    SucceededApi,
    FailedApi,
    ClickedCopyText,
    CompletedCopyText,
    ClickedCopyMarkdown,
    SucceededLoadMarkdown,
    FailedLoadMarkdown,
    CompletedScrollSearchResult,
    PressedGlobalKey,
    GotHeaderLanguageMenuMessage,
    GotSidebarLanguageMenuMessage,
    GotLayoutTabsMenuMessage,
    GotPageOpenMenuMessage,
    GotLandingCopyTooltipMessage,
    GotSearchDialogMessage,
    GotSidebarDialogMessage,
    GotAiDialogMessage,
  ])
  type Message = typeof Message.Type

  const NavigateInternal = Command.define('NavigateInternal', {
    args: { url: S.String },
    messages: [CompletedNavigateInternal],
    execute: ({ url }) =>
      pushUrl(url).pipe(Effect.as(CompletedNavigateInternal())),
  })

  const ScrollToSection = Command.define('ScrollToSection', {
    args: { sectionId: S.String },
    messages: [CompletedScrollToSection],
    execute: ({ sectionId }) =>
      Effect.sync(() => {
        globalThis.document
          ?.getElementById(sectionId)
          ?.scrollIntoView({ block: 'start' })
        return CompletedScrollToSection()
      }),
  })

  const LoadExternal = Command.define('LoadExternal', {
    args: { href: S.String },
    messages: [CompletedLoadExternal],
    execute: ({ href }) => load(href).pipe(Effect.as(CompletedLoadExternal())),
  })

  const OpenExternalInNewTab = Command.define('OpenExternalInNewTab', {
    args: { href: S.String },
    messages: [CompletedOpenExternalInNewTab],
    execute: ({ href }) =>
      Effect.sync(() => {
        const opened = globalThis.open?.(href, '_blank', 'noopener,noreferrer')
        if (opened !== undefined && opened !== null) opened.opener = null
        return CompletedOpenExternalInNewTab()
      }),
  })

  const LoadPage = Command.define('LoadPage', {
    args: { pathname: S.String },
    messages: [LoadPageResult],
    execute: ({ pathname }) => {
      const entry = findPageByUrl(manifest, pathname)
      if (entry === undefined) {
        return Effect.succeed(
          FailedLoadPage({
            pathname,
            reason: `No document exists at ${pathname}.`,
          }),
        )
      }
      return Effect.tryPromise({
        try: entry.load,
        catch: messageFromError,
      }).pipe(
        Effect.map(({ default: page }) =>
          SucceededLoadPage({ pathname, page }),
        ),
        Effect.catch(reason =>
          Effect.succeed(FailedLoadPage({ pathname, reason })),
        ),
      )
    },
  })

  const Search = Command.define('Search', {
    args: {
      query: S.String,
      locale: S.String,
      tags: S.Array(S.String),
    },
    messages: [SearchResultMessage],
    execute: ({ query, locale, tags }) =>
      searchClient
        .search(query, {
          limit: 12,
          locale,
          ...(tags.length === 0 ? {} : { tags }),
        })
        .pipe(
          Effect.map(results =>
            SucceededSearch({ query, results: [...results] }),
          ),
          Effect.catch(error =>
            Effect.succeed(
              FailedSearch({ query, reason: messageFromError(error) }),
            ),
          ),
        ),
  })

  const AskAi = Command.define('AskAi', {
    args: {
      messages: S.Array(
        S.Struct({
          role: S.Literals(['user', 'assistant']),
          content: S.String,
        }),
      ),
      locale: S.String,
      pathname: S.String,
      title: S.String,
      description: S.String,
      content: S.String,
      url: S.String,
    },
    messages: [AiResult],
    execute: request => {
      if (options.ai === undefined)
        return Effect.succeed(
          FailedAi({ reason: 'The AI assistant is not configured.' }),
        )
      return options.ai.client
        .chat({
          messages: request.messages,
          locale: request.locale,
          pathname: request.pathname,
          page: {
            title: request.title,
            ...(request.description.length === 0
              ? {}
              : { description: request.description }),
            content: request.content,
            url: request.url,
          },
        })
        .pipe(
          Effect.map(response =>
            SucceededAi({
              content: response.message,
              sources: [...(response.sources ?? [])],
            }),
          ),
          Effect.catch(error =>
            Effect.succeed(FailedAi({ reason: messageFromError(error) })),
          ),
        )
    },
  })

  const SendApiRequest = Command.define('SendApiRequest', {
    args: {
      id: S.String,
      url: S.String,
      method: S.String,
      body: S.String,
    },
    messages: [ApiResult],
    execute: request =>
      Effect.tryPromise({
        try: async () => {
          const method = request.method.toUpperCase()
          const permitsBody = method !== 'GET' && method !== 'HEAD'
          const response = await fetch(request.url, {
            method: request.method,
            ...(!permitsBody || request.body.length === 0
              ? {}
              : {
                  headers: { 'content-type': 'application/json' },
                  body: request.body,
                }),
          })
          const body = (await response.text()).slice(0, 200_000)
          return SucceededApi({
            id: request.id,
            status: `${String(response.status)} ${response.statusText}`.trim(),
            body,
          })
        },
        catch: messageFromError,
      }).pipe(
        Effect.catch(reason =>
          Effect.succeed(FailedApi({ id: request.id, reason })),
        ),
      ),
  })

  const ScrollSearchResult = Command.define('ScrollSearchResult', {
    args: { index: S.Number },
    messages: [CompletedScrollSearchResult],
    execute: ({ index }) =>
      Dom.scrollIntoViewIfNotVisible(`#fd-search-result-${index}`, {
        block: 'nearest',
        when: 'Commit',
      }).pipe(Effect.ignore, Effect.as(CompletedScrollSearchResult())),
  })

  const applyTheme = (theme: 'light' | 'dark'): void => {
    const root = globalThis.document?.documentElement
    root?.classList.toggle('dark', theme === 'dark')
    if (root !== undefined) root.style.colorScheme = theme
  }

  const preferredSystemTheme = (): 'light' | 'dark' =>
    globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'

  const resolveTheme = (
    preference: 'light' | 'system' | 'dark',
    systemTheme: 'light' | 'dark',
  ): 'light' | 'dark' => (preference === 'system' ? systemTheme : preference)

  const readThemePreference = (): 'light' | 'system' | 'dark' => {
    let stored: string | null | undefined
    try {
      stored = globalThis.localStorage?.getItem('foldocs-theme')
    } catch {
      stored = undefined
    }
    return stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : 'system'
  }

  const ReadTheme = Command.define('ReadTheme', {
    messages: [LoadedTheme],
    execute: Effect.sync(() => {
      const preference = readThemePreference()
      const systemTheme = preferredSystemTheme()
      const theme = resolveTheme(preference, systemTheme)
      applyTheme(theme)
      return LoadedTheme({ preference, systemTheme, theme })
    }),
  })

  const readPackageManager = (): PackageManager => {
    let stored: string | null | undefined
    try {
      stored = globalThis.localStorage?.getItem('foldocs-package-manager')
    } catch {
      stored = undefined
    }
    return stored === 'npm' ||
      stored === 'pnpm' ||
      stored === 'yarn' ||
      stored === 'bun'
      ? stored
      : 'npm'
  }

  const readBannerDismissed = (): boolean => {
    const id = options.banner?.id
    if (id === undefined) return false
    try {
      return (
        globalThis.localStorage?.getItem(`foldocs-banner-${id}`) === 'dismissed'
      )
    } catch {
      return false
    }
  }

  const SavePackageManager = Command.define('SavePackageManager', {
    args: { manager: S.Literals(['npm', 'pnpm', 'yarn', 'bun']) },
    messages: [CompletedSavePackageManager],
    execute: ({ manager }) =>
      Effect.sync(() => {
        try {
          globalThis.localStorage?.setItem('foldocs-package-manager', manager)
        } catch {
          // Storage can be unavailable in private or embedded browsing contexts.
        }
        return CompletedSavePackageManager()
      }),
  })

  const ReadTabs = Command.define('ReadTabs', {
    messages: [LoadedTabs],
    execute: Effect.sync(() => {
      let selected: Record<string, string> = {}
      try {
        const stored = globalThis.localStorage?.getItem('foldocs-tabs')
        const parsed: unknown = stored == null ? {} : JSON.parse(stored)
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          !Array.isArray(parsed)
        )
          selected = Object.fromEntries(
            Object.entries(parsed).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === 'string',
            ),
          )
      } catch {
        selected = {}
      }
      const hash = globalThis.location?.hash ?? ''
      if (hash.startsWith('#tab=')) {
        const [groupId, value] = hash.slice('#tab='.length).split(':', 2)
        if (groupId !== undefined && value !== undefined) {
          try {
            selected[decodeURIComponent(groupId)] = decodeURIComponent(value)
          } catch {
            // Ignore malformed tab anchors and retain persisted selections.
          }
        }
      }
      return LoadedTabs({ selected })
    }),
  })

  const SaveTabs = Command.define('SaveTabs', {
    args: {
      selected: S.Record(S.String, S.String),
      persist: S.Boolean,
      groupId: S.String,
      value: S.String,
      updateAnchor: S.Boolean,
    },
    messages: [CompletedSaveTabs],
    execute: ({ selected, persist, groupId, value, updateAnchor }) =>
      Effect.sync(() => {
        if (persist) {
          try {
            globalThis.localStorage?.setItem(
              'foldocs-tabs',
              JSON.stringify(selected),
            )
          } catch {
            // Storage can be unavailable in private or embedded contexts.
          }
        }
        if (updateAnchor && globalThis.history !== undefined) {
          const url = new URL(globalThis.location.href)
          url.hash = `tab=${encodeURIComponent(groupId)}:${encodeURIComponent(value)}`
          globalThis.history.replaceState(globalThis.history.state, '', url)
        }
        return CompletedSaveTabs()
      }),
  })

  const SaveTheme = Command.define('SaveTheme', {
    args: {
      preference: S.Literals(['light', 'system', 'dark']),
      theme: S.Literals(['light', 'dark']),
    },
    messages: [CompletedSaveTheme],
    execute: ({ preference, theme }) =>
      Effect.sync(() => {
        applyTheme(theme)
        try {
          globalThis.localStorage?.setItem('foldocs-theme', preference)
        } catch {
          // Storage can be unavailable in private or embedded browsing contexts.
        }
        return CompletedSaveTheme()
      }),
  })

  const ApplyTheme = Command.define('ApplyTheme', {
    args: { theme: S.Literals(['light', 'dark']) },
    messages: [CompletedApplyTheme],
    execute: ({ theme }) =>
      Effect.sync(() => {
        applyTheme(theme)
        return CompletedApplyTheme()
      }),
  })

  const RenderMermaid = Command.define('RenderMermaid', {
    args: { theme: S.Literals(['light', 'dark']) },
    messages: [CompletedRenderMermaid],
    execute: ({ theme }) =>
      Effect.promise(async () => {
        if (globalThis.document === undefined) return CompletedRenderMermaid()
        await new Promise<void>(resolve =>
          globalThis.requestAnimationFrame === undefined
            ? resolve()
            : globalThis.requestAnimationFrame(() => resolve()),
        )
        const diagrams = [
          ...globalThis.document.querySelectorAll<HTMLElement>('.fd-mermaid'),
        ]
        if (diagrams.length === 0) return CompletedRenderMermaid()
        try {
          const { default: mermaid } = await import('mermaid')
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: theme === 'dark' ? 'dark' : 'default',
          })
          for (const [index, diagram] of diagrams.entries()) {
            const encoded = diagram.dataset.source
            if (encoded === undefined) continue
            try {
              const source = decodeURIComponent(encoded)
              const id = `fd-mermaid-${String(Date.now())}-${String(index)}`
              const { svg, bindFunctions } = await mermaid.render(id, source)
              diagram.innerHTML = svg
              diagram.dataset.rendered = 'true'
              bindFunctions?.(diagram)
            } catch {
              diagram.dataset.rendered = 'error'
            }
          }
        } catch {
          // The readable source remains visible when Mermaid cannot load.
        }
        return CompletedRenderMermaid()
      }),
  })

  const SaveBannerDismissal = Command.define('SaveBannerDismissal', {
    messages: [CompletedSaveBannerDismissal],
    execute: Effect.sync(() => {
      const id = options.banner?.id
      if (id !== undefined) {
        try {
          globalThis.localStorage?.setItem(`foldocs-banner-${id}`, 'dismissed')
        } catch {
          // Storage can be unavailable in private or embedded contexts.
        }
      }
      return CompletedSaveBannerDismissal()
    }),
  })

  const SendFeedback = Command.define('SendFeedback', {
    args: {
      endpoint: S.String,
      url: S.String,
      rating: S.Literals(['positive', 'negative']),
    },
    messages: [FeedbackResult],
    execute: ({ endpoint, url, rating }) =>
      Effect.tryPromise({
        try: async () => {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, rating }),
          })
          if (!response.ok)
            throw new Error(
              `Feedback endpoint returned ${String(response.status)}.`,
            )
          return SucceededFeedback()
        },
        catch: () => FailedFeedback(),
      }).pipe(Effect.catch(error => Effect.succeed(error))),
  })

  const alternatePathnames = (
    pathname: string,
  ): ReadonlyArray<{ readonly locale: string; readonly pathname: string }> => {
    const current = findPageByUrl(manifest, pathname)
    if (current === undefined) {
      return i18n.locales.map(({ locale }) => ({
        locale,
        pathname: localeHomePath(i18n, locale),
      }))
    }
    const translationKey = current.translationKey ?? current.slug
    return i18n.locales.map(({ locale }) => ({
      locale,
      pathname:
        manifest.find(
          page =>
            page.locale === locale &&
            (page.translationKey ?? page.slug) === translationKey,
        )?.url ?? localizedPathname(i18n, locale, pathname),
    }))
  }

  const ApplyLocaleMetadata = Command.define('ApplyLocaleMetadata', {
    args: { pathname: S.String },
    messages: [CompletedApplyLocaleMetadata],
    execute: ({ pathname }) =>
      Effect.sync(() => {
        const document = globalThis.document
        if (document === undefined) return CompletedApplyLocaleMetadata()
        const currentPage = findPageByUrl(manifest, pathname)
        const locale = localeFromPathname(i18n, pathname)
        const routeTitle = currentPage?.frontmatter.title ?? options.site.title
        const pageTitle = formatSeoTitle(
          routeTitle,
          options.site.title,
          seo.titleTemplate,
        )
        const description =
          currentPage?.frontmatter.description ?? options.site.description
        const keywords =
          currentPage?.frontmatter.keywords ?? options.site.keywords
        const configuredImage =
          currentPage?.frontmatter.socialImage ??
          (currentPage === undefined
            ? options.landingSocialImages?.[localeFromPathname(i18n, pathname)]
            : undefined) ??
          options.site.socialImage
        const socialImage =
          configuredImage === undefined || options.site.baseUrl === undefined
            ? configuredImage
            : new URL(
                configuredImage.replace(/^\//u, ''),
                `${options.site.baseUrl.replace(/\/+$/u, '')}/`,
              ).toString()
        const generatedSocialImage =
          configuredImage !== undefined &&
          options.og?.enabled === true &&
          configuredImage
            .replace(/^\/+/, '')
            .startsWith(`${options.og.directory}/`)
        const imageAlt =
          currentPage === undefined
            ? `${options.site.title} social preview`
            : `${routeTitle} — ${options.site.title}`
        const canonicalPath = currentPage?.url ?? localeHomePath(i18n, locale)
        const canonical =
          options.site.baseUrl === undefined
            ? undefined
            : new URL(
                canonicalPath.replace(/^\//u, ''),
                `${options.site.baseUrl.replace(/\/+$/u, '')}/`,
              ).toString()
        const syncMeta = (
          selector: string,
          attribute: 'name' | 'property',
          key: string,
          content: string | undefined,
        ): void => {
          const existing =
            document.head.querySelector<HTMLMetaElement>(selector)
          if (content === undefined) {
            existing?.remove()
            return
          }
          const meta = existing ?? document.createElement('meta')
          meta.setAttribute(attribute, key)
          meta.content = content
          meta.dataset.foldocsRoute = 'true'
          if (existing === null) document.head.append(meta)
        }
        document.title = pageTitle
        const robotDirectives = robotsContent(seo)
        syncMeta('meta[name="generator"]', 'name', 'generator', 'Foldocs')
        syncMeta('meta[name="author"]', 'name', 'author', seo.author.name)
        syncMeta('meta[name="robots"]', 'name', 'robots', robotDirectives)
        syncMeta('meta[name="googlebot"]', 'name', 'googlebot', robotDirectives)
        syncMeta('meta[name="description"]', 'name', 'description', description)
        syncMeta(
          'meta[property="og:description"]',
          'property',
          'og:description',
          description,
        )
        syncMeta(
          'meta[name="twitter:description"]',
          'name',
          'twitter:description',
          description,
        )
        syncMeta(
          'meta[name="keywords"]',
          'name',
          'keywords',
          keywords?.join(', '),
        )
        syncMeta('meta[property="og:title"]', 'property', 'og:title', pageTitle)
        syncMeta(
          'meta[property="og:type"]',
          'property',
          'og:type',
          currentPage === undefined ? 'website' : 'article',
        )
        syncMeta(
          'meta[property="og:site_name"]',
          'property',
          'og:site_name',
          options.site.title,
        )
        syncMeta(
          'meta[property="og:locale"]',
          'property',
          'og:locale',
          openGraphLocale(locale),
        )
        syncMeta(
          'meta[name="twitter:title"]',
          'name',
          'twitter:title',
          pageTitle,
        )
        syncMeta(
          'meta[name="twitter:site"]',
          'name',
          'twitter:site',
          seo.twitterSite,
        )
        syncMeta(
          'meta[name="twitter:creator"]',
          'name',
          'twitter:creator',
          seo.twitterCreator,
        )
        syncMeta(
          'meta[name="twitter:card"]',
          'name',
          'twitter:card',
          socialImage === undefined ? 'summary' : 'summary_large_image',
        )
        syncMeta(
          'meta[property="og:image"]',
          'property',
          'og:image',
          socialImage,
        )
        syncMeta(
          'meta[property="og:image:alt"]',
          'property',
          'og:image:alt',
          socialImage === undefined ? undefined : imageAlt,
        )
        syncMeta(
          'meta[property="og:image:width"]',
          'property',
          'og:image:width',
          generatedSocialImage ? String(options.og?.width) : undefined,
        )
        syncMeta(
          'meta[property="og:image:height"]',
          'property',
          'og:image:height',
          generatedSocialImage ? String(options.og?.height) : undefined,
        )
        syncMeta(
          'meta[property="og:image:type"]',
          'property',
          'og:image:type',
          generatedSocialImage ? 'image/png' : undefined,
        )
        syncMeta(
          'meta[name="twitter:image"]',
          'name',
          'twitter:image',
          socialImage,
        )
        syncMeta(
          'meta[name="twitter:image:alt"]',
          'name',
          'twitter:image:alt',
          socialImage === undefined ? undefined : imageAlt,
        )
        syncMeta(
          'meta[property="article:modified_time"]',
          'property',
          'article:modified_time',
          currentPage?.lastModified,
        )
        for (const element of document.head.querySelectorAll(
          'meta[data-foldocs-article-tag]',
        ))
          element.remove()
        for (const tag of currentPage?.frontmatter.tags ?? []) {
          const meta = document.createElement('meta')
          meta.setAttribute('property', 'article:tag')
          meta.content = tag
          meta.dataset.foldocsArticleTag = 'true'
          meta.dataset.foldocsRoute = 'true'
          document.head.append(meta)
        }
        for (const element of document.head.querySelectorAll(
          'meta[data-foldocs-og-locale-alternate]',
        ))
          element.remove()
        for (const alternate of i18n.locales) {
          if (alternate.locale === locale) continue
          const meta = document.createElement('meta')
          meta.setAttribute('property', 'og:locale:alternate')
          meta.content = openGraphLocale(alternate.locale)
          meta.dataset.foldocsOgLocaleAlternate = 'true'
          meta.dataset.foldocsRoute = 'true'
          document.head.append(meta)
        }
        const pageAncestors =
          currentPage === undefined
            ? []
            : manifest
                .filter(
                  page =>
                    page.locale === locale &&
                    page.url !== currentPage.url &&
                    currentPage.url.startsWith(`${page.url}/`),
                )
                .sort((left, right) => left.url.length - right.url.length)
        const jsonLd = buildSeoJsonLd({
          kind: currentPage === undefined ? 'landing' : 'page',
          site: options.site,
          seo,
          title: routeTitle,
          ...(description === undefined ? {} : { description }),
          ...(canonical === undefined ? {} : { url: canonical }),
          ...(socialImage === undefined ? {} : { image: socialImage }),
          locale,
          locales: i18n.locales.map(entry => entry.locale),
          ...(currentPage?.lastModified === undefined
            ? {}
            : { lastModified: currentPage.lastModified }),
          ...((keywords === undefined || keywords.length === 0) &&
          (currentPage?.frontmatter.tags === undefined ||
            currentPage.frontmatter.tags.length === 0)
            ? {}
            : {
                keywords: [
                  ...(keywords ?? []),
                  ...(currentPage?.frontmatter.tags ?? []),
                ],
              }),
          ...(currentPage === undefined
            ? {}
            : {
                breadcrumbs: [
                  {
                    name: options.site.title,
                    url: localeHomePath(i18n, locale),
                  },
                  ...pageAncestors.map(page => ({
                    name: page.frontmatter.title,
                    url: page.url,
                  })),
                  {
                    name: currentPage.frontmatter.title,
                    url: currentPage.url,
                  },
                ],
              }),
        })
        const existingJsonLd =
          document.head.querySelector<HTMLScriptElement>('#foldocs-json-ld')
        if (jsonLd === undefined) existingJsonLd?.remove()
        else {
          const script = existingJsonLd ?? document.createElement('script')
          script.id = 'foldocs-json-ld'
          script.type = 'application/ld+json'
          script.dataset.foldocsJsonLd = 'true'
          script.dataset.foldocsRoute = 'true'
          script.textContent = serializeJsonLd(jsonLd)
          if (existingJsonLd === null) document.head.append(script)
        }
        for (const selector of document.querySelectorAll(
          'details.fd-language-selector[open]',
        ))
          selector.removeAttribute('open')
        for (const element of document.head.querySelectorAll(
          'link[data-foldocs-i18n]',
        ))
          element.remove()
        if (i18n.enabled && options.site.baseUrl !== undefined) {
          const absolute = (value: string): string =>
            new URL(
              value.replace(/^\//u, ''),
              `${options.site.baseUrl!.replace(/\/+$/u, '')}/`,
            ).toString()
          for (const alternate of alternatePathnames(pathname)) {
            const link = document.createElement('link')
            link.rel = 'alternate'
            link.hreflang = alternate.locale
            link.href = absolute(alternate.pathname)
            link.dataset.foldocsI18n = 'true'
            document.head.append(link)
          }
          const defaultAlternate = alternatePathnames(pathname).find(
            alternate => alternate.locale === i18n.defaultLocale,
          )
          if (defaultAlternate !== undefined) {
            const link = document.createElement('link')
            link.rel = 'alternate'
            link.hreflang = 'x-default'
            link.href = absolute(defaultAlternate.pathname)
            link.dataset.foldocsI18n = 'true'
            document.head.append(link)
          }
        }
        return CompletedApplyLocaleMetadata()
      }),
  })

  const ReadSidebarGroups = Command.define('ReadSidebarGroups', {
    args: { pathname: S.String },
    messages: [LoadedSidebarGroups],
    execute: ({ pathname }) =>
      Effect.sync(() => {
        try {
          const value = globalThis.localStorage?.getItem(
            'foldocs-sidebar-groups',
          )
          const parsed: unknown =
            value === null || value === undefined
              ? defaultCollapsedSidebarGroups
              : JSON.parse(value)
          const groups = Array.isArray(parsed)
            ? parsed.filter(
                (entry): entry is string => typeof entry === 'string',
              )
            : []
          return LoadedSidebarGroups({
            groups: revealActiveSidebarGroups(groups, pathname),
          })
        } catch {
          return LoadedSidebarGroups({
            groups: revealActiveSidebarGroups(
              defaultCollapsedSidebarGroups,
              pathname,
            ),
          })
        }
      }),
  })

  const SaveSidebarGroups = Command.define('SaveSidebarGroups', {
    args: { groups: S.Array(S.String) },
    messages: [CompletedSaveSidebarGroups],
    execute: ({ groups }) =>
      Effect.sync(() => {
        try {
          globalThis.localStorage?.setItem(
            'foldocs-sidebar-groups',
            JSON.stringify(groups),
          )
        } catch {
          // Storage can be unavailable in private or embedded browsing contexts.
        }
        return CompletedSaveSidebarGroups()
      }),
  })

  const CopyText = Command.define('CopyText', {
    args: { value: S.String },
    messages: [CompletedCopyText],
    execute: ({ value }) =>
      Effect.tryPromise({
        try: async () => {
          if (globalThis.navigator?.clipboard?.writeText !== undefined) {
            await globalThis.navigator.clipboard.writeText(value)
            return
          }
          const textarea = globalThis.document?.createElement('textarea')
          if (textarea === undefined) return
          textarea.value = value
          textarea.style.position = 'fixed'
          textarea.style.opacity = '0'
          globalThis.document.body.append(textarea)
          textarea.select()
          globalThis.document.execCommand('copy')
          textarea.remove()
        },
        catch: messageFromError,
      }).pipe(
        Effect.ignore,
        Effect.andThen(Effect.sleep('2 seconds')),
        Effect.as(CompletedCopyText({ value })),
      ),
  })

  const LoadMarkdown = Command.define('LoadMarkdown', {
    args: { url: S.String },
    messages: [LoadMarkdownResult],
    execute: ({ url }) =>
      Effect.tryPromise({
        try: async () => {
          const response = await globalThis.fetch(url, {
            headers: { Accept: 'text/markdown' },
          })
          if (!response.ok)
            throw new Error(`Markdown request failed with ${response.status}.`)
          return await response.text()
        },
        catch: messageFromError,
      }).pipe(
        Effect.map(markdown => SucceededLoadMarkdown({ markdown })),
        Effect.catch(() => Effect.succeed(FailedLoadMarkdown())),
      ),
  })

  const preloadedPageFor = (
    pathname: string,
  ): typeof PageReady.Type | undefined => {
    if (options.preloadedPage === undefined) return undefined
    const requestedEntry = findPageByUrl(manifest, pathname)
    const preloadedEntry = findPageByUrl(
      manifest,
      options.preloadedPage.pathname,
    )
    if (
      requestedEntry === undefined ||
      preloadedEntry?.url !== requestedEntry.url
    )
      return undefined
    return PageReady({ pathname, page: options.preloadedPage.page })
  }

  const pageRequest = (
    pathname: string,
  ): readonly [
    typeof PageState.Type,
    ReadonlyArray<Command.Command<Message>>,
    string,
    string,
  ] => {
    const locale = localeFromPathname(i18n, pathname)
    if (!hasLocalePrefix(i18n, pathname)) {
      const target = initialPathname(i18n, pathname)
      const preloaded = preloadedPageFor(target)
      const home =
        stripLocalePrefix(i18n, target) === '/' &&
        findPageByUrl(manifest, target) === undefined
      return [
        preloaded ?? (home ? PageHome() : PageLoading({ pathname: target })),
        [
          NavigateInternal({
            url: target,
          }),
        ],
        i18n.defaultLocale,
        target,
      ]
    }
    const home =
      stripLocalePrefix(i18n, pathname) === '/' &&
      findPageByUrl(manifest, pathname) === undefined
    const preloaded = preloadedPageFor(pathname)
    return home
      ? [PageHome(), [], locale, pathname]
      : preloaded === undefined
        ? [
            PageLoading({ pathname }),
            [LoadPage({ pathname })],
            locale,
            pathname,
          ]
        : [preloaded, [], locale, pathname]
  }

  const init: Runtime.RoutingApplicationInit<Model, Message> = url => {
    const [page, commands, locale, pathname] = pageRequest(url.pathname)
    const systemTheme = preferredSystemTheme()
    const themePreference = readThemePreference()
    const theme = resolveTheme(themePreference, systemTheme)
    return [
      {
        pathname,
        locale,
        page,
        sidebarOpen: false,
        searchOpen: false,
        searchQuery: '',
        searchResults: [],
        searchError: '',
        searchLoading: false,
        activeSearchResultIndex: -1,
        selectedSearchTags: [],
        activeTocId: '',
        mobileTocOpen: false,
        narrowViewport:
          globalThis.matchMedia?.(narrowViewportQuery).matches ?? false,
        collapsedSidebarGroups: [],
        theme,
        systemTheme,
        themePreference,
        packageManager: readPackageManager(),
        selectedTabs: {},
        aiOpen: false,
        aiInput: '',
        aiLoading: false,
        aiError: '',
        aiMessages: [],
        apiResponses: {},
        apiRequestUrls: {},
        apiRequestBodies: {},
        copiedText: '',
        copyMarkdownStatus: 'idle',
        bannerDismissed: readBannerDismissed(),
        imagePreviewUrl: '',
        imagePreviewAlt: '',
        feedbackStatus: 'idle',
        headerLanguageMenu: initLanguageMenu(headerLanguageMenuId),
        sidebarLanguageMenu: initLanguageMenu(sidebarLanguageMenuId),
        layoutTabsMenu: initDocsMenu(layoutTabsMenuId),
        pageOpenMenu: initDocsMenu(pageOpenMenuId),
        landingCopyTooltip: initLandingCopyTooltip(),
        searchDialog: initSearchDialog(),
        sidebarDialog: initSidebarDialog(),
        aiDialog: initAiDialog(),
      },
      [
        ...commands,
        ReadTheme(),
        ReadTabs(),
        ReadSidebarGroups({ pathname }),
        ApplyLocaleMetadata({ pathname }),
        RenderMermaid({ theme }),
      ],
    ]
  }

  type UpdateReturn = readonly [Model, ReadonlyArray<Command.Command<Message>>]
  const mapSearchDialogCommands = (
    commands: ReadonlyArray<Command.Command<Dialog.Message>>,
  ): ReadonlyArray<Command.Command<Message>> =>
    Command.mapMessages(commands, message =>
      GotSearchDialogMessage({ message }),
    )
  const mapSidebarDialogCommands = (
    commands: ReadonlyArray<Command.Command<Dialog.Message>>,
  ): ReadonlyArray<Command.Command<Message>> =>
    Command.mapMessages(commands, message =>
      GotSidebarDialogMessage({ message }),
    )
  const mapAiDialogCommands = (
    commands: ReadonlyArray<Command.Command<Dialog.Message>>,
  ): ReadonlyArray<Command.Command<Message>> =>
    Command.mapMessages(commands, message => GotAiDialogMessage({ message }))
  const closeSearch = (model: Model): UpdateReturn => {
    const [searchDialog, commands] = Dialog.close(model.searchDialog)
    return [
      {
        ...model,
        searchDialog,
        searchOpen: searchDialog.isOpen,
        searchQuery: '',
        searchResults: [],
        searchError: '',
        searchLoading: false,
        activeSearchResultIndex: -1,
      },
      mapSearchDialogCommands(commands),
    ]
  }
  const openSearch = (model: Model): UpdateReturn => {
    const [searchDialog, searchCommands] = Dialog.open(model.searchDialog)
    const [sidebarDialog, sidebarCommands] = Dialog.close(model.sidebarDialog)
    const [aiDialog, aiCommands] = Dialog.close(model.aiDialog)
    return [
      {
        ...model,
        searchDialog,
        sidebarDialog,
        aiDialog,
        searchOpen: searchDialog.isOpen,
        sidebarOpen: sidebarDialog.isOpen,
      },
      [
        ...mapSearchDialogCommands(searchCommands),
        ...mapSidebarDialogCommands(sidebarCommands),
        ...mapAiDialogCommands(aiCommands),
      ],
    ]
  }
  const closeSidebar = (model: Model): UpdateReturn => {
    const [sidebarDialog, commands] = Dialog.close(model.sidebarDialog)
    return [
      { ...model, sidebarDialog, sidebarOpen: sidebarDialog.isOpen },
      mapSidebarDialogCommands(commands),
    ]
  }
  const openSidebar = (model: Model): UpdateReturn => {
    const [sidebarDialog, commands] = Dialog.open(model.sidebarDialog)
    return [
      { ...model, sidebarDialog, sidebarOpen: sidebarDialog.isOpen },
      mapSidebarDialogCommands(commands),
    ]
  }
  const update = (model: Model, message: Message): UpdateReturn => {
    switch (message._tag) {
      case 'GotSearchDialogMessage': {
        const [searchDialog, commands] = Dialog.update(
          model.searchDialog,
          message.message,
        )
        return [
          {
            ...model,
            searchDialog,
            searchOpen: searchDialog.isOpen,
            ...(searchDialog.isOpen
              ? {}
              : {
                  searchQuery: '',
                  searchResults: [],
                  searchError: '',
                  searchLoading: false,
                  activeSearchResultIndex: -1,
                }),
          },
          mapSearchDialogCommands(commands),
        ]
      }
      case 'GotSidebarDialogMessage': {
        const [sidebarDialog, commands] = Dialog.update(
          model.sidebarDialog,
          message.message,
        )
        return [
          { ...model, sidebarDialog, sidebarOpen: sidebarDialog.isOpen },
          mapSidebarDialogCommands(commands),
        ]
      }
      case 'GotAiDialogMessage': {
        const [aiDialog, commands] = Dialog.update(
          model.aiDialog,
          message.message,
        )
        return [
          { ...model, aiDialog, aiOpen: aiDialog.isOpen },
          mapAiDialogCommands(commands),
        ]
      }
      case 'GotHeaderLanguageMenuMessage': {
        const [headerLanguageMenu, commands, maybeOutMessage] =
          LanguageMenu.update(model.headerLanguageMenu, message.message)
        const nextModel = { ...model, headerLanguageMenu }
        const mappedCommands = Command.mapMessages(commands, childMessage =>
          GotHeaderLanguageMenuMessage({ message: childMessage }),
        )
        return Option.match(maybeOutMessage, {
          onNone: (): UpdateReturn => [nextModel, mappedCommands],
          onSome: ({ value }): UpdateReturn => [
            nextModel,
            value === model.pathname
              ? mappedCommands
              : [...mappedCommands, NavigateInternal({ url: value })],
          ],
        })
      }
      case 'GotSidebarLanguageMenuMessage': {
        const [sidebarLanguageMenu, commands, maybeOutMessage] =
          LanguageMenu.update(model.sidebarLanguageMenu, message.message)
        const nextModel = { ...model, sidebarLanguageMenu }
        const mappedCommands = Command.mapMessages(commands, childMessage =>
          GotSidebarLanguageMenuMessage({ message: childMessage }),
        )
        return Option.match(maybeOutMessage, {
          onNone: (): UpdateReturn => [nextModel, mappedCommands],
          onSome: ({ value }): UpdateReturn => [
            nextModel,
            value === model.pathname
              ? mappedCommands
              : [...mappedCommands, NavigateInternal({ url: value })],
          ],
        })
      }
      case 'GotLayoutTabsMenuMessage': {
        const [layoutTabsMenu, commands, maybeOutMessage] =
          LayoutTabsMenu.update(model.layoutTabsMenu, message.message)
        const nextModel = { ...model, layoutTabsMenu }
        const mappedCommands = Command.mapMessages(commands, childMessage =>
          GotLayoutTabsMenuMessage({ message: childMessage }),
        )
        return Option.match(maybeOutMessage, {
          onNone: (): UpdateReturn => [nextModel, mappedCommands],
          onSome: ({ value }): UpdateReturn => [
            nextModel,
            value === model.pathname
              ? mappedCommands
              : [...mappedCommands, NavigateInternal({ url: value })],
          ],
        })
      }
      case 'GotPageOpenMenuMessage': {
        const [pageOpenMenu, commands, maybeOutMessage] = PageOpenMenu.update(
          model.pageOpenMenu,
          message.message,
        )
        const nextModel = { ...model, pageOpenMenu }
        const mappedCommands = Command.mapMessages(commands, childMessage =>
          GotPageOpenMenuMessage({ message: childMessage }),
        )
        return Option.match(maybeOutMessage, {
          onNone: (): UpdateReturn => [nextModel, mappedCommands],
          onSome: ({ value }): UpdateReturn => [
            nextModel,
            [...mappedCommands, OpenExternalInNewTab({ href: value })],
          ],
        })
      }
      case 'GotLandingCopyTooltipMessage': {
        const [landingCopyTooltip, commands] = Tooltip.update(
          model.landingCopyTooltip,
          message.message,
        )
        return [
          { ...model, landingCopyTooltip },
          Command.mapMessages(commands, childMessage =>
            GotLandingCopyTooltipMessage({ message: childMessage }),
          ),
        ]
      }
      case 'ClickedLink':
        return message.request._tag === 'Internal'
          ? [
              model,
              [NavigateInternal({ url: urlToString(message.request.url) })],
            ]
          : [model, [LoadExternal({ href: message.request.href })]]
      case 'ClickedOpenExternal':
        return [model, [OpenExternalInNewTab({ href: message.href })]]
      case 'ChangedUrl': {
        if (message.url.pathname === model.pathname) {
          return Option.match(message.url.hash, {
            onNone: () => [model, []],
            onSome: encodedSectionId => {
              let sectionId = encodedSectionId
              try {
                sectionId = decodeURIComponent(encodedSectionId)
              } catch {
                // Invalid percent escapes cannot identify a rendered heading.
              }
              return [
                {
                  ...model,
                  activeTocId: sectionId,
                  mobileTocOpen: false,
                },
                [ScrollToSection({ sectionId })],
              ]
            },
          })
        }
        const [page, commands, locale, pathname] = pageRequest(
          message.url.pathname,
        )
        const transitionPage =
          page._tag === 'PageLoading' &&
          (model.page._tag === 'PageReady' || model.page._tag === 'PageHome')
            ? model.page
            : page
        const [searchDialog, searchDialogCommands] = Dialog.close(
          model.searchDialog,
        )
        const [sidebarDialog, sidebarDialogCommands] = Dialog.close(
          model.sidebarDialog,
        )
        const [aiDialog, aiDialogCommands] = Dialog.close(model.aiDialog)
        return [
          {
            ...model,
            pathname,
            locale,
            collapsedSidebarGroups: revealActiveSidebarGroups(
              model.collapsedSidebarGroups,
              pathname,
            ),
            page: transitionPage,
            sidebarOpen: false,
            searchOpen: false,
            searchDialog,
            sidebarDialog,
            aiDialog,
            searchQuery: '',
            searchResults: [],
            searchError: '',
            searchLoading: false,
            activeSearchResultIndex: -1,
            selectedSearchTags: [],
            activeTocId: '',
            mobileTocOpen: false,
            aiOpen: false,
            aiInput: '',
            aiLoading: false,
            aiError: '',
            apiResponses: {},
            apiRequestUrls: {},
            apiRequestBodies: {},
            copiedText: '',
            copyMarkdownStatus: 'idle',
            imagePreviewUrl: '',
            imagePreviewAlt: '',
            feedbackStatus: 'idle',
          },
          [
            ...commands,
            ...mapSearchDialogCommands(searchDialogCommands),
            ...mapSidebarDialogCommands(sidebarDialogCommands),
            ...mapAiDialogCommands(aiDialogCommands),
            ApplyLocaleMetadata({
              pathname,
            }),
          ],
        ]
      }
      case 'SucceededLoadPage':
        return message.pathname !== model.pathname
          ? [model, []]
          : [
              {
                ...model,
                page: PageReady({
                  pathname: message.pathname,
                  page: message.page,
                }),
                activeTocId: message.page.toc[0]?.id ?? '',
                mobileTocOpen: false,
              },
              [RenderMermaid({ theme: model.theme })],
            ]
      case 'FailedLoadPage':
        return message.pathname !== model.pathname
          ? [model, []]
          : [
              {
                ...model,
                page: PageFailed({
                  pathname: message.pathname,
                  reason: message.reason,
                }),
              },
              [],
            ]
      case 'ChangedSearch': {
        const query = message.query
        return [
          {
            ...model,
            searchQuery: query,
            searchResults: query.trim().length === 0 ? [] : model.searchResults,
            searchError: '',
            searchLoading: query.trim().length > 0,
            activeSearchResultIndex: -1,
          },
          query.trim().length === 0
            ? []
            : [
                Search({
                  query,
                  locale: model.locale,
                  tags: model.selectedSearchTags,
                }),
              ],
        ]
      }
      case 'ToggledSearchTag': {
        const selectedSearchTags = model.selectedSearchTags.includes(
          message.tag,
        )
          ? model.selectedSearchTags.filter(tag => tag !== message.tag)
          : [...model.selectedSearchTags, message.tag]
        return [
          {
            ...model,
            selectedSearchTags,
            searchLoading: model.searchQuery.trim().length > 0,
            activeSearchResultIndex: -1,
          },
          model.searchQuery.trim().length === 0
            ? []
            : [
                Search({
                  query: model.searchQuery,
                  locale: model.locale,
                  tags: selectedSearchTags,
                }),
              ],
        ]
      }
      case 'SucceededSearch':
        return message.query !== model.searchQuery
          ? [model, []]
          : [
              {
                ...model,
                searchResults: message.results,
                searchError: '',
                searchLoading: false,
                activeSearchResultIndex: message.results.length === 0 ? -1 : 0,
              },
              [],
            ]
      case 'FailedSearch':
        return message.query !== model.searchQuery
          ? [model, []]
          : [
              {
                ...model,
                searchResults: [],
                searchError: message.reason,
                searchLoading: false,
                activeSearchResultIndex: -1,
              },
              [],
            ]
      case 'PressedSearchKey': {
        if (message.key === 'Escape') {
          return model.searchQuery.length > 0
            ? [
                {
                  ...model,
                  searchQuery: '',
                  searchResults: [],
                  searchError: '',
                  searchLoading: false,
                  activeSearchResultIndex: -1,
                },
                [],
              ]
            : closeSearch(model)
        }
        if (
          (message.key === 'ArrowDown' || message.key === 'ArrowUp') &&
          model.searchResults.length > 0
        ) {
          const last = model.searchResults.length - 1
          const index =
            message.key === 'ArrowDown'
              ? model.activeSearchResultIndex >= last
                ? 0
                : model.activeSearchResultIndex + 1
              : model.activeSearchResultIndex <= 0
                ? last
                : model.activeSearchResultIndex - 1
          return [
            { ...model, activeSearchResultIndex: index },
            [ScrollSearchResult({ index })],
          ]
        }
        if (message.key === 'Enter' && model.activeSearchResultIndex >= 0) {
          const result = model.searchResults[model.activeSearchResultIndex]
          if (result !== undefined) {
            const [nextModel, commands] = closeSearch(model)
            return [
              nextModel,
              [...commands, NavigateInternal({ url: result.url })],
            ]
          }
        }
        return [model, []]
      }
      case 'ChangedActiveSection':
        return [{ ...model, activeTocId: message.sectionId }, []]
      case 'SelectedToc':
        return [
          {
            ...model,
            activeTocId: message.sectionId,
            mobileTocOpen: false,
          },
          [ScrollToSection({ sectionId: message.sectionId })],
        ]
      case 'ToggledMobileToc':
        return [{ ...model, mobileTocOpen: message.open }, []]
      case 'SelectedSearchResult': {
        const [nextModel, commands] = closeSearch(model)
        return [
          nextModel,
          message.url === model.pathname
            ? commands
            : [...commands, NavigateInternal({ url: message.url })],
        ]
      }
      case 'ChangedNarrowViewport': {
        const [nextModel, commands] = closeSidebar(model)
        return [{ ...nextModel, narrowViewport: message.narrow }, commands]
      }
      case 'ToggledSidebar':
        return model.sidebarOpen ? closeSidebar(model) : openSidebar(model)
      case 'ClosedSidebar':
        return closeSidebar(model)
      case 'ToggledSearch':
        return model.searchOpen ? closeSearch(model) : openSearch(model)
      case 'ClosedSearch':
        return closeSearch(model)
      case 'ToggledSidebarGroup': {
        const collapsedSidebarGroups = model.collapsedSidebarGroups.includes(
          message.key,
        )
          ? model.collapsedSidebarGroups.filter(key => key !== message.key)
          : [...model.collapsedSidebarGroups, message.key]
        return [
          { ...model, collapsedSidebarGroups },
          [SaveSidebarGroups({ groups: collapsedSidebarGroups })],
        ]
      }
      case 'LoadedSidebarGroups':
        return [{ ...model, collapsedSidebarGroups: message.groups }, []]
      case 'SelectedTheme': {
        const theme = resolveTheme(message.preference, model.systemTheme)
        return [
          { ...model, themePreference: message.preference, theme },
          [
            SaveTheme({ preference: message.preference, theme }),
            RenderMermaid({ theme }),
          ],
        ]
      }
      case 'LoadedTheme':
        return [
          {
            ...model,
            themePreference: message.preference,
            systemTheme: message.systemTheme,
            theme: message.theme,
          },
          [],
        ]
      case 'ChangedSystemTheme': {
        const theme = resolveTheme(model.themePreference, message.theme)
        return [
          { ...model, systemTheme: message.theme, theme },
          theme === model.theme
            ? []
            : [ApplyTheme({ theme }), RenderMermaid({ theme })],
        ]
      }
      case 'SelectedPackageManager':
        return [
          { ...model, packageManager: message.manager },
          [SavePackageManager({ manager: message.manager })],
        ]
      case 'SelectedTab': {
        const selectedTabs = {
          ...model.selectedTabs,
          [message.groupId]: message.value,
        }
        return [
          { ...model, selectedTabs },
          [
            SaveTabs({
              selected: selectedTabs,
              persist: message.persist,
              groupId: message.groupId,
              value: message.value,
              updateAnchor: message.updateAnchor,
            }),
          ],
        ]
      }
      case 'LoadedTabs':
        return [{ ...model, selectedTabs: message.selected }, []]
      case 'OpenedAi': {
        const [aiDialog, commands] = Dialog.open(model.aiDialog)
        return [
          { ...model, aiDialog, aiOpen: aiDialog.isOpen, aiError: '' },
          mapAiDialogCommands(commands),
        ]
      }
      case 'ClosedAi': {
        const [aiDialog, commands] = Dialog.close(model.aiDialog)
        return [
          { ...model, aiDialog, aiOpen: aiDialog.isOpen },
          mapAiDialogCommands(commands),
        ]
      }
      case 'ChangedAiInput':
        return [{ ...model, aiInput: message.value, aiError: '' }, []]
      case 'SubmittedAi': {
        const question = model.aiInput.trim()
        if (
          question.length === 0 ||
          model.aiLoading ||
          options.ai === undefined ||
          model.page._tag !== 'PageReady'
        )
          return [model, []]
        const userMessage = { role: 'user' as const, content: question }
        const messages = [...model.aiMessages, userMessage]
        return [
          {
            ...model,
            aiInput: '',
            aiLoading: true,
            aiError: '',
            aiMessages: messages,
          },
          [
            AskAi({
              messages: messages.map(({ role, content }) => ({
                role,
                content,
              })),
              locale: model.locale,
              pathname: model.pathname,
              title: model.page.page.frontmatter.title,
              description: model.page.page.frontmatter.description ?? '',
              content: model.page.page.plainText,
              url:
                options.site.baseUrl === undefined
                  ? model.pathname
                  : `${options.site.baseUrl.replace(/\/+$/u, '')}${model.pathname}`,
            }),
          ],
        ]
      }
      case 'SucceededAi':
        return [
          {
            ...model,
            aiLoading: false,
            aiError: '',
            aiMessages: [
              ...model.aiMessages,
              {
                role: 'assistant',
                content: message.content,
                ...(message.sources.length === 0
                  ? {}
                  : { sources: message.sources }),
              },
            ],
          },
          [],
        ]
      case 'FailedAi':
        return [{ ...model, aiLoading: false, aiError: message.reason }, []]
      case 'RequestedApi':
        return [
          {
            ...model,
            apiResponses: {
              ...model.apiResponses,
              [message.id]: {
                loading: true,
                status: '',
                body: '',
                error: '',
              },
            },
          },
          [
            SendApiRequest({
              id: message.id,
              url: message.url,
              method: message.method,
              body: message.body,
            }),
          ],
        ]
      case 'ChangedApiRequestUrl':
        return [
          {
            ...model,
            apiRequestUrls: {
              ...model.apiRequestUrls,
              [message.id]: message.value,
            },
          },
          [],
        ]
      case 'ChangedApiRequestBody':
        return [
          {
            ...model,
            apiRequestBodies: {
              ...model.apiRequestBodies,
              [message.id]: message.value,
            },
          },
          [],
        ]
      case 'SucceededApi':
        return [
          {
            ...model,
            apiResponses: {
              ...model.apiResponses,
              [message.id]: {
                loading: false,
                status: message.status,
                body: message.body,
                error: '',
              },
            },
          },
          [],
        ]
      case 'FailedApi':
        return [
          {
            ...model,
            apiResponses: {
              ...model.apiResponses,
              [message.id]: {
                loading: false,
                status: '',
                body: '',
                error: message.reason,
              },
            },
          },
          [],
        ]
      case 'ClickedCopyText':
        return [
          { ...model, copiedText: message.value, copyMarkdownStatus: 'idle' },
          [CopyText({ value: message.value })],
        ]
      case 'CompletedCopyText':
        return model.copiedText === message.value
          ? [{ ...model, copiedText: '', copyMarkdownStatus: 'idle' }, []]
          : [model, []]
      case 'ClickedCopyMarkdown':
        return [
          { ...model, copyMarkdownStatus: 'loading' },
          [LoadMarkdown({ url: message.url })],
        ]
      case 'SucceededLoadMarkdown':
        return [
          {
            ...model,
            copiedText: message.markdown,
            copyMarkdownStatus: 'copied',
          },
          [CopyText({ value: message.markdown })],
        ]
      case 'FailedLoadMarkdown':
        return [{ ...model, copyMarkdownStatus: 'error' }, []]
      case 'DismissedBanner':
        return [{ ...model, bannerDismissed: true }, [SaveBannerDismissal()]]
      case 'OpenedImagePreview':
        return [
          {
            ...model,
            imagePreviewUrl: message.url,
            imagePreviewAlt: message.alt,
          },
          [],
        ]
      case 'ClosedImagePreview':
        return [{ ...model, imagePreviewUrl: '', imagePreviewAlt: '' }, []]
      case 'SubmittedFeedback':
        return options.feedback === undefined
          ? [model, []]
          : [
              { ...model, feedbackStatus: 'submitting' },
              [
                SendFeedback({
                  endpoint: options.feedback.endpoint,
                  url: model.pathname,
                  rating: message.rating,
                }),
              ],
            ]
      case 'SucceededFeedback':
        return [{ ...model, feedbackStatus: 'submitted' }, []]
      case 'FailedFeedback':
        return [{ ...model, feedbackStatus: 'error' }, []]
      case 'PressedGlobalKey':
        if (
          message.key.toLowerCase() === 'k' &&
          (message.metaKey || message.ctrlKey)
        ) {
          return model.searchOpen ? closeSearch(model) : openSearch(model)
        }
        if (
          message.key.toLowerCase() === 'd' &&
          !message.metaKey &&
          !message.ctrlKey
        ) {
          const preference = model.theme === 'dark' ? 'light' : 'dark'
          return [
            { ...model, themePreference: preference, theme: preference },
            [
              SaveTheme({ preference, theme: preference }),
              RenderMermaid({ theme: preference }),
            ],
          ]
        }
        if (message.key === 'Escape' && model.searchOpen) {
          return model.searchQuery.length > 0
            ? [
                {
                  ...model,
                  searchQuery: '',
                  searchResults: [],
                  searchError: '',
                  searchLoading: false,
                  activeSearchResultIndex: -1,
                },
                [],
              ]
            : closeSearch(model)
        }
        if (message.key === 'Escape' && model.sidebarOpen) {
          return closeSidebar(model)
        }
        if (message.key === 'Escape' && model.imagePreviewUrl.length > 0) {
          return [{ ...model, imagePreviewUrl: '', imagePreviewAlt: '' }, []]
        }
        if (message.key === 'Escape' && model.aiOpen) {
          return [{ ...model, aiOpen: false }, []]
        }
        return [model, []]
      case 'CompletedSaveTheme':
      case 'CompletedRenderMermaid':
      case 'CompletedSaveBannerDismissal':
      case 'CompletedSavePackageManager':
      case 'CompletedSaveTabs':
      case 'CompletedApplyTheme':
      case 'CompletedApplyLocaleMetadata':
      case 'CompletedSaveSidebarGroups':
      case 'CompletedScrollSearchResult':
      case 'CompletedScrollToSection':
      case 'CompletedNavigateInternal':
      case 'CompletedLoadExternal':
      case 'CompletedOpenExternalInNewTab':
        return [model, []]
    }
  }

  const pendingView = (model: Model, h: HtmlBuilder<Message>): Document => {
    const failed = model.page._tag === 'PageFailed'
    const definition = localeDefinition(i18n, model.locale)
    const translations = definition.ui
    return {
      title: `${failed ? translations.documentNotFound : translations.loading} | ${options.site.title}`,
      lang: definition.locale,
      dir: definition.dir === 'rtl' ? 'Rtl' : 'Ltr',
      body: h.div(
        [h.Class('fd-root')],
        [
          h.main(
            [h.Class('fd-state-page')],
            [
              h.div([h.Class('fd-logo-mark')], ['F']),
              h.h1(
                [],
                [
                  failed
                    ? translations.documentNotFound
                    : translations.loadingDocumentation,
                ],
              ),
              ...(failed ? [h.p([], [model.page.reason])] : []),
              h.a(
                [h.Href(docsUrlFor(model.locale))],
                [translations.goToDocumentationHome],
              ),
            ],
          ),
        ],
      ),
    }
  }

  const commonSearchOptions = (model: Model) => ({
    searchOpen: model.searchOpen,
    searchDialog: model.searchDialog,
    searchQuery: model.searchQuery,
    searchResults: model.searchResults,
    searchLoading: model.searchLoading,
    searchError: model.searchError,
    activeSearchResultIndex: model.activeSearchResultIndex,
    availableSearchTags: [
      ...new Set(
        manifest
          .filter(page => (page.locale ?? i18n.defaultLocale) === model.locale)
          .flatMap(page => page.frontmatter.tags ?? []),
      ),
    ].sort((left, right) => left.localeCompare(right)),
    selectedSearchTags: model.selectedSearchTags,
    translations: localeDefinition(i18n, model.locale).ui,
  })

  const localeLinks = (model: Model) =>
    alternatePathnames(model.pathname).map(alternate => {
      const definition = localeDefinition(i18n, alternate.locale)
      return {
        locale: alternate.locale,
        name: definition.name,
        dir: definition.dir,
        href: alternate.pathname,
        current: alternate.locale === model.locale,
      } as const
    })

  const view = (model: Model, h: HtmlBuilder<Message>): Document => {
    const definition = localeDefinition(i18n, model.locale)
    if (model.page._tag === 'PageHome') {
      const homeUrl = localeHomePath(i18n, model.locale)
      const canonical =
        options.site.baseUrl === undefined
          ? undefined
          : `${options.site.baseUrl.replace(/\/+$/u, '')}${homeUrl === '/' ? '' : homeUrl}`
      return {
        title: options.site.title,
        lang: definition.locale,
        dir: definition.dir === 'rtl' ? 'Rtl' : 'Ltr',
        ...(canonical === undefined ? {} : { canonical }),
        ...(canonical === undefined ? {} : { ogUrl: canonical }),
        body: landingLayout<Message>(
          {
            site: options.site,
            landing,
            ...(options.banner === undefined ? {} : { banner: options.banner }),
            bannerDismissed: model.bannerDismissed,
            docsUrl: docsUrlFor(model.locale),
            homeUrl,
            locales: localeLinks(model),
            currentLocale: model.locale,
            headerLanguageMenu: model.headerLanguageMenu,
            theme: model.theme,
            themePreference: model.themePreference,
            copiedText: model.copiedText,
            copyTooltip: model.landingCopyTooltip,
            ...commonSearchOptions(model),
            actions: {
              toggleSearch: ToggledSearch(),
              closeSearch: ClosedSearch(),
              updateSearch: query => ChangedSearch({ query }),
              searchKeyDown: key => PressedSearchKey({ key }),
              selectSearchResult: url => SelectedSearchResult({ url }),
              toggleSearchTag: tag => ToggledSearchTag({ tag }),
              gotSearchDialogMessage: message =>
                GotSearchDialogMessage({ message }),
              selectTheme: preference => SelectedTheme({ preference }),
              copyText: value => ClickedCopyText({ value }),
              gotCopyTooltipMessage: message =>
                GotLandingCopyTooltipMessage({ message }),
              openExternal: url => ClickedOpenExternal({ href: url }),
              dismissBanner: DismissedBanner(),
              gotHeaderLanguageMenuMessage: message =>
                GotHeaderLanguageMenuMessage({ message }),
            },
          },
          h,
        ),
      }
    }
    if (model.page._tag !== 'PageReady') return pendingView(model, h)
    const completeNavigation = navigationFor(model.locale)
    const navigation = navigationForUrl(completeNavigation, model.pathname)
    const currentEntry = findPageByUrl(manifest, model.pathname)
    const adjacent = adjacentPages(manifest, model.pathname, navigation)
    const markdownUrl =
      model.pathname === '/'
        ? '/index.md'
        : `${model.pathname.replace(/\/+$/u, '')}.md`
    const title = formatSeoTitle(
      model.page.page.frontmatter.title,
      options.site.title,
      seo.titleTemplate,
    )
    const canonical =
      options.site.baseUrl === undefined
        ? undefined
        : `${options.site.baseUrl.replace(/\/+$/u, '')}${model.pathname}`
    return {
      title,
      lang: definition.locale,
      dir: definition.dir === 'rtl' ? 'Rtl' : 'Ltr',
      ...(canonical === undefined ? {} : { canonical }),
      ...(canonical === undefined ? {} : { ogUrl: canonical }),
      body: docsLayout<Message>(
        {
          site: options.site,
          preset: options.layoutPreset ?? 'docs',
          navigation,
          tabs: navigationTabsForUrl(completeNavigation, model.pathname),
          currentUrl: model.pathname,
          docsUrl: docsUrlFor(model.locale),
          homeUrl: localeHomePath(i18n, model.locale),
          locales: localeLinks(model),
          currentLocale: model.locale,
          headerLanguageMenu: model.headerLanguageMenu,
          sidebarLanguageMenu: model.sidebarLanguageMenu,
          layoutTabsMenu: model.layoutTabsMenu,
          pageOpenMenu: model.pageOpenMenu,
          markdownUrl,
          markdownEnabled: options.markdown ?? true,
          ...(landing.footer === undefined ? {} : { footer: landing.footer }),
          ...(options.banner === undefined ? {} : { banner: options.banner }),
          bannerDismissed: model.bannerDismissed,
          ...(options.feedback === undefined
            ? {}
            : { feedback: options.feedback }),
          feedbackStatus: model.feedbackStatus,
          ...(model.imagePreviewUrl.length === 0
            ? {}
            : {
                imagePreview: {
                  url: model.imagePreviewUrl,
                  alt: model.imagePreviewAlt,
                },
              }),
          ...(options.ai === undefined
            ? {}
            : {
                ai: {
                  open: model.aiOpen,
                  input: model.aiInput,
                  loading: model.aiLoading,
                  error: model.aiError,
                  messages: model.aiMessages,
                },
                aiDialog: model.aiDialog,
              }),
          copyMarkdownStatus: model.copyMarkdownStatus,
          page: model.page.page,
          ...(currentEntry?.lastModified === undefined
            ? {}
            : { lastModified: currentEntry.lastModified }),
          ...(adjacent.previous === undefined
            ? {}
            : { previous: adjacent.previous }),
          ...(adjacent.next === undefined ? {} : { next: adjacent.next }),
          sidebarOpen: model.sidebarOpen,
          sidebarDialog: model.sidebarDialog,
          collapsedSidebarGroups: model.collapsedSidebarGroups,
          ...commonSearchOptions(model),
          activeTocId: model.activeTocId,
          mobileTocOpen: model.mobileTocOpen,
          narrowViewport: model.narrowViewport,
          theme: model.theme,
          themePreference: model.themePreference,
          actions: {
            toggleSidebar: ToggledSidebar(),
            closeSidebar: ClosedSidebar(),
            toggleSidebarGroup: key => ToggledSidebarGroup({ key }),
            toggleSearch: ToggledSearch(),
            closeSearch: ClosedSearch(),
            updateSearch: query => ChangedSearch({ query }),
            searchKeyDown: key => PressedSearchKey({ key }),
            selectSearchResult: url => SelectedSearchResult({ url }),
            toggleSearchTag: tag => ToggledSearchTag({ tag }),
            gotSearchDialogMessage: message =>
              GotSearchDialogMessage({ message }),
            gotSidebarDialogMessage: message =>
              GotSidebarDialogMessage({ message }),
            setMobileTocOpen: open => ToggledMobileToc({ open }),
            selectToc: sectionId => SelectedToc({ sectionId }),
            selectTheme: preference => SelectedTheme({ preference }),
            copyMarkdown: ClickedCopyMarkdown({ url: markdownUrl }),
            dismissBanner: DismissedBanner(),
            openImage: (url, alt) => OpenedImagePreview({ url, alt }),
            closeImage: ClosedImagePreview(),
            submitFeedback: rating => SubmittedFeedback({ rating }),
            ...(options.ai === undefined
              ? {}
              : {
                  openAi: OpenedAi(),
                  closeAi: ClosedAi(),
                  updateAiInput: value => ChangedAiInput({ value }),
                  submitAi: SubmittedAi(),
                  gotAiDialogMessage: message =>
                    GotAiDialogMessage({ message }),
                }),
            gotHeaderLanguageMenuMessage: message =>
              GotHeaderLanguageMenuMessage({ message }),
            gotSidebarLanguageMenuMessage: message =>
              GotSidebarLanguageMenuMessage({ message }),
            gotLayoutTabsMenuMessage: message =>
              GotLayoutTabsMenuMessage({ message }),
            gotPageOpenMenuMessage: message =>
              GotPageOpenMenuMessage({ message }),
          },
          markdown: {
            ...(options.islands === undefined
              ? {}
              : { islands: options.islands }),
            ...(options.components === undefined
              ? {}
              : { components: options.components }),
            copiedCode: model.copiedText,
            copyCode: value => ClickedCopyText({ value }),
            packageManager: model.packageManager,
            selectPackageManager: manager =>
              SelectedPackageManager({ manager }),
            selectedTabs: model.selectedTabs,
            selectTab: (groupId, value, persist, updateAnchor) =>
              SelectedTab({ groupId, value, persist, updateAnchor }),
            apiRequestUrls: model.apiRequestUrls,
            apiRequestBodies: model.apiRequestBodies,
            apiResponses: model.apiResponses,
            updateApiRequestUrl: (id, value) =>
              ChangedApiRequestUrl({ id, value }),
            updateApiRequestBody: (id, value) =>
              ChangedApiRequestBody({ id, value }),
            sendApiRequest: request => RequestedApi(request),
            copyLabel: localeDefinition(i18n, model.locale).ui.copy,
            copiedLabel: localeDefinition(i18n, model.locale).ui.copied,
            copyAriaLabel: localeDefinition(i18n, model.locale).ui.copyCode,
            copiedAriaLabel: localeDefinition(i18n, model.locale).ui.codeCopied,
            ...(graphFor(model.pathname) === undefined
              ? {}
              : { graph: graphFor(model.pathname)! }),
          },
        },
        h,
      ),
    }
  }

  const subscriptions = Subscription.make<Model, Message>()(entry => ({
    keyboard: Subscription.persistent(
      Stream.callback<typeof PressedGlobalKey.Type>(queue =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const isEditableTarget = (event: KeyboardEvent): boolean => {
              const target = event.target
              return (
                target instanceof HTMLElement &&
                (target.isContentEditable ||
                  target.matches("input, textarea, select, [role='textbox']"))
              )
            }
            const onKeyDown = (event: KeyboardEvent) => {
              if (
                event.key !== 'Escape' &&
                !(
                  event.key.toLowerCase() === 'k' &&
                  (event.metaKey || event.ctrlKey)
                ) &&
                !(
                  event.key.toLowerCase() === 'd' &&
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.altKey &&
                  !isEditableTarget(event)
                )
              )
                return
              event.preventDefault()
              Queue.offerUnsafe(
                queue,
                PressedGlobalKey({
                  key: event.key,
                  ctrlKey: event.ctrlKey,
                  metaKey: event.metaKey,
                }),
              )
            }
            globalThis.document?.addEventListener('keydown', onKeyDown)
            return onKeyDown
          }),
          onKeyDown =>
            Effect.sync(() =>
              globalThis.document?.removeEventListener('keydown', onKeyDown),
            ),
        ).pipe(Effect.flatMap(() => Effect.never)),
      ),
    ),
    viewport: Subscription.persistent(
      Stream.callback<typeof ChangedNarrowViewport.Type>(queue =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const mediaQuery = window.matchMedia(narrowViewportQuery)
            const onChange = (event: MediaQueryListEvent) => {
              Queue.offerUnsafe(
                queue,
                ChangedNarrowViewport({ narrow: event.matches }),
              )
            }
            mediaQuery.addEventListener('change', onChange)
            return { mediaQuery, onChange }
          }),
          ({ mediaQuery, onChange }) =>
            Effect.sync(() =>
              mediaQuery.removeEventListener('change', onChange),
            ),
        ).pipe(Effect.flatMap(() => Effect.never)),
      ),
    ),
    systemTheme: Subscription.persistent(
      Stream.callback<typeof ChangedSystemTheme.Type>(queue =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
            const onChange = (event: MediaQueryListEvent) => {
              Queue.offerUnsafe(
                queue,
                ChangedSystemTheme({ theme: event.matches ? 'dark' : 'light' }),
              )
            }
            mediaQuery.addEventListener('change', onChange)
            return { mediaQuery, onChange }
          }),
          ({ mediaQuery, onChange }) =>
            Effect.sync(() =>
              mediaQuery.removeEventListener('change', onChange),
            ),
        ).pipe(Effect.flatMap(() => Effect.never)),
      ),
    ),
    activeSection: entry(
      { pathname: S.String, sections: S.Array(S.String) },
      {
        modelToDependencies: model => ({
          pathname: model.pathname,
          sections:
            model.page._tag === 'PageReady'
              ? model.page.page.toc.map(({ id }) => id)
              : [],
        }),
        dependenciesToStream: ({ sections }) =>
          Stream.callback<typeof ChangedActiveSection.Type>(queue =>
            Effect.gen(function* () {
              if (sections.length === 0) return yield* Effect.never
              yield* Render.afterCommit
              yield* Effect.acquireRelease(
                Effect.sync(() => {
                  const visible = new Set<string>()
                  const intersectionObserver = new IntersectionObserver(
                    entries => {
                      for (const observed of entries) {
                        if (observed.isIntersecting)
                          visible.add(observed.target.id)
                        else visible.delete(observed.target.id)
                      }
                      const sectionId = sections.find(id => visible.has(id))
                      if (sectionId !== undefined) {
                        Queue.offerUnsafe(
                          queue,
                          ChangedActiveSection({ sectionId }),
                        )
                      }
                    },
                    { rootMargin: '-110px 0px -75% 0px' },
                  )
                  for (const id of sections) {
                    const element = document.getElementById(id)
                    if (element !== null) intersectionObserver.observe(element)
                  }
                  return intersectionObserver
                }),
                observer => Effect.sync(() => observer.disconnect()),
              )
              return yield* Effect.never
            }),
          ),
      },
    ),
  }))

  return {
    Model,
    Message,
    init,
    update,
    view,
    subscriptions,
    routing: {
      onUrlRequest: (request: UrlRequest) => ClickedLink({ request }),
      onUrlChange: (url: Url) => ChangedUrl({ url }),
    },
  }
}

export { defineConfig, defineOgTemplate } from 'foldocs-core'
export { defineContentAdapter, notion } from '@foldocs/content'
export type {
  ContentAdapter,
  ContentFile,
  NotionClientLike,
  NotionOptions,
} from '@foldocs/content'
export type {
  FoldocsConfig,
  I18nConfig,
  LandingFooterConfig,
  LocaleConfig,
  OgImageConfig,
  OgImageKind,
  OgImageTemplate,
  OgImageTemplateContext,
  PageManifest,
  ResolvedI18nConfig,
  ResolvedSeoConfig,
  SeoConfig,
  SeoEntityConfig,
  SiteConfig,
  UiTranslations,
} from 'foldocs-core'
export type { SearchClient, SearchProvider } from '@foldocs/search'
export type { CompiledPage } from 'foldocs-mdx/ast'
export type {
  BlockComponentView,
  InlineComponentView,
  MdxComponents,
} from 'foldocs-ui'
