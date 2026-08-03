import { Schema as S } from 'effect'

import type { ContentAdapter } from '@foldocs/content'

export const UiTranslations = S.Struct({
  home: S.optionalKey(S.String),
  selectLanguage: S.optionalKey(S.String),
  colorTheme: S.optionalKey(S.String),
  lightTheme: S.optionalKey(S.String),
  systemTheme: S.optionalKey(S.String),
  darkTheme: S.optionalKey(S.String),
  search: S.optionalKey(S.String),
  searchDocumentation: S.optionalKey(S.String),
  closeSearch: S.optionalKey(S.String),
  searchResults: S.optionalKey(S.String),
  searchPrompt: S.optionalKey(S.String),
  searching: S.optionalKey(S.String),
  searchUnavailable: S.optionalKey(S.String),
  noSearchResults: S.optionalKey(S.String),
  searchResultsAvailable: S.optionalKey(S.String),
  searchFilters: S.optionalKey(S.String),
  openNavigation: S.optionalKey(S.String),
  closeNavigation: S.optionalKey(S.String),
  documentationNavigation: S.optionalKey(S.String),
  documentation: S.optionalKey(S.String),
  selectDocumentation: S.optionalKey(S.String),
  skipToContent: S.optionalKey(S.String),
  onThisPage: S.optionalKey(S.String),
  tableOfContents: S.optionalKey(S.String),
  copyPageMarkdown: S.optionalKey(S.String),
  loading: S.optionalKey(S.String),
  copiedMarkdown: S.optionalKey(S.String),
  tryCopyAgain: S.optionalKey(S.String),
  copyMarkdown: S.optionalKey(S.String),
  openPage: S.optionalKey(S.String),
  openPageMenu: S.optionalKey(S.String),
  openInGitHub: S.optionalKey(S.String),
  viewAsMarkdown: S.optionalKey(S.String),
  openInSciraAi: S.optionalKey(S.String),
  openInChatGPT: S.optionalKey(S.String),
  openInClaude: S.optionalKey(S.String),
  openInCursor: S.optionalKey(S.String),
  openInGrok: S.optionalKey(S.String),
  askAiAboutPage: S.optionalKey(S.String),
  pagination: S.optionalKey(S.String),
  previousPage: S.optionalKey(S.String),
  nextPage: S.optionalKey(S.String),
  lastUpdated: S.optionalKey(S.String),
  dismissBanner: S.optionalKey(S.String),
  imagePreview: S.optionalKey(S.String),
  closeImagePreview: S.optionalKey(S.String),
  wasThisHelpful: S.optionalKey(S.String),
  helpful: S.optionalKey(S.String),
  notHelpful: S.optionalKey(S.String),
  feedbackThanks: S.optionalKey(S.String),
  feedbackFailed: S.optionalKey(S.String),
  builtWith: S.optionalKey(S.String),
  documentNotFound: S.optionalKey(S.String),
  loadingDocumentation: S.optionalKey(S.String),
  goToDocumentationHome: S.optionalKey(S.String),
  copyCode: S.optionalKey(S.String),
  codeCopied: S.optionalKey(S.String),
  copy: S.optionalKey(S.String),
  copied: S.optionalKey(S.String),
  mainNavigation: S.optionalKey(S.String),
  diveIn: S.optionalKey(S.String),
  readTheDocs: S.optionalKey(S.String),
  viewOnGitHub: S.optionalKey(S.String),
  copyCreateCommand: S.optionalKey(S.String),
  exploreDocumentation: S.optionalKey(S.String),
})
export type UiTranslations = typeof UiTranslations.Type

export interface ResolvedUiTranslations {
  readonly home: string
  readonly selectLanguage: string
  readonly colorTheme: string
  readonly lightTheme: string
  readonly systemTheme: string
  readonly darkTheme: string
  readonly search: string
  readonly searchDocumentation: string
  readonly closeSearch: string
  readonly searchResults: string
  readonly searchPrompt: string
  readonly searching: string
  readonly searchUnavailable: string
  readonly noSearchResults: string
  readonly searchResultsAvailable: string
  readonly searchFilters: string
  readonly openNavigation: string
  readonly closeNavigation: string
  readonly documentationNavigation: string
  readonly documentation: string
  readonly selectDocumentation: string
  readonly skipToContent: string
  readonly onThisPage: string
  readonly tableOfContents: string
  readonly copyPageMarkdown: string
  readonly loading: string
  readonly copiedMarkdown: string
  readonly tryCopyAgain: string
  readonly copyMarkdown: string
  readonly openPage: string
  readonly openPageMenu: string
  readonly openInGitHub: string
  readonly viewAsMarkdown: string
  readonly openInSciraAi: string
  readonly openInChatGPT: string
  readonly openInClaude: string
  readonly openInCursor: string
  readonly openInGrok: string
  readonly askAiAboutPage: string
  readonly pagination: string
  readonly previousPage: string
  readonly nextPage: string
  readonly lastUpdated: string
  readonly dismissBanner: string
  readonly imagePreview: string
  readonly closeImagePreview: string
  readonly wasThisHelpful: string
  readonly helpful: string
  readonly notHelpful: string
  readonly feedbackThanks: string
  readonly feedbackFailed: string
  readonly builtWith: string
  readonly documentNotFound: string
  readonly loadingDocumentation: string
  readonly goToDocumentationHome: string
  readonly copyCode: string
  readonly codeCopied: string
  readonly copy: string
  readonly copied: string
  readonly mainNavigation: string
  readonly diveIn: string
  readonly readTheDocs: string
  readonly viewOnGitHub: string
  readonly copyCreateCommand: string
  readonly exploreDocumentation: string
}

export const defaultUiTranslations: ResolvedUiTranslations = {
  home: 'home',
  selectLanguage: 'Select language',
  colorTheme: 'Color theme',
  lightTheme: 'Light',
  systemTheme: 'System',
  darkTheme: 'Dark',
  search: 'Search',
  searchDocumentation: 'Search documentation',
  closeSearch: 'Close search',
  searchResults: 'Search results',
  searchPrompt: 'Start typing to search every document.',
  searching: 'Searching…',
  searchUnavailable: 'Search is temporarily unavailable.',
  noSearchResults: 'No results for “{query}”.',
  searchResultsAvailable: '{count} results available.',
  searchFilters: 'Filter by topic',
  openNavigation: 'Open navigation',
  closeNavigation: 'Close navigation',
  documentationNavigation: 'Documentation navigation',
  documentation: 'Documentation',
  selectDocumentation: 'Select documentation',
  skipToContent: 'Skip to content',
  onThisPage: 'On this page',
  tableOfContents: 'Table of contents',
  copyPageMarkdown: 'Copy page as Markdown',
  loading: 'Loading…',
  copiedMarkdown: 'Copied Markdown',
  tryCopyAgain: 'Try Copy Again',
  copyMarkdown: 'Copy Markdown',
  openPage: 'Open',
  openPageMenu: 'Open page options',
  openInGitHub: 'Open in GitHub',
  viewAsMarkdown: 'View as Markdown',
  openInSciraAi: 'Open in Scira AI',
  openInChatGPT: 'Open in ChatGPT',
  openInClaude: 'Open in Claude',
  openInCursor: 'Open in Cursor',
  openInGrok: 'Open in Grok',
  askAiAboutPage: 'Read {url} so I can ask questions about it.',
  pagination: 'Pagination',
  previousPage: 'Previous',
  nextPage: 'Next',
  lastUpdated: 'Last updated {date}',
  dismissBanner: 'Dismiss announcement',
  imagePreview: 'Image preview',
  closeImagePreview: 'Close image preview',
  wasThisHelpful: 'Was this page helpful?',
  helpful: 'Yes',
  notHelpful: 'No',
  feedbackThanks: 'Thanks for your feedback.',
  feedbackFailed: 'Feedback could not be sent. Please try again.',
  builtWith: 'Built with Foldocs and Foldkit.',
  documentNotFound: 'Document not found',
  loadingDocumentation: 'Loading documentation…',
  goToDocumentationHome: 'Go to documentation home',
  copyCode: 'Copy code',
  codeCopied: 'Code copied',
  copy: 'Copy',
  copied: 'Copied',
  mainNavigation: 'Main',
  diveIn: 'Dive In',
  readTheDocs: 'Read the docs',
  viewOnGitHub: 'View on GitHub',
  copyCreateCommand: 'Copy create command',
  exploreDocumentation: 'Explore the documentation',
}

export const LocaleConfig = S.Struct({
  locale: S.String,
  name: S.String,
  dir: S.optionalKey(S.Literals(['ltr', 'rtl'])),
  ui: S.optionalKey(UiTranslations),
})
export type LocaleConfig = typeof LocaleConfig.Type

export const I18nConfig = S.Struct({
  defaultLocale: S.String,
  fallbackLocale: S.optionalKey(S.String),
  parser: S.optionalKey(S.Literals(['dir', 'dot'])),
  hideLocale: S.optionalKey(S.Literals(['never', 'default-locale', 'always'])),
  locales: S.Array(LocaleConfig),
})
export type I18nConfig = typeof I18nConfig.Type

export interface ResolvedLocaleConfig {
  readonly locale: string
  readonly name: string
  readonly dir: 'ltr' | 'rtl'
  readonly ui: ResolvedUiTranslations
}

export interface ResolvedI18nConfig {
  readonly enabled: boolean
  readonly defaultLocale: string
  readonly fallbackLocale: string
  readonly parser: 'dir' | 'dot'
  readonly hideLocale: 'never' | 'default-locale' | 'always'
  readonly locales: ReadonlyArray<ResolvedLocaleConfig>
}

export const SiteConfig = S.Struct({
  title: S.String,
  description: S.optionalKey(S.String),
  baseUrl: S.optionalKey(S.String),
  logoText: S.optionalKey(S.String),
  badge: S.optionalKey(S.String),
  tagline: S.optionalKey(S.String),
  githubUrl: S.optionalKey(S.String),
  /** Repository-relative directory that contains documentation source files. */
  githubContentPath: S.optionalKey(S.String),
  discordUrl: S.optionalKey(S.String),
  xUrl: S.optionalKey(S.String),
  npmUrl: S.optionalKey(S.String),
  keywords: S.optionalKey(S.Array(S.String)),
  socialImage: S.optionalKey(S.String),
  favicon: S.optionalKey(S.String),
  locale: S.optionalKey(S.String),
  /** Custom SVG markup keyed by the icon names used in page frontmatter/meta.json. */
  icons: S.optionalKey(S.Record(S.String, S.String)),
})
export type SiteConfig = typeof SiteConfig.Type

export const LayoutPreset = S.Literals(['docs', 'notebook', 'flux', 'glass'])
export type LayoutPreset = typeof LayoutPreset.Type

export const LandingSection = S.Literals([
  'hero',
  'overview',
  'stack',
  'features',
  'ai',
  'proof',
  'cta',
])
export type LandingSection = typeof LandingSection.Type

export const LandingFooterConfig = S.Struct({
  author: S.optionalKey(S.String),
  authorUrl: S.optionalKey(S.String),
  copyright: S.optionalKey(S.String),
  twitterUrl: S.optionalKey(S.String),
})
export type LandingFooterConfig = typeof LandingFooterConfig.Type

export const BannerConfig = S.Struct({
  content: S.String,
  id: S.optionalKey(S.String),
  href: S.optionalKey(S.String),
  variant: S.optionalKey(S.Literals(['default', 'rainbow'])),
  dismissible: S.optionalKey(S.Boolean),
})
export type BannerConfig = typeof BannerConfig.Type

export const FeedbackConfig = S.Struct({
  endpoint: S.String,
  prompt: S.optionalKey(S.String),
})
export type FeedbackConfig = typeof FeedbackConfig.Type

export const LandingConfig = S.Struct({
  sections: S.optionalKey(S.Array(LandingSection)),
  headline: S.optionalKey(S.String),
  description: S.optionalKey(S.String),
  command: S.optionalKey(S.String),
  footer: S.optionalKey(LandingFooterConfig),
})
export type LandingConfig = typeof LandingConfig.Type

export const defaultLandingSections: ReadonlyArray<LandingSection> = [
  'hero',
  'overview',
  'features',
  'cta',
]

export interface ResolvedLandingConfig {
  readonly sections: ReadonlyArray<LandingSection>
  readonly headline?: string
  readonly description?: string
  readonly command: string
  readonly footer?: LandingFooterConfig
}

export interface FoldocsConfig {
  readonly site: SiteConfig
  readonly i18n?: I18nConfig
  readonly content?: {
    readonly dir?: string
    readonly sources?: ReadonlyArray<ContentAdapter>
    readonly lastModified?: 'git' | 'filesystem' | false
  }
  readonly basePath?: string
  readonly layout?: {
    readonly preset?: LayoutPreset
  }
  readonly landing?: LandingConfig
  readonly banner?: BannerConfig
  readonly feedback?: FeedbackConfig
  readonly llms?: boolean
  readonly markdown?: boolean
  readonly sitemap?: boolean
  readonly rss?:
    | boolean
    | {
        readonly path?: string
        readonly title?: string
        readonly description?: string
      }
  readonly og?: boolean | { readonly directory?: string }
  readonly prerender?: boolean
  readonly search?: {
    readonly staticIndex?: boolean
  }
}

export interface ResolvedFoldocsConfig {
  readonly site: SiteConfig
  readonly i18n: ResolvedI18nConfig
  readonly content: {
    readonly dir: string
    readonly sources: ReadonlyArray<ContentAdapter>
    readonly lastModified: 'git' | 'filesystem' | false
  }
  readonly basePath: string
  readonly layout: {
    readonly preset: LayoutPreset
  }
  readonly landing: ResolvedLandingConfig
  readonly banner?: BannerConfig
  readonly feedback?: FeedbackConfig
  readonly llms: boolean
  readonly markdown: boolean
  readonly sitemap: boolean
  readonly rss: {
    readonly enabled: boolean
    readonly path: string
    readonly title: string
    readonly description?: string
  }
  readonly og: { readonly enabled: boolean; readonly directory: string }
  readonly prerender: boolean
  readonly search: {
    readonly staticIndex: boolean
  }
}

const normalizeBasePath = (value: string): string => {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  if (withLeadingSlash === '/') return ''
  return withLeadingSlash.replace(/\/+$/, '')
}

const resolveI18n = (
  value: I18nConfig | undefined,
  legacyLocale: string | undefined,
): ResolvedI18nConfig => {
  if (value === undefined) {
    const locale = legacyLocale ?? 'en'
    return {
      enabled: false,
      defaultLocale: locale,
      fallbackLocale: locale,
      parser: 'dir',
      hideLocale: 'never',
      locales: [
        {
          locale,
          name: locale,
          dir: 'ltr',
          ui: defaultUiTranslations,
        },
      ],
    }
  }
  const decoded = S.decodeUnknownSync(I18nConfig)(value)
  if (decoded.locales.length === 0)
    throw new TypeError('Foldocs i18n.locales must not be empty.')
  const localePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/iu
  const localeNames = new Set<string>()
  for (const locale of decoded.locales) {
    if (!localePattern.test(locale.locale))
      throw new TypeError(
        `Foldocs locale ${JSON.stringify(locale.locale)} is not a valid URL-safe locale.`,
      )
    if (localeNames.has(locale.locale))
      throw new TypeError(`Foldocs locale ${locale.locale} is duplicated.`)
    localeNames.add(locale.locale)
  }
  if (!localeNames.has(decoded.defaultLocale))
    throw new TypeError(
      `Foldocs default locale ${decoded.defaultLocale} is not listed in i18n.locales.`,
    )
  const fallbackLocale = decoded.fallbackLocale ?? decoded.defaultLocale
  if (!localeNames.has(fallbackLocale))
    throw new TypeError(
      `Foldocs fallback locale ${fallbackLocale} is not listed in i18n.locales.`,
    )
  return {
    enabled: true,
    defaultLocale: decoded.defaultLocale,
    fallbackLocale,
    parser: decoded.parser ?? 'dir',
    hideLocale: decoded.hideLocale ?? 'never',
    locales: decoded.locales.map(locale => ({
      locale: locale.locale,
      name: locale.name,
      dir: locale.dir ?? 'ltr',
      ui: { ...defaultUiTranslations, ...locale.ui },
    })),
  }
}

export const localeDefinition = (
  i18n: ResolvedI18nConfig,
  locale: string,
): ResolvedLocaleConfig =>
  i18n.locales.find(entry => entry.locale === locale) ??
  i18n.locales.find(entry => entry.locale === i18n.fallbackLocale) ??
  i18n.locales[0]!

export const interpolateTranslation = (
  value: string,
  variables: Readonly<Record<string, string | number>>,
): string =>
  Object.entries(variables).reduce(
    (result, [key, replacement]) =>
      result.replaceAll(`{${key}}`, String(replacement)),
    value,
  )

export const localeFromPathname = (
  i18n: ResolvedI18nConfig,
  pathname: string,
): string => {
  if (!i18n.enabled) return i18n.defaultLocale
  const segment = pathname.split('/').filter(Boolean)[0]
  return i18n.locales.some(entry => entry.locale === segment)
    ? segment!
    : i18n.defaultLocale
}

export const stripLocalePrefix = (
  i18n: ResolvedI18nConfig,
  pathname: string,
): string => {
  if (!i18n.enabled) return pathname
  const locale = pathname.split('/').filter(Boolean)[0]
  if (!i18n.locales.some(entry => entry.locale === locale)) return pathname
  const stripped = pathname.slice(locale!.length + 1)
  return stripped.length === 0
    ? '/'
    : stripped.startsWith('/')
      ? stripped
      : `/${stripped}`
}

export const localizedPathname = (
  i18n: ResolvedI18nConfig,
  locale: string,
  pathname: string,
): string => {
  const base = stripLocalePrefix(i18n, pathname)
  if (!i18n.enabled) return base
  if (
    i18n.hideLocale === 'always' ||
    (i18n.hideLocale === 'default-locale' && locale === i18n.defaultLocale)
  )
    return base
  return base === '/' ? `/${locale}` : `/${locale}${base}`
}

export const localeHomePath = (
  i18n: ResolvedI18nConfig,
  locale: string,
): string => localizedPathname(i18n, locale, '/')

export const defineConfig = <const Config extends FoldocsConfig>(
  config: Config,
): Config => config

export const resolveConfig = (config: FoldocsConfig): ResolvedFoldocsConfig => {
  const site = S.decodeUnknownSync(SiteConfig)(config.site)
  const i18n = resolveI18n(config.i18n, site.locale)
  if (i18n.hideLocale === 'always' && i18n.locales.length > 1)
    throw new TypeError(
      'Foldocs i18n.hideLocale "always" requires a single locale in a static application; use "default-locale" for multilingual static output.',
    )
  const landing = S.decodeUnknownSync(LandingConfig)(config.landing ?? {})
  const banner =
    config.banner === undefined
      ? undefined
      : S.decodeUnknownSync(BannerConfig)(config.banner)
  const feedback =
    config.feedback === undefined
      ? undefined
      : S.decodeUnknownSync(FeedbackConfig)(config.feedback)
  const landingSections = landing.sections ?? defaultLandingSections
  if (landingSections.length === 0 || !landingSections.includes('hero'))
    throw new TypeError(
      'Foldocs landing.sections must include hero so the page has a primary heading.',
    )
  if (new Set(landingSections).size !== landingSections.length)
    throw new TypeError('Foldocs landing.sections must not contain duplicates.')
  return {
    site: { ...site, locale: i18n.defaultLocale },
    i18n,
    content: {
      dir: config.content?.dir ?? 'content/docs',
      sources: config.content?.sources ?? [],
      lastModified: config.content?.lastModified ?? 'git',
    },
    basePath: normalizeBasePath(config.basePath ?? '/docs'),
    layout: {
      preset: S.decodeUnknownSync(LayoutPreset)(
        config.layout?.preset ?? 'docs',
      ),
    },
    landing: {
      sections: landingSections,
      ...(landing.headline === undefined ? {} : { headline: landing.headline }),
      ...(landing.description === undefined
        ? {}
        : { description: landing.description }),
      command: landing.command ?? 'pnpm create foldocs@latest',
      ...(landing.footer === undefined ? {} : { footer: landing.footer }),
    },
    ...(banner === undefined ? {} : { banner }),
    ...(feedback === undefined ? {} : { feedback }),
    llms: config.llms ?? true,
    markdown: config.markdown ?? true,
    sitemap: config.sitemap ?? true,
    rss: {
      enabled: config.rss === true || typeof config.rss === 'object',
      path:
        typeof config.rss === 'object'
          ? (config.rss.path ?? 'rss.xml').replace(/^\/+|\/+$/gu, '')
          : 'rss.xml',
      title:
        typeof config.rss === 'object'
          ? (config.rss.title ?? site.title)
          : site.title,
      ...(typeof config.rss === 'object' && config.rss.description !== undefined
        ? { description: config.rss.description }
        : site.description === undefined
          ? {}
          : { description: site.description }),
    },
    og: {
      enabled: config.og === true || typeof config.og === 'object',
      directory:
        typeof config.og === 'object'
          ? (config.og.directory ?? 'og').replace(/^\/+|\/+$/gu, '')
          : 'og',
    },
    prerender: config.prerender ?? true,
    search: {
      staticIndex: config.search?.staticIndex ?? true,
    },
  }
}
