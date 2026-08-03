import { Option } from 'effect'
import {
  type Attribute,
  type ChildAttribute,
  type Html,
  type HtmlBuilder,
  childAttributes,
} from 'foldkit/html'
import type {
  BannerConfig,
  FeedbackConfig,
  LandingFooterConfig,
  LayoutPreset,
  NavigationNode,
  NavigationTab,
  PageManifestEntry,
  ResolvedLandingConfig,
  ResolvedUiTranslations,
  SiteConfig,
} from 'foldocs-core'
import { interpolateTranslation, navigationContextForUrl } from 'foldocs-core'
import type { CompiledPage } from 'foldocs-mdx'

import { Button, Dialog, Disclosure, Menu, Tooltip } from '@foldkit/ui'
import type { TocItem } from '@foldocs/content'
import type { SearchResult } from '@foldocs/search'

import {
  type IconName,
  foldocsLogoSvg,
  icons,
  navigationIconSvg,
} from './icons.js'
import { type MarkdownViewOptions, renderMarkdown } from './markdown.js'

export type ThemePreference = 'light' | 'system' | 'dark'

const LanguageMenu = Menu.create<string>()
const LayoutTabsMenu = Menu.create<string>()
const PageOpenMenu = Menu.create<string>()
export const headerLanguageMenuId = 'foldocs-header-language'
export const sidebarLanguageMenuId = 'foldocs-sidebar-language'
export const layoutTabsMenuId = 'foldocs-layout-tabs'
export const pageOpenMenuId = 'foldocs-page-open'
export const landingCopyTooltipId = 'foldocs-landing-copy'
export const initLandingCopyTooltip = (): Tooltip.Model =>
  Tooltip.init({ id: landingCopyTooltipId, showDelay: 300 })
export const searchDialogId = 'foldocs-search'
export const sidebarDialogId = 'foldocs-sidebar-dialog'
export const aiDialogId = 'foldocs-ai-dialog'
export const LanguageMenuModel = Menu.Model
export type LanguageMenuModel = Menu.Model
export const LanguageMenuMessage = Menu.Message
export type LanguageMenuMessage = Menu.Message
export const initLanguageMenu = (id: string): LanguageMenuModel =>
  Menu.init({ id })
export const DocsMenuModel = Menu.Model
export type DocsMenuModel = Menu.Model
export const DocsMenuMessage = Menu.Message
export type DocsMenuMessage = Menu.Message
export const initDocsMenu = (id: string): DocsMenuModel => Menu.init({ id })
export const FoldocsDialogModel = Dialog.Model
export type FoldocsDialogModel = Dialog.Model
export const FoldocsDialogMessage = Dialog.Message
export type FoldocsDialogMessage = Dialog.Message
export const initSearchDialog = (): FoldocsDialogModel =>
  Dialog.init({
    id: searchDialogId,
    isAnimated: true,
    focusSelector: '#fd-search-input',
  })
export const initSidebarDialog = (): FoldocsDialogModel =>
  Dialog.init({
    id: sidebarDialogId,
    isAnimated: true,
    focusSelector: '#fd-sidebar a[href]',
  })
export const initAiDialog = (): FoldocsDialogModel =>
  Dialog.init({
    id: aiDialogId,
    isAnimated: true,
    focusSelector: '#fd-ai-input',
  })

interface SearchActions<Message> {
  readonly toggleSearch: Message
  readonly closeSearch: Message
  readonly updateSearch: (query: string) => Message
  readonly searchKeyDown: (key: string) => Message
  readonly selectSearchResult: (url: string) => Message
  readonly toggleSearchTag: (tag: string) => Message
  readonly gotSearchDialogMessage?: (message: FoldocsDialogMessage) => Message
}

interface SearchOptions<Message> {
  readonly searchOpen: boolean
  readonly searchQuery: string
  readonly searchResults: ReadonlyArray<SearchResult>
  readonly searchLoading: boolean
  readonly searchError: string
  readonly activeSearchResultIndex: number
  readonly availableSearchTags: ReadonlyArray<string>
  readonly selectedSearchTags: ReadonlyArray<string>
  readonly translations: ResolvedUiTranslations
  readonly searchDialog?: FoldocsDialogModel
  readonly actions: SearchActions<Message>
}

export interface LocaleLink {
  readonly locale: string
  readonly name: string
  readonly dir: 'ltr' | 'rtl'
  readonly href: string
  readonly current: boolean
}

export interface DocsAiSource {
  readonly title: string
  readonly url: string
}

export interface DocsAiMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
  readonly sources?: ReadonlyArray<DocsAiSource>
}

export interface DocsAiState {
  readonly open: boolean
  readonly input: string
  readonly loading: boolean
  readonly error: string
  readonly messages: ReadonlyArray<DocsAiMessage>
}

export interface DocsLayoutActions<Message> extends SearchActions<Message> {
  readonly toggleSidebar: Message
  readonly closeSidebar: Message
  readonly toggleSidebarGroup: (key: string) => Message
  readonly setMobileTocOpen: (open: boolean) => Message
  readonly selectToc: (id: string) => Message
  readonly selectTheme: (preference: ThemePreference) => Message
  readonly copyMarkdown: Message
  readonly dismissBanner: Message
  readonly openImage: (url: string, alt: string) => Message
  readonly closeImage: Message
  readonly submitFeedback: (rating: 'positive' | 'negative') => Message
  readonly openAi?: Message
  readonly closeAi?: Message
  readonly updateAiInput?: (value: string) => Message
  readonly submitAi?: Message
  readonly gotAiDialogMessage?: (message: FoldocsDialogMessage) => Message
  readonly gotSidebarDialogMessage?: (message: FoldocsDialogMessage) => Message
  readonly gotHeaderLanguageMenuMessage?: (
    message: LanguageMenuMessage,
  ) => Message
  readonly gotSidebarLanguageMenuMessage?: (
    message: LanguageMenuMessage,
  ) => Message
  readonly gotLayoutTabsMenuMessage?: (message: DocsMenuMessage) => Message
  readonly gotPageOpenMenuMessage?: (message: DocsMenuMessage) => Message
}

export interface DocsLayoutOptions<Message> extends SearchOptions<Message> {
  readonly site: SiteConfig
  readonly preset?: LayoutPreset
  readonly navigation: ReadonlyArray<NavigationNode>
  readonly tabs: ReadonlyArray<NavigationTab>
  readonly currentUrl: string
  readonly page: CompiledPage
  readonly lastModified?: string
  readonly previous?: PageManifestEntry<CompiledPage>
  readonly next?: PageManifestEntry<CompiledPage>
  readonly sidebarOpen: boolean
  readonly sidebarDialog?: FoldocsDialogModel
  readonly collapsedSidebarGroups: ReadonlyArray<string>
  readonly activeTocId: string
  readonly mobileTocOpen: boolean
  readonly narrowViewport: boolean
  readonly theme: 'light' | 'dark'
  readonly themePreference: ThemePreference
  readonly docsUrl: string
  readonly homeUrl: string
  readonly locales: ReadonlyArray<LocaleLink>
  readonly currentLocale: string
  readonly headerLanguageMenu?: LanguageMenuModel
  readonly sidebarLanguageMenu?: LanguageMenuModel
  readonly layoutTabsMenu?: DocsMenuModel
  readonly pageOpenMenu?: DocsMenuModel
  readonly markdownUrl: string
  readonly markdownEnabled: boolean
  readonly footer?: LandingFooterConfig
  readonly banner?: BannerConfig
  readonly bannerDismissed: boolean
  readonly feedback?: FeedbackConfig
  readonly feedbackStatus: 'idle' | 'submitting' | 'submitted' | 'error'
  readonly imagePreview?: { readonly url: string; readonly alt: string }
  readonly ai?: DocsAiState
  readonly aiDialog?: FoldocsDialogModel
  readonly copyMarkdownStatus: 'idle' | 'loading' | 'copied' | 'error'
  readonly actions: DocsLayoutActions<Message>
  readonly markdown?: MarkdownViewOptions<Message>
}

export interface LandingLayoutActions<Message> extends SearchActions<Message> {
  readonly selectTheme: (preference: ThemePreference) => Message
  readonly copyText: (value: string) => Message
  readonly openExternal: (url: string) => Message
  readonly dismissBanner: Message
  readonly gotHeaderLanguageMenuMessage?: (
    message: LanguageMenuMessage,
  ) => Message
  readonly gotCopyTooltipMessage?: (message: Tooltip.Message) => Message
}

export interface LandingLayoutOptions<Message> extends SearchOptions<Message> {
  readonly site: SiteConfig
  readonly landing: ResolvedLandingConfig
  readonly docsUrl: string
  readonly homeUrl: string
  readonly locales: ReadonlyArray<LocaleLink>
  readonly currentLocale: string
  readonly headerLanguageMenu?: LanguageMenuModel
  readonly theme: 'light' | 'dark'
  readonly themePreference: ThemePreference
  readonly copiedText: string
  readonly copyTooltip?: Tooltip.Model
  readonly banner?: BannerConfig
  readonly bannerDismissed: boolean
  readonly actions: LandingLayoutActions<Message>
}

const icon = <Message>(
  name: IconName,
  h: HtmlBuilder<Message>,
  className?: string,
): Html => {
  return h.span(
    [
      h.Class(`fd-icon${className === undefined ? '' : ` ${className}`}`),
      h.InnerHTML(icons[name]),
    ],
    [],
  )
}

const bannerView = <Message>(
  banner: BannerConfig | undefined,
  dismissed: boolean,
  dismiss: Message,
  dismissLabel: string,
  h: HtmlBuilder<Message>,
): Html => {
  if (banner === undefined || dismissed) return h.empty
  const content =
    banner.href === undefined
      ? h.span([], [banner.content])
      : h.a([h.Href(banner.href)], [banner.content])
  return h.aside(
    [
      h.Class(
        `fd-banner${banner.variant === 'rainbow' ? ' fd-banner-rainbow' : ''}`,
      ),
      h.DataAttribute('banner-id', banner.id ?? ''),
    ],
    [
      content,
      ...(banner.dismissible === false
        ? []
        : [
            h.button(
              [
                h.Type('button'),
                h.Class('fd-banner-dismiss'),
                h.OnClick(dismiss),
                h.AriaLabel(dismissLabel),
              ],
              [icon('close', h)],
            ),
          ]),
    ],
  )
}

const navigationIcon = <Message>(
  name: string | undefined,
  customIcons: Readonly<Record<string, string>> | undefined,
  h: HtmlBuilder<Message>,
): Html => {
  if (name === undefined) return h.empty
  const svg = navigationIconSvg(name, customIcons)
  return svg === undefined
    ? h.empty
    : h.span(
        [h.Class('fd-navigation-icon'), h.AriaHidden(true), h.InnerHTML(svg)],
        [],
      )
}

const brandView = <Message>(
  site: SiteConfig,
  h: HtmlBuilder<Message>,
  homeUrl = '/',
  homeLabel = 'home',
): Html => {
  return h.a(
    [
      h.Class('fd-brand'),
      h.Href(homeUrl),
      h.AriaLabel(`${site.title} ${homeLabel}`),
    ],
    [
      h.span(
        [
          h.Class('fd-brand-mark'),
          h.AriaHidden(true),
          h.InnerHTML(foldocsLogoSvg),
        ],
        [],
      ),
      h.span([h.Class('fd-brand-name')], [site.logoText ?? site.title]),
      ...(site.badge === undefined
        ? []
        : [h.span([h.Class('fd-brand-badge')], [site.badge])]),
    ],
  )
}

const themeSelector = <Message>(
  preference: ThemePreference,
  selectTheme: (preference: ThemePreference) => Message,
  translations: ResolvedUiTranslations,
  h: HtmlBuilder<Message>,
): Html => {
  const entries = [
    ['light', translations.lightTheme, 'light'],
    ['system', translations.systemTheme, 'system'],
    ['dark', translations.darkTheme, 'dark'],
  ] as const
  return h.div(
    [
      h.Class('fd-theme-selector'),
      h.Role('group'),
      h.AriaLabel(translations.colorTheme),
    ],
    entries.map(([value, label, iconName]) =>
      Button.view(
        {
          onClick: selectTheme(value),
          toView: ({ button }) =>
            h.button(
              [
                ...button,
                h.Class(
                  `fd-control fd-control-ghost fd-control-icon${value === preference ? ' fd-theme-active' : ''}`,
                ),
                h.AriaLabel(label),
                h.Title(label),
                h.Attribute('aria-pressed', String(value === preference)),
              ],
              [icon(iconName, h)],
            ),
        },
        h,
      ),
    ),
  )
}

const socialLinks = <Message>(
  site: SiteConfig,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const entries = [
    [site.githubUrl, 'GitHub', 'github'],
    [site.discordUrl, 'Discord', 'discord'],
    [site.xUrl, 'X', 'x'],
    [site.npmUrl, 'npm', 'npm'],
  ] as const
  return entries.flatMap(([href, label, iconName]) =>
    href === undefined
      ? []
      : [
          h.a(
            [
              h.Class('fd-social-link'),
              h.Href(href),
              h.Target('_blank'),
              h.Rel('noreferrer noopener'),
              h.AriaLabel(label),
              h.Title(label),
            ],
            [
              icon(
                iconName,
                h,
                iconName === 'npm' ? 'fd-social-npm-icon' : 'fd-social-icon',
              ),
            ],
          ),
        ],
  )
}

const siteFooterView = <Message>(
  site: SiteConfig,
  footer: LandingFooterConfig | undefined,
  className: string,
  h: HtmlBuilder<Message>,
): Html => {
  const author = footer?.author
  return h.footer(
    [h.Class(`fd-site-footer ${className}`)],
    [
      h.div(
        [h.Class('fd-site-footer-left')],
        [
          h.p(
            [],
            [
              ...(author === undefined
                ? ['Built with Foldocs. ']
                : [
                    'Built by ',
                    footer?.authorUrl === undefined
                      ? author
                      : h.a(
                          [
                            h.Href(footer.authorUrl),
                            h.Target('_blank'),
                            h.Rel('noreferrer noopener'),
                          ],
                          [author],
                        ),
                    '. ',
                  ]),
              ...(site.githubUrl === undefined
                ? []
                : [
                    'The source code is available on ',
                    h.a(
                      [
                        h.Href(site.githubUrl),
                        h.Target('_blank'),
                        h.Rel('noreferrer noopener'),
                      ],
                      ['GitHub'],
                    ),
                    '.',
                  ]),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('fd-site-footer-right')],
        [
          ...(footer?.copyright === undefined
            ? []
            : [
                h.span(
                  [h.Class('fd-site-footer-copyright')],
                  [footer.copyright],
                ),
              ]),
          ...(footer?.twitterUrl === undefined
            ? []
            : [
                h.a(
                  [
                    h.Class(
                      'fd-control fd-control-ghost fd-control-icon fd-footer-social-button',
                    ),
                    h.Href(footer.twitterUrl),
                    h.Target('_blank'),
                    h.Rel('noreferrer noopener'),
                    h.AriaLabel('Tarkaworks on X'),
                    h.Title('Tarkaworks on X'),
                  ],
                  [icon('x', h)],
                ),
              ]),
        ],
      ),
    ],
  )
}

const languageSelector = <Message>(
  locales: ReadonlyArray<LocaleLink>,
  translations: ResolvedUiTranslations,
  model: LanguageMenuModel | undefined,
  slotId: string,
  menuId: string,
  toParentMessage: ((message: LanguageMenuMessage) => Message) | undefined,
  h: HtmlBuilder<Message>,
  placement: 'bottom-end' | 'top-start' = 'bottom-end',
): Html => {
  if (locales.length <= 1) return h.empty
  const current = locales.find(locale => locale.current) ?? locales[0]!
  const localeForHref = (href: string): LocaleLink =>
    locales.find(locale => locale.href === href) ?? current
  const buttonContent = h.span(
    [h.Class('fd-language-trigger-content')],
    [
      icon('globe', h),
      h.span([h.Class('fd-language-current')], [current.name]),
      icon('chevron', h, 'fd-language-chevron'),
    ],
  )

  if (model === undefined || toParentMessage === undefined) {
    return h.div(
      [h.Class('fd-language-selector')],
      [
        h.button(
          [
            h.Id(Menu.buttonId(menuId)),
            h.Type('button'),
            h.AriaHasPopup('menu'),
            h.AriaExpanded(false),
            h.AriaControls(`${menuId}-items`),
            h.AriaLabel(translations.selectLanguage),
            h.Title(translations.selectLanguage),
            h.Class('fd-control fd-control-outline fd-language-trigger'),
          ],
          [buttonContent],
        ),
      ],
    )
  }

  return h.submodel({
    slotId,
    model,
    view: LanguageMenu.view,
    viewInputs: {
      items: locales.map(locale => locale.href),
      itemToSearchText: href => localeForHref(href).name,
      itemToConfig: (href, { isActive }) => {
        const locale = localeForHref(href)
        return {
          className: [
            'fd-language-option',
            ...(locale.current ? ['fd-language-active'] : []),
            ...(isActive ? ['fd-language-option-active'] : []),
          ].join(' '),
          content: h.span(
            [
              h.Class('fd-language-option-content'),
              h.Attribute('lang', locale.locale),
              h.Attribute('dir', locale.dir),
            ],
            [
              h.span([], [locale.name]),
              locale.current ? icon('check', h) : h.empty,
            ],
          ),
        }
      },
      buttonContent,
      buttonClassName: 'fd-control fd-control-outline fd-language-trigger',
      buttonAttributes: childAttributes([h.Title(translations.selectLanguage)]),
      itemsClassName: 'fd-language-menu',
      backdropClassName: 'fd-language-backdrop',
      className: 'fd-language-selector',
      ariaLabel: translations.selectLanguage,
      anchor: {
        placement,
        gap: 7,
        padding: 8,
        isPlacementLocked: true,
      },
    },
    toParentMessage,
  })
}

const searchTrigger = <Message>(
  action: Message,
  expanded: boolean,
  translations: ResolvedUiTranslations,
  h: HtmlBuilder<Message>,
  mobile = false,
): Html => {
  return Button.view(
    {
      onClick: action,
      toView: ({ button }) =>
        h.button(
          [
            ...button,
            h.Class(
              mobile
                ? 'fd-control fd-control-ghost fd-control-icon fd-search-trigger fd-search-trigger-mobile'
                : 'fd-control fd-control-outline fd-search-trigger',
            ),
            h.Id(mobile ? 'fd-search-trigger-mobile' : 'fd-search-trigger'),
            h.AriaExpanded(expanded),
            h.AriaHasPopup('dialog'),
            h.AriaLabel(translations.searchDocumentation),
            h.Title(translations.searchDocumentation),
          ],
          mobile
            ? [icon('search', h)]
            : [
                icon('search', h),
                h.span([], [translations.search]),
                h.kbd([], ['⌘K']),
              ],
        ),
    },
    h,
  )
}

const headerActions = <Message>(
  site: SiteConfig,
  preference: ThemePreference,
  selectTheme: (preference: ThemePreference) => Message,
  searchAction: Message,
  searchOpen: boolean,
  locales: ReadonlyArray<LocaleLink>,
  translations: ResolvedUiTranslations,
  languageMenu: LanguageMenuModel | undefined,
  gotLanguageMenuMessage:
    ((message: LanguageMenuMessage) => Message) | undefined,
  h: HtmlBuilder<Message>,
  mobileMenu?: Html,
): Html => {
  return h.div(
    [h.Class('fd-header-actions')],
    [
      searchTrigger(searchAction, searchOpen, translations, h),
      searchTrigger(searchAction, searchOpen, translations, h, true),
      languageSelector(
        locales,
        translations,
        languageMenu,
        'header-language-menu',
        headerLanguageMenuId,
        gotLanguageMenuMessage,
        h,
      ),
      themeSelector(preference, selectTheme, translations, h),
      h.div(
        [h.Class('fd-social-links fd-social-links-header')],
        socialLinks(site, h),
      ),
      ...(mobileMenu === undefined ? [] : [mobileMenu]),
    ],
  )
}

const headerView = <Message>(
  site: SiteConfig,
  homeUrl: string,
  preference: ThemePreference,
  selectTheme: (preference: ThemePreference) => Message,
  searchAction: Message,
  searchOpen: boolean,
  locales: ReadonlyArray<LocaleLink>,
  translations: ResolvedUiTranslations,
  languageMenu: LanguageMenuModel | undefined,
  gotLanguageMenuMessage:
    ((message: LanguageMenuMessage) => Message) | undefined,
  h: HtmlBuilder<Message>,
  options: {
    readonly attributes?: ReadonlyArray<Attribute<Message>>
    readonly className?: string
    readonly mobileMenu?: Html
  } = {},
): Html =>
  h.header(
    [
      h.Class(
        `fd-header fd-docs-header${options.className === undefined ? '' : ` ${options.className}`}`,
      ),
      ...(options.attributes ?? []),
    ],
    [
      h.div(
        [h.Class('fd-header-inner')],
        [
          brandView(site, h, homeUrl, translations.home),
          headerActions(
            site,
            preference,
            selectTheme,
            searchAction,
            searchOpen,
            locales,
            translations,
            languageMenu,
            gotLanguageMenuMessage,
            h,
            options.mobileMenu,
          ),
        ],
      ),
    ],
  )

const navigationView = <Message>(
  nodes: ReadonlyArray<NavigationNode>,
  currentUrl: string,
  collapsedGroups: ReadonlyArray<string>,
  closeSidebar: Message,
  toggleGroup: (key: string) => Message,
  customIcons: Readonly<Record<string, string>> | undefined,
  h: HtmlBuilder<Message>,
  parentKey = '',
  depth = 0,
): ReadonlyArray<Html> => {
  const externalUrl = (url: string): boolean => /^(?:https?:)?\/\//iu.test(url)
  return nodes.map(node => {
    if (node._tag === 'Separator') {
      return h.li(
        [h.Class('fd-sidebar-section')],
        [
          navigationIcon(node.icon, customIcons, h),
          h.span([h.Class('fd-sidebar-section-label')], [node.label]),
        ],
      )
    }
    if (node._tag === 'Page' || node._tag === 'Link') {
      const active = node.url === currentUrl
      const external =
        node._tag === 'Link' && (node.external || externalUrl(node.url))
      return h.li(
        [],
        [
          h.a(
            [
              h.Href(node.url),
              h.Class(
                `fd-sidebar-link${depth === 0 ? ' fd-sidebar-link-root' : ''}${active ? ' fd-sidebar-link-active' : ''}`,
              ),
              h.DataAttribute('depth', String(depth)),
              h.OnClick(closeSidebar),
              ...(external
                ? [h.Target('_blank'), h.Rel('noreferrer noopener')]
                : []),
              ...(active ? [h.AriaCurrent('page')] : []),
            ],
            [
              navigationIcon(node.icon, customIcons, h),
              h.span([h.Class('fd-sidebar-item-label')], [node.label]),
            ],
          ),
        ],
      )
    }
    const key = `${parentKey}/${node.segment}`
    const disclosureId = `fd-sidebar-folder-${key.replace(/[^a-z0-9_-]+/giu, '-')}`
    const folderIndexActive = node.index?.url === currentUrl
    const collapsed = node.collapsible && collapsedGroups.includes(key)
    return h.li(
      [
        h.Class(
          `fd-sidebar-folder${depth === 0 ? ' fd-sidebar-folder-root' : ''}${folderIndexActive ? ' fd-sidebar-folder-active' : ''}${collapsed ? ' fd-sidebar-folder-collapsed' : ''}`,
        ),
      ],
      [
        Disclosure.view(
          {
            id: disclosureId,
            isOpen: !collapsed,
            onToggle: () => toggleGroup(key),
            isDisabled: !node.collapsible,
            toView: ({ button, panel, animatePanel }) =>
              h.div(
                [],
                [
                  node.index === undefined
                    ? h.button(
                        [
                          ...button,
                          h.Class('fd-sidebar-folder-label'),
                          h.DataAttribute('depth', String(depth)),
                        ],
                        [
                          h.span(
                            [h.Class('fd-sidebar-item-content')],
                            [
                              navigationIcon(node.icon, customIcons, h),
                              h.span(
                                [h.Class('fd-sidebar-item-label')],
                                [node.label],
                              ),
                            ],
                          ),
                          ...(node.collapsible
                            ? [icon('chevron', h, 'fd-sidebar-chevron')]
                            : []),
                        ],
                      )
                    : h.a(
                        [
                          h.Id(`${disclosureId}-button`),
                          h.Href(node.index.url),
                          h.Class(
                            'fd-sidebar-folder-label fd-sidebar-folder-index',
                          ),
                          h.DataAttribute('depth', String(depth)),
                          h.AriaExpanded(!collapsed),
                          h.AriaControls(`${disclosureId}-panel`),
                          ...(node.collapsible
                            ? [h.OnClick(toggleGroup(key))]
                            : []),
                          h.OnClick(closeSidebar),
                          ...(!collapsed ? [h.DataAttribute('open', '')] : []),
                          ...(node.index.url === currentUrl
                            ? [h.AriaCurrent('page')]
                            : []),
                        ],
                        [
                          h.span(
                            [h.Class('fd-sidebar-item-content')],
                            [
                              navigationIcon(node.icon, customIcons, h),
                              h.span(
                                [h.Class('fd-sidebar-item-label')],
                                [node.label],
                              ),
                            ],
                          ),
                          ...(node.collapsible
                            ? [icon('chevron', h, 'fd-sidebar-chevron')]
                            : []),
                        ],
                      ),
                  animatePanel(
                    h.div(
                      [
                        ...panel,
                        h.Class('fd-sidebar-group-panel'),
                        ...(collapsed ? [h.Attribute('inert', '')] : []),
                      ],
                      [
                        h.ul(
                          [],
                          navigationView(
                            node.children,
                            currentUrl,
                            collapsedGroups,
                            closeSidebar,
                            toggleGroup,
                            customIcons,
                            h,
                            key,
                            depth + 1,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
          },
          h,
        ),
      ],
    )
  })
}

const layoutTabsView = <Message>(
  tabs: ReadonlyArray<NavigationTab>,
  translations: ResolvedUiTranslations,
  model: DocsMenuModel | undefined,
  toParentMessage: ((message: DocsMenuMessage) => Message) | undefined,
  customIcons: Readonly<Record<string, string>> | undefined,
  h: HtmlBuilder<Message>,
): Html => {
  const current = tabs.find(tab => tab.current)
  if (current === undefined) return h.empty
  const tabForUrl = (url: string): NavigationTab =>
    tabs.find(tab => tab.url === url) ?? current
  const buttonContent = h.span(
    [h.Class('fd-layout-tabs-trigger-content')],
    [
      navigationIcon(current.icon, customIcons, h),
      h.span(
        [h.Class('fd-layout-tab-current')],
        [
          h.strong([], [current.title]),
          ...(current.description === undefined
            ? []
            : [h.span([], [current.description])]),
        ],
      ),
      icon('chevron', h, 'fd-layout-tabs-chevron'),
    ],
  )

  if (model === undefined || toParentMessage === undefined) {
    return h.div(
      [h.Class('fd-layout-tabs')],
      [
        h.button(
          [
            h.Id(Menu.buttonId(layoutTabsMenuId)),
            h.Type('button'),
            h.AriaHasPopup('menu'),
            h.AriaExpanded(false),
            h.AriaControls(`${layoutTabsMenuId}-items`),
            h.AriaLabel(translations.selectDocumentation),
            h.Title(translations.selectDocumentation),
            h.Class('fd-control fd-control-outline'),
          ],
          [buttonContent],
        ),
      ],
    )
  }

  return h.submodel({
    slotId: 'layout-tabs-menu',
    model,
    view: LayoutTabsMenu.view,
    viewInputs: {
      items: tabs.map(tab => tab.url),
      itemToSearchText: url => tabForUrl(url).title,
      itemToConfig: (url, { isActive }) => {
        const tab = tabForUrl(url)
        return {
          className: [
            'fd-layout-tab-option',
            ...(tab.current ? ['fd-layout-tab-active'] : []),
            ...(isActive ? ['fd-layout-tab-option-active'] : []),
          ].join(' '),
          content: h.span(
            [h.Class('fd-layout-tab-option-content')],
            [
              navigationIcon(tab.icon, customIcons, h),
              h.span(
                [h.Class('fd-layout-tab-copy')],
                [
                  h.strong([], [tab.title]),
                  ...(tab.description === undefined
                    ? []
                    : [h.span([], [tab.description])]),
                ],
              ),
              ...(tab.current ? [icon('check', h)] : []),
            ],
          ),
        }
      },
      buttonContent,
      buttonClassName: 'fd-control fd-control-outline',
      itemsClassName: 'fd-layout-tabs-menu',
      backdropClassName: 'fd-layout-tabs-backdrop',
      className: 'fd-layout-tabs',
      ariaLabel: translations.selectDocumentation,
      anchor: {
        placement: 'bottom-start',
        gap: 6,
        padding: 8,
        isPlacementLocked: true,
      },
    },
    toParentMessage,
  })
}

const tocItemsView = <Message>(
  toc: ReadonlyArray<TocItem>,
  activeTocId: string,
  selectToc: (id: string) => Message,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  return toc.map(item => {
    const active = item.id === activeTocId
    return h.keyed('li')(
      item.id,
      [h.Class(`fd-toc-depth-${item.depth}`)],
      [
        h.a(
          [
            h.Href(`#${item.id}`),
            h.OnClick(selectToc(item.id)),
            ...(active ? [h.AriaCurrent('location')] : []),
            h.Class(active ? 'fd-toc-link-active' : ''),
          ],
          [item.title],
        ),
      ],
    )
  })
}

const tocView = <Message>(
  toc: ReadonlyArray<TocItem>,
  activeTocId: string,
  selectToc: (id: string) => Message,
  translations: ResolvedUiTranslations,
  h: HtmlBuilder<Message>,
): Html => {
  return h.aside(
    [h.Class('fd-toc-shell')],
    [
      h.nav(
        [h.Class('fd-toc'), h.AriaLabel(translations.onThisPage)],
        [
          h.div([h.Class('fd-toc-title')], [translations.onThisPage]),
          h.ul([], tocItemsView(toc, activeTocId, selectToc, h)),
        ],
      ),
    ],
  )
}

const mobileTocView = <Message>(
  toc: ReadonlyArray<TocItem>,
  activeTocId: string,
  open: boolean,
  setOpen: (open: boolean) => Message,
  selectToc: (id: string) => Message,
  translations: ResolvedUiTranslations,
  h: HtmlBuilder<Message>,
): Html => {
  if (toc.length === 0) return h.empty
  const activeTitle =
    toc.find(item => item.id === activeTocId)?.title ?? toc[0]?.title ?? ''
  return h.details(
    [h.Class('fd-mobile-toc'), h.Open(open), h.OnToggle(setOpen)],
    [
      h.summary(
        [],
        [
          h.span([h.Class('fd-mobile-toc-label')], [translations.onThisPage]),
          h.span([h.Class('fd-mobile-toc-current')], [activeTitle]),
          icon('chevron', h, 'fd-mobile-toc-chevron'),
        ],
      ),
      h.nav(
        [h.AriaLabel(translations.tableOfContents)],
        [h.ul([], tocItemsView(toc, activeTocId, selectToc, h))],
      ),
    ],
  )
}

const searchResultId = (index: number): string => `fd-search-result-${index}`

const escapeRegularExpression = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')

const highlightedSearchText = <Message>(
  value: string,
  query: string,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html | string> => {
  const terms = [
    ...new Set(
      query
        .trim()
        .split(/\s+/gu)
        .map(term => term.trim())
        .filter(term => term.length > 0),
    ),
  ].sort((left, right) => right.length - left.length)
  if (terms.length === 0) return [value]
  const expression = new RegExp(
    `(${terms.map(escapeRegularExpression).join('|')})`,
    'giu',
  )
  const normalizedTerms = new Set(terms.map(term => term.toLocaleLowerCase()))
  return value
    .split(expression)
    .map(part =>
      normalizedTerms.has(part.toLocaleLowerCase())
        ? h.mark([h.Class('fd-search-match')], [part])
        : part,
    )
}

const searchDialogView = <Message>(
  options: SearchOptions<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const t = options.translations
  if (
    options.searchDialog === undefined ||
    options.actions.gotSearchDialogMessage === undefined
  )
    return h.empty
  return h.submodel({
    slotId: options.searchDialog.id,
    model: options.searchDialog,
    view: Dialog.view,
    viewInputs: {
      toView: ({
        dialog,
        backdrop,
        panel,
        title,
        description,
        initialFocus,
        isVisible,
      }) =>
        h.dialog(
          [...dialog, h.Class('fd-search-layer')],
          isVisible
            ? [
                h.div(
                  [
                    ...backdrop,
                    h.Class('fd-search-backdrop'),
                    h.AriaHidden(true),
                  ],
                  [],
                ),
                h.div(
                  [h.Class('fd-search-positioner')],
                  [
                    h.div(
                      [
                        ...panel,
                        h.Class('fd-search-dialog'),
                        h.AriaLabel(t.searchDocumentation),
                      ],
                      [
                        h.h2(
                          [...title, h.Class('fd-sr-only')],
                          [t.searchDocumentation],
                        ),
                        h.p(
                          [...description, h.Class('fd-sr-only')],
                          [t.searchPrompt],
                        ),
                        h.div(
                          [h.Class('fd-search-input-wrap')],
                          [
                            icon('search', h),
                            h.input([
                              ...initialFocus,
                              h.Id('fd-search-input'),
                              h.Class('fd-search-input'),
                              h.Type('text'),
                              h.Role('combobox'),
                              h.AriaExpanded(options.searchResults.length > 0),
                              h.AriaControls('fd-search-results'),
                              h.AriaHasPopup('listbox'),
                              h.AriaAutocomplete('list'),
                              h.AriaLabel(t.searchDocumentation),
                              ...(options.activeSearchResultIndex >= 0
                                ? [
                                    h.AriaActiveDescendant(
                                      searchResultId(
                                        options.activeSearchResultIndex,
                                      ),
                                    ),
                                  ]
                                : []),
                              h.Autocomplete('off'),
                              h.Value(options.searchQuery),
                              h.Placeholder(`${t.searchDocumentation}…`),
                              h.OnInput(options.actions.updateSearch),
                              h.OnKeyDownPreventDefault(key =>
                                key === 'ArrowDown' ||
                                key === 'ArrowUp' ||
                                key === 'Enter'
                                  ? Option.some(
                                      options.actions.searchKeyDown(key),
                                    )
                                  : Option.none(),
                              ),
                            ]),
                          ],
                        ),
                        ...(options.availableSearchTags.length === 0
                          ? []
                          : [
                              h.div(
                                [
                                  h.Class('fd-search-filters'),
                                  h.Role('group'),
                                  h.AriaLabel(t.searchFilters),
                                ],
                                options.availableSearchTags.map(tag => {
                                  const selected =
                                    options.selectedSearchTags.includes(tag)
                                  return h.button(
                                    [
                                      h.Type('button'),
                                      h.Class(
                                        `fd-search-filter${selected ? ' fd-search-filter-active' : ''}`,
                                      ),
                                      h.Attribute(
                                        'aria-pressed',
                                        String(selected),
                                      ),
                                      h.OnClick(
                                        options.actions.toggleSearchTag(tag),
                                      ),
                                    ],
                                    [tag],
                                  )
                                }),
                              ),
                            ]),
                        h.div(
                          [
                            h.Id('fd-search-results'),
                            h.Class('fd-search-results'),
                            h.Role('listbox'),
                            h.AriaLabel(t.searchResults),
                          ],
                          [
                            ...(options.searchQuery.trim().length === 0
                              ? [
                                  h.p(
                                    [h.Class('fd-search-empty')],
                                    [t.searchPrompt],
                                  ),
                                ]
                              : options.searchLoading &&
                                  options.searchResults.length === 0
                                ? [
                                    h.p(
                                      [
                                        h.Class('fd-search-empty'),
                                        h.AriaLive('polite'),
                                      ],
                                      [t.searching],
                                    ),
                                  ]
                                : options.searchError.length > 0
                                  ? [
                                      h.p(
                                        [
                                          h.Class('fd-search-empty'),
                                          h.AriaLive('polite'),
                                        ],
                                        [t.searchUnavailable],
                                      ),
                                    ]
                                  : options.searchResults.length === 0
                                    ? [
                                        h.p(
                                          [
                                            h.Class('fd-search-empty'),
                                            h.AriaLive('polite'),
                                          ],
                                          [
                                            interpolateTranslation(
                                              t.noSearchResults,
                                              {
                                                query: options.searchQuery,
                                              },
                                            ),
                                          ],
                                        ),
                                      ]
                                    : options.searchResults.map(
                                        (result, index) =>
                                          h.a(
                                            [
                                              h.Id(searchResultId(index)),
                                              h.Href(result.url),
                                              h.Role('option'),
                                              h.AriaSelected(
                                                index ===
                                                  options.activeSearchResultIndex,
                                              ),
                                              h.Tabindex(-1),
                                              h.OnClick(
                                                options.actions.selectSearchResult(
                                                  result.url,
                                                ),
                                              ),
                                              h.Class(
                                                `fd-search-result${index === options.activeSearchResultIndex ? ' fd-search-result-active' : ''}`,
                                              ),
                                            ],
                                            [
                                              ...(result.breadcrumbs ===
                                                undefined ||
                                              result.breadcrumbs.length === 0
                                                ? []
                                                : [
                                                    h.span(
                                                      [
                                                        h.Class(
                                                          'fd-search-breadcrumbs',
                                                        ),
                                                      ],
                                                      [
                                                        result.breadcrumbs.join(
                                                          ' / ',
                                                        ),
                                                      ],
                                                    ),
                                                  ]),
                                              h.strong([], [result.title]),
                                              h.span(
                                                [],
                                                highlightedSearchText(
                                                  result.excerpt,
                                                  options.searchQuery,
                                                  h,
                                                ),
                                              ),
                                            ],
                                          ),
                                      )),
                          ],
                        ),
                        h.span(
                          [h.Class('fd-sr-only'), h.AriaLive('polite')],
                          options.searchResults.length > 0
                            ? [
                                interpolateTranslation(
                                  t.searchResultsAvailable,
                                  {
                                    count: options.searchResults.length,
                                  },
                                ),
                              ]
                            : [],
                        ),
                      ],
                    ),
                  ],
                ),
              ]
            : [],
        ),
    },
    toParentMessage: options.actions.gotSearchDialogMessage,
  })
}

const markdownDocumentUrl = (site: SiteConfig, markdownUrl: string): string => {
  if (site.baseUrl === undefined) return markdownUrl
  try {
    return new URL(
      markdownUrl.replace(/^\//u, ''),
      `${site.baseUrl.replace(/\/+$/u, '')}/`,
    ).toString()
  } catch {
    return markdownUrl
  }
}

const pageFileForUrl = (
  nodes: ReadonlyArray<NavigationNode>,
  currentUrl: string,
): string | undefined => {
  for (const node of nodes) {
    if (node._tag === 'Separator' || node._tag === 'Link') continue
    if (node._tag === 'Page') {
      if (node.url === currentUrl) return node.page.file || node.page.id
      continue
    }
    if (node.index?._tag === 'Page' && node.index.url === currentUrl)
      return node.index.page.file || node.index.page.id
    const nested = pageFileForUrl(node.children, currentUrl)
    if (nested !== undefined) return nested
  }
  return undefined
}

export const githubDocumentUrl = (
  site: SiteConfig,
  navigation: ReadonlyArray<NavigationNode>,
  currentUrl: string,
): string | undefined => {
  if (site.githubUrl === undefined) return undefined
  const repositoryUrl = site.githubUrl
    .replace(/\.git\/?$/u, '')
    .replace(/\/+$/u, '')
  const file = pageFileForUrl(navigation, currentUrl)
  if (
    file === undefined ||
    file.startsWith('remote:') ||
    file.split('/').some(segment => segment.startsWith('@'))
  )
    return undefined
  const contentPath = (site.githubContentPath ?? 'content/docs').replace(
    /^\/+|\/+$/gu,
    '',
  )
  const normalizedFile = file.replace(/^\.\//u, '').replace(/^\/+|\/+$/gu, '')
  const repositoryFile =
    contentPath.length === 0 ||
    normalizedFile === contentPath ||
    normalizedFile.startsWith(`${contentPath}/`)
      ? normalizedFile
      : `${contentPath}/${normalizedFile}`
  const encodedFile = repositoryFile
    .split('/')
    .map(encodeURIComponent)
    .join('/')
  return `${repositoryUrl}/blob/main/${encodedFile}`
}

const pageActionsView = <Message>(
  options: DocsLayoutOptions<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const t = options.translations
  if (!options.markdownEnabled && options.ai === undefined) return h.empty
  const sourceUrl = markdownDocumentUrl(options.site, options.markdownUrl)
  const prompt = interpolateTranslation(t.askAiAboutPage, { url: sourceUrl })
  const githubUrl = githubDocumentUrl(
    options.site,
    options.navigation,
    options.currentUrl,
  )
  const markdownItem = {
    label: t.viewAsMarkdown,
    href: options.markdownUrl,
    icon: 'text',
  } as const
  const openItems: ReadonlyArray<{
    readonly label: string
    readonly href: string
    readonly icon: IconName
  }> = [
    ...(githubUrl === undefined
      ? []
      : [{ label: t.openInGitHub, href: githubUrl, icon: 'github' as const }]),
    markdownItem,
    {
      label: t.openInSciraAi,
      href: `https://scira.ai/?${new URLSearchParams({ q: prompt })}`,
      icon: 'scira',
    },
    {
      label: t.openInChatGPT,
      href: `https://chatgpt.com/?${new URLSearchParams({
        prompt,
        hints: 'search',
      })}`,
      icon: 'openai',
    },
    {
      label: t.openInClaude,
      href: `https://claude.ai/new?${new URLSearchParams({ q: prompt })}`,
      icon: 'anthropic',
    },
    {
      label: t.openInCursor,
      href: `https://cursor.com/link/prompt?${new URLSearchParams({
        text: prompt,
      })}`,
      icon: 'cursor',
    },
  ]
  const itemForHref = (href: string) =>
    openItems.find(item => item.href === href) ?? markdownItem
  const copyAriaLabel =
    options.copyMarkdownStatus === 'copied'
      ? t.copiedMarkdown
      : options.copyMarkdownStatus === 'loading'
        ? t.loading
        : options.copyMarkdownStatus === 'error'
          ? t.tryCopyAgain
          : t.copyPageMarkdown
  const openButtonContent = h.span(
    [h.Class('fd-page-open-trigger-content')],
    [t.openPage, icon('chevron', h, 'fd-page-open-chevron')],
  )
  const openMenu =
    options.pageOpenMenu === undefined ||
    options.actions.gotPageOpenMenuMessage === undefined
      ? h.div(
          [h.Class('fd-page-open')],
          [
            h.button(
              [
                h.Id(Menu.buttonId(pageOpenMenuId)),
                h.Type('button'),
                h.AriaHasPopup('menu'),
                h.AriaExpanded(false),
                h.AriaControls(`${pageOpenMenuId}-items`),
                h.AriaLabel(t.openPageMenu),
                h.Title(t.openPageMenu),
                h.Class(
                  'fd-control fd-control-outline fd-control-sm fd-page-action',
                ),
              ],
              [openButtonContent],
            ),
          ],
        )
      : h.submodel({
          slotId: 'page-open-menu',
          model: options.pageOpenMenu,
          view: PageOpenMenu.view,
          viewInputs: {
            items: openItems.map(item => item.href),
            itemToSearchText: href => itemForHref(href).label,
            itemToConfig: (href, { isActive }) => {
              const item = itemForHref(href)
              return {
                className: `fd-page-open-item${isActive ? ' fd-page-open-item-active' : ''}`,
                content: h.span(
                  [h.Class('fd-page-open-item-content')],
                  [
                    icon(item.icon, h, 'fd-page-open-provider'),
                    h.span([h.Class('fd-page-open-label')], [item.label]),
                    icon('externalLink', h, 'fd-page-open-external'),
                  ],
                ),
              }
            },
            buttonContent: openButtonContent,
            buttonClassName:
              'fd-control fd-control-outline fd-control-sm fd-page-action',
            itemsClassName: 'fd-page-open-menu',
            backdropClassName: 'fd-page-open-backdrop',
            className: 'fd-page-open',
            ariaLabel: t.openPageMenu,
            anchor: {
              placement: 'bottom-start',
              gap: 6,
              padding: 8,
              isPlacementLocked: true,
            },
          },
          toParentMessage: options.actions.gotPageOpenMenuMessage,
        })

  return h.div(
    [h.Class('fd-page-actions')],
    [
      ...(options.ai === undefined || options.actions.openAi === undefined
        ? []
        : [
            Button.view(
              {
                onClick: options.actions.openAi,
                toView: ({ button }) =>
                  h.button(
                    [
                      ...button,
                      h.Class(
                        'fd-control fd-control-outline fd-control-sm fd-page-action',
                      ),
                    ],
                    [icon('sparkles', h), t.askAi],
                  ),
              },
              h,
            ),
          ]),
      ...(options.markdownEnabled
        ? [
            Button.view(
              {
                onClick: options.actions.copyMarkdown,
                toView: ({ button }) =>
                  h.button(
                    [
                      ...button,
                      h.Disabled(options.copyMarkdownStatus === 'loading'),
                      h.AriaLabel(copyAriaLabel),
                      h.Class(
                        'fd-control fd-control-outline fd-control-sm fd-page-action',
                      ),
                    ],
                    [
                      icon(
                        options.copyMarkdownStatus === 'copied'
                          ? 'check'
                          : 'copy',
                        h,
                      ),
                      t.copyMarkdown,
                    ],
                  ),
              },
              h,
            ),
            openMenu,
          ]
        : []),
    ],
  )
}

const aiDialogView = <Message>(
  options: DocsLayoutOptions<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const ai = options.ai
  if (
    ai === undefined ||
    !ai.open ||
    options.aiDialog === undefined ||
    options.actions.gotAiDialogMessage === undefined ||
    options.actions.closeAi === undefined ||
    options.actions.updateAiInput === undefined ||
    options.actions.submitAi === undefined
  )
    return h.empty
  const t = options.translations
  const closeAi = options.actions.closeAi
  const updateAiInput = options.actions.updateAiInput
  const submitAi = options.actions.submitAi
  const gotAiDialogMessage = options.actions.gotAiDialogMessage
  return h.submodel({
    slotId: options.aiDialog.id,
    model: options.aiDialog,
    view: Dialog.view,
    viewInputs: {
      toView: ({
        dialog,
        backdrop,
        panel,
        title,
        description,
        initialFocus,
        isVisible,
      }) =>
        h.dialog(
          [...dialog, h.Class('fd-ai-layer')],
          isVisible
            ? [
                h.div(
                  [...backdrop, h.Class('fd-ai-backdrop'), h.AriaHidden(true)],
                  [],
                ),
                h.section(
                  [...panel, h.Class('fd-ai-dialog')],
                  [
                    h.header(
                      [h.Class('fd-ai-header')],
                      [
                        h.div(
                          [],
                          [
                            h.h2([...title, h.Id('fd-ai-title')], [t.aiTitle]),
                            h.p(
                              [...description, h.Id('fd-ai-description')],
                              [t.aiDescription],
                            ),
                          ],
                        ),
                        h.button(
                          [
                            h.Type('button'),
                            h.Class(
                              'fd-control fd-control-ghost fd-control-icon',
                            ),
                            h.OnClick(closeAi),
                            h.AriaLabel(t.closeAi),
                            h.Title(t.closeAi),
                          ],
                          [icon('close', h)],
                        ),
                      ],
                    ),
                    h.div(
                      [h.Class('fd-ai-messages'), h.AriaLive('polite')],
                      [
                        ...(ai.messages.length === 0
                          ? [h.p([h.Class('fd-ai-empty')], [t.aiDescription])]
                          : ai.messages.map((message, index) =>
                              h.div(
                                [
                                  h.Class(
                                    `fd-ai-message fd-ai-message-${message.role}`,
                                  ),
                                  h.DataAttribute(
                                    'message-index',
                                    String(index),
                                  ),
                                ],
                                [
                                  h.p([], [message.content]),
                                  ...(message.sources === undefined ||
                                  message.sources.length === 0
                                    ? []
                                    : [
                                        h.div(
                                          [h.Class('fd-ai-sources')],
                                          [
                                            h.strong([], [t.aiSources]),
                                            h.ul(
                                              [],
                                              message.sources.map(source =>
                                                h.li(
                                                  [],
                                                  [
                                                    h.a(
                                                      [h.Href(source.url)],
                                                      [source.title],
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ]),
                                ],
                              ),
                            )),
                        ...(ai.loading
                          ? [h.p([h.Class('fd-ai-thinking')], [t.aiThinking])]
                          : []),
                        ...(ai.error.length === 0
                          ? []
                          : [
                              h.p(
                                [h.Class('fd-ai-error')],
                                [ai.error || t.aiUnavailable],
                              ),
                            ]),
                      ],
                    ),
                    h.div(
                      [h.Class('fd-ai-composer')],
                      [
                        h.textarea(
                          [
                            ...initialFocus,
                            h.Id('fd-ai-input'),
                            h.Value(ai.input),
                            h.OnInput(updateAiInput),
                            h.Placeholder(t.aiPlaceholder),
                            h.AriaLabel(t.aiPlaceholder),
                            h.Disabled(ai.loading),
                            h.Attribute('rows', '3'),
                          ],
                          [],
                        ),
                        h.button(
                          [
                            h.Type('button'),
                            h.Class(
                              'fd-control fd-control-outline fd-control-sm',
                            ),
                            h.OnClick(submitAi),
                            h.Disabled(
                              ai.loading || ai.input.trim().length === 0,
                            ),
                          ],
                          [t.aiSend],
                        ),
                      ],
                    ),
                  ],
                ),
              ]
            : [],
        ),
    },
    toParentMessage: gotAiDialogMessage,
  })
}

export const docsLayout = <Message>(
  options: DocsLayoutOptions<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const t = options.translations
  const pageContext =
    navigationContextForUrl(options.navigation, options.currentUrl)?.filter(
      (label, index, labels) => index === 0 || labels[index - 1] !== label,
    ) ?? []
  const backgroundDisabled =
    options.searchOpen || options.ai?.open === true
      ? [h.AriaHidden(true), h.Attribute('inert', '')]
      : []
  const sidebarBackgroundDisabled =
    options.narrowViewport && options.sidebarOpen
      ? [h.AriaHidden(true), h.Attribute('inert', '')]
      : []
  const mobileMenuButton = Button.view(
    {
      onClick: options.actions.toggleSidebar,
      toView: ({ button }) =>
        h.button(
          [
            ...button,
            h.Id('fd-menu-trigger'),
            h.Class(
              'fd-control fd-control-ghost fd-control-icon fd-header-icon-button fd-menu-button',
            ),
            h.AriaLabel(t.openNavigation),
            h.Title(t.openNavigation),
            h.AriaControls('fd-sidebar'),
            h.AriaExpanded(options.sidebarOpen),
          ],
          [icon('menu', h)],
        ),
    },
    h,
  )
  const navItems = navigationView(
    options.navigation,
    options.currentUrl,
    options.collapsedSidebarGroups,
    options.actions.closeSidebar,
    options.actions.toggleSidebarGroup,
    options.site.icons,
    h,
  )
  const sidebarView = (): Html =>
    h.aside(
      [
        h.Class(`fd-sidebar${options.sidebarOpen ? ' fd-sidebar-open' : ''}`),
        h.Id('fd-sidebar'),
      ],
      [
        h.div(
          [h.Class('fd-sidebar-mobile-header')],
          [
            brandView(options.site, h, options.homeUrl, t.home),
            Button.view(
              {
                onClick: options.actions.closeSidebar,
                toView: ({ button }) =>
                  h.button(
                    [
                      ...button,
                      h.Class(
                        'fd-control fd-control-ghost fd-control-icon fd-header-icon-button',
                      ),
                      h.AriaLabel(t.closeNavigation),
                      h.Title(t.closeNavigation),
                    ],
                    [icon('close', h)],
                  ),
              },
              h,
            ),
          ],
        ),
        layoutTabsView(
          options.tabs,
          t,
          options.layoutTabsMenu,
          options.actions.gotLayoutTabsMenuMessage,
          options.site.icons,
          h,
        ),
        h.nav([h.AriaLabel(t.documentation)], [h.ul([], navItems)]),
        h.div(
          [h.Class('fd-sidebar-mobile-footer')],
          [
            languageSelector(
              options.locales,
              t,
              options.sidebarLanguageMenu,
              'sidebar-language-menu',
              sidebarLanguageMenuId,
              options.actions.gotSidebarLanguageMenuMessage,
              h,
              'top-start',
            ),
            h.div([h.Class('fd-social-links')], socialLinks(options.site, h)),
          ],
        ),
      ],
    )
  const sidebar =
    options.narrowViewport &&
    options.sidebarDialog !== undefined &&
    options.actions.gotSidebarDialogMessage !== undefined
      ? h.submodel({
          slotId: options.sidebarDialog.id,
          model: options.sidebarDialog,
          view: Dialog.view,
          viewInputs: {
            toView: ({
              dialog,
              backdrop,
              panel,
              title,
              description,
              isVisible,
            }) =>
              h.dialog(
                [...dialog, h.Class('fd-sidebar-layer')],
                isVisible
                  ? [
                      h.div(
                        [
                          ...backdrop,
                          h.Class('fd-sidebar-backdrop'),
                          h.AriaHidden(true),
                        ],
                        [],
                      ),
                      h.div(
                        [...panel, h.Class('fd-sidebar-dialog-panel')],
                        [
                          h.h2(
                            [...title, h.Class('fd-sr-only')],
                            [t.documentationNavigation],
                          ),
                          h.p(
                            [...description, h.Class('fd-sr-only')],
                            [t.documentation],
                          ),
                          sidebarView(),
                        ],
                      ),
                    ]
                  : [],
              ),
          },
          toParentMessage: options.actions.gotSidebarDialogMessage,
        })
      : sidebarView()

  return h.div(
    [
      h.Class(`fd-root fd-layout-${options.preset ?? 'docs'}`),
      h.Attribute('data-layout', options.preset ?? 'docs'),
    ],
    [
      h.a(
        [h.Class('fd-skip-link'), h.Href('#main-content')],
        [t.skipToContent],
      ),
      bannerView(
        options.banner,
        options.bannerDismissed,
        options.actions.dismissBanner,
        t.dismissBanner,
        h,
      ),
      headerView(
        options.site,
        options.homeUrl,
        options.themePreference,
        options.actions.selectTheme,
        options.actions.toggleSearch,
        options.searchOpen,
        options.locales,
        t,
        options.headerLanguageMenu,
        options.actions.gotHeaderLanguageMenuMessage,
        h,
        { attributes: backgroundDisabled, mobileMenu: mobileMenuButton },
      ),
      h.div(
        [
          h.Class('fd-mobile-toc-shell'),
          ...backgroundDisabled,
          ...sidebarBackgroundDisabled,
        ],
        [
          mobileTocView(
            options.page.toc,
            options.activeTocId,
            options.mobileTocOpen,
            options.actions.setMobileTocOpen,
            options.actions.selectToc,
            t,
            h,
          ),
        ],
      ),
      h.div(
        [h.Class('fd-docs-frame')],
        [
          sidebar,
          h.div(
            [h.Class('fd-docs-body'), ...backgroundDisabled],
            [
              h.main(
                [
                  h.Id('main-content'),
                  h.Class('fd-main'),
                  h.Tabindex(-1),
                  ...sidebarBackgroundDisabled,
                ],
                [
                  h.div(
                    [h.Class('fd-content-column')],
                    [
                      h.article(
                        [h.Class('fd-article')],
                        [
                          ...(pageContext.length === 0
                            ? []
                            : [
                                h.div(
                                  [
                                    h.Class('fd-page-context'),
                                    h.AriaLabel(t.documentationNavigation),
                                  ],
                                  pageContext.flatMap((label, index) => [
                                    ...(index === 0
                                      ? []
                                      : [
                                          icon(
                                            'chevronRight',
                                            h,
                                            'fd-page-context-separator',
                                          ),
                                        ]),
                                    h.span([], [label]),
                                  ]),
                                ),
                              ]),
                          h.h1(
                            [h.Class('fd-page-title')],
                            [options.page.frontmatter.title],
                          ),
                          ...(options.page.frontmatter.description === undefined
                            ? []
                            : [
                                h.p(
                                  [h.Class('fd-page-description')],
                                  [options.page.frontmatter.description],
                                ),
                              ]),
                          pageActionsView(options, h),
                          renderMarkdown(
                            {
                              blocks:
                                options.page.document.blocks[0]?._tag ===
                                  'Heading' &&
                                options.page.document.blocks[0].level === 1
                                  ? options.page.document.blocks.slice(1)
                                  : options.page.document.blocks,
                            },
                            {
                              ...options.markdown,
                              toc: options.page.toc,
                              selectToc: options.actions.selectToc,
                              openImage: options.actions.openImage,
                              ...(options.site.icons === undefined
                                ? {}
                                : { icons: options.site.icons }),
                            },
                            h,
                          ),
                          ...(options.lastModified === undefined
                            ? []
                            : [
                                h.p(
                                  [
                                    h.Class('fd-last-updated'),
                                    h.Attribute(
                                      'data-last-modified',
                                      options.lastModified,
                                    ),
                                  ],
                                  [
                                    interpolateTranslation(t.lastUpdated, {
                                      date: new Intl.DateTimeFormat(
                                        options.currentLocale,
                                        {
                                          dateStyle: 'medium',
                                        },
                                      ).format(new Date(options.lastModified)),
                                    }),
                                  ],
                                ),
                              ]),
                          ...(options.feedback === undefined
                            ? []
                            : [
                                h.section(
                                  [
                                    h.Class('fd-feedback'),
                                    h.AriaLive('polite'),
                                  ],
                                  options.feedbackStatus === 'submitted'
                                    ? [t.feedbackThanks]
                                    : [
                                        h.span(
                                          [h.Class('fd-feedback-prompt')],
                                          [
                                            options.feedback.prompt ??
                                              t.wasThisHelpful,
                                          ],
                                        ),
                                        h.div(
                                          [h.Class('fd-feedback-actions')],
                                          [
                                            h.button(
                                              [
                                                h.Type('button'),
                                                h.Disabled(
                                                  options.feedbackStatus ===
                                                    'submitting',
                                                ),
                                                h.OnClick(
                                                  options.actions.submitFeedback(
                                                    'positive',
                                                  ),
                                                ),
                                              ],
                                              [t.helpful],
                                            ),
                                            h.button(
                                              [
                                                h.Type('button'),
                                                h.Disabled(
                                                  options.feedbackStatus ===
                                                    'submitting',
                                                ),
                                                h.OnClick(
                                                  options.actions.submitFeedback(
                                                    'negative',
                                                  ),
                                                ),
                                              ],
                                              [t.notHelpful],
                                            ),
                                          ],
                                        ),
                                        ...(options.feedbackStatus === 'error'
                                          ? [
                                              h.span(
                                                [h.Class('fd-feedback-error')],
                                                [t.feedbackFailed],
                                              ),
                                            ]
                                          : []),
                                      ],
                                ),
                              ]),
                          h.nav(
                            [h.Class('fd-pager'), h.AriaLabel(t.pagination)],
                            [
                              options.previous === undefined
                                ? h.span([], [])
                                : h.a(
                                    [
                                      h.Href(options.previous.url),
                                      h.Class(
                                        'fd-pager-link fd-pager-link-previous',
                                      ),
                                    ],
                                    [
                                      h.span(
                                        [h.Class('fd-pager-direction')],
                                        [t.previousPage],
                                      ),
                                      h.span(
                                        [h.Class('fd-pager-title')],
                                        [
                                          icon(
                                            'chevronLeft',
                                            h,
                                            'fd-pager-arrow',
                                          ),
                                          h.span(
                                            [],
                                            [
                                              options.previous.frontmatter
                                                .title,
                                            ],
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                              options.next === undefined
                                ? h.span([], [])
                                : h.a(
                                    [
                                      h.Href(options.next.url),
                                      h.Class(
                                        'fd-pager-link fd-pager-link-next',
                                      ),
                                    ],
                                    [
                                      h.span(
                                        [h.Class('fd-pager-direction')],
                                        [t.nextPage],
                                      ),
                                      h.span(
                                        [h.Class('fd-pager-title')],
                                        [
                                          h.span(
                                            [],
                                            [options.next.frontmatter.title],
                                          ),
                                          icon(
                                            'chevronRight',
                                            h,
                                            'fd-pager-arrow',
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                  tocView(
                    options.page.toc,
                    options.activeTocId,
                    options.actions.selectToc,
                    t,
                    h,
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      siteFooterView<Message>(
        options.site,
        options.footer,
        'fd-home-footer fd-doc-footer',
        h,
      ),
      searchDialogView(options, h),
      aiDialogView(options, h),
      ...(options.imagePreview === undefined
        ? []
        : [
            h.div(
              [
                h.Class('fd-image-preview'),
                h.Role('dialog'),
                h.AriaModal(true),
                h.AriaLabel(t.imagePreview),
              ],
              [
                h.button(
                  [
                    h.Type('button'),
                    h.Class('fd-image-preview-backdrop'),
                    h.OnClick(options.actions.closeImage),
                    h.AriaLabel(t.closeImagePreview),
                  ],
                  [],
                ),
                h.img([
                  h.Src(options.imagePreview.url),
                  h.Alt(options.imagePreview.alt),
                ]),
                h.button(
                  [
                    h.Type('button'),
                    h.Class('fd-image-preview-close'),
                    h.OnClick(options.actions.closeImage),
                    h.AriaLabel(t.closeImagePreview),
                  ],
                  [icon('close', h)],
                ),
              ],
            ),
          ]),
    ],
  )
}

export const landingLayout = <Message>(
  options: LandingLayoutOptions<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const t = options.translations
  const command = options.landing.command
  const commandCopied = options.copiedText === command
  const commandCopyLabel = commandCopied ? t.copied : t.copy
  const commandCopyButton = (
    trigger: ReadonlyArray<ChildAttribute> = [],
    includeNativeTitle = true,
  ): Html =>
    Button.view(
      {
        onClick: options.actions.copyText(command),
        toView: ({ button }) =>
          h.button(
            [
              ...button,
              ...trigger,
              h.Class(
                'fd-control fd-control-ghost fd-control-icon fd-install-copy',
              ),
              h.AriaLabel(t.copyCreateCommand),
              ...(includeNativeTitle ? [h.Title(commandCopyLabel)] : []),
            ],
            [icon<Message>(commandCopied ? 'check' : 'copy', h)],
          ),
      },
      h,
    )
  const commandCopyControl =
    options.copyTooltip === undefined ||
    options.actions.gotCopyTooltipMessage === undefined
      ? commandCopyButton()
      : h.submodel({
          slotId: landingCopyTooltipId,
          model: options.copyTooltip,
          view: Tooltip.view,
          viewInputs: {
            anchor: {
              placement: 'top',
              gap: 6,
              padding: 8,
              portal: true,
              isPlacementLocked: true,
            },
            ariaLabel: t.copyCreateCommand,
            toView: ({ trigger, panel, isVisible }) =>
              h.span(
                [h.Class('fd-install-copy-control')],
                [
                  commandCopyButton(trigger, false),
                  ...(isVisible
                    ? [
                        h.span(
                          [...panel, h.Class('fd-install-copy-tooltip')],
                          [commandCopyLabel],
                        ),
                      ]
                    : []),
                ],
              ),
          },
          toParentMessage: options.actions.gotCopyTooltipMessage,
        })
  const sectionGlyph = (value: string): Html =>
    h.div(
      [h.Class('fd-landing-glyph'), h.AriaHidden(true)],
      [h.span([], [value])],
    )
  const feature = (
    iconName: IconName,
    title: string,
    description: string,
  ): Html =>
    h.article(
      [h.Class('fd-landing-card')],
      [
        icon<Message>(iconName, h, 'fd-landing-card-icon'),
        h.h3([], [title]),
        h.p([], [description]),
      ],
    )
  const checkItem = (value: string): Html =>
    h.li([], [icon<Message>('check', h), h.span([], [value])])

  return h.div(
    [h.Class('fd-root fd-landing-root')],
    [
      h.a(
        [h.Class('fd-skip-link'), h.Href('#main-content')],
        [t.skipToContent],
      ),
      bannerView(
        options.banner,
        options.bannerDismissed,
        options.actions.dismissBanner,
        t.dismissBanner,
        h,
      ),
      headerView(
        options.site,
        options.homeUrl,
        options.themePreference,
        options.actions.selectTheme,
        options.actions.toggleSearch,
        options.searchOpen,
        options.locales,
        t,
        options.headerLanguageMenu,
        options.actions.gotHeaderLanguageMenuMessage,
        h,
        {
          className: 'fd-landing-header',
          attributes: options.searchOpen
            ? [h.AriaHidden(true), h.Attribute('inert', '')]
            : [],
        },
      ),
      h.main(
        [h.Id('main-content')],
        [
          ...(options.landing.sections.includes('hero')
            ? [
                h.section(
                  [h.Class('fd-landing-section fd-hero')],
                  [
                    h.div(
                      [h.Class('fd-landing-section-inner')],
                      [
                        h.h1(
                          [],
                          options.landing.headline === undefined
                            ? [
                                'The documentation framework for ',
                                h.span([], ['Foldkit']),
                                '.',
                              ]
                            : [options.landing.headline],
                        ),
                        h.p(
                          [h.Class('fd-hero-copy')],
                          [
                            options.landing.description ??
                              options.site.tagline ??
                              options.site.description ??
                              'Beautiful, searchable, LLM-ready documentation for Foldkit, powered by Effect.',
                          ],
                        ),
                        h.div(
                          [h.Class('fd-install-command')],
                          [
                            h.code([], [h.span([], ['$']), ` ${command}`]),
                            commandCopyControl,
                            h.span(
                              [h.Class('fd-sr-only'), h.AriaLive('polite')],
                              [commandCopied ? t.codeCopied : ''],
                            ),
                          ],
                        ),
                        h.div(
                          [h.Class('fd-hero-actions')],
                          [
                            h.a(
                              [
                                h.Class('fd-button fd-button-primary'),
                                h.Href(options.docsUrl),
                              ],
                              [t.readTheDocs, icon<Message>('arrow', h)],
                            ),
                            ...(options.site.githubUrl === undefined
                              ? []
                              : [
                                  h.a(
                                    [
                                      h.Class(
                                        'fd-control fd-control-outline fd-landing-action',
                                      ),
                                      h.Href(options.site.githubUrl),
                                      h.Target('_blank'),
                                      h.Rel('noreferrer noopener'),
                                    ],
                                    [
                                      icon<Message>('github', h),
                                      t.viewOnGitHub,
                                    ],
                                  ),
                                ]),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ]
            : []),
          ...(options.landing.sections.includes('overview')
            ? [
                sectionGlyph('{ }'),
                h.section(
                  [h.Class('fd-landing-section')],
                  [
                    h.div(
                      [h.Class('fd-landing-section-inner')],
                      [
                        h.h2([], ['Write docs. Ship. Repeat.']),
                        h.p(
                          [h.Class('fd-landing-lede')],
                          [
                            'Foldocs gives you the complete documentation architecture, so you can focus on explaining your product.',
                          ],
                        ),
                        h.div(
                          [h.Class('fd-landing-grid fd-landing-grid-three')],
                          [
                            feature(
                              'lock',
                              'Content first',
                              'Add Markdown or MDX. Routes, navigation, frontmatter, tables of contents, and highlighting stay in sync automatically.',
                            ),
                            feature(
                              'bolt',
                              'Foldkit native',
                              'Every generated site is a Foldkit application, with its layout, routing, commands, and subscriptions ready to extend.',
                            ),
                            feature(
                              'expand',
                              'Scales with grace',
                              'Use meta.json route groups to keep a five-page guide and a thousand-page reference equally deliberate.',
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ]
            : []),
          ...(options.landing.sections.includes('stack')
            ? [
                sectionGlyph('=>'),
                h.section(
                  [h.Class('fd-landing-section fd-landing-section-compact')],
                  [
                    h.div(
                      [h.Class('fd-landing-section-inner')],
                      [
                        h.h2(
                          [],
                          [
                            'Built on ',
                            h.span([], ['Foldkit']),
                            '. Powered by Effect.',
                          ],
                        ),
                        h.p(
                          [h.Class('fd-landing-lede')],
                          [
                            'A Foldkit application generated with one opinionated stack and no compatibility questionnaire.',
                          ],
                        ),
                        h.ul(
                          [h.Class('fd-landing-checks')],
                          [
                            checkItem(
                              'Every generated documentation site is a Foldkit application',
                            ),
                            checkItem(
                              'All runtime state and messages are typed with Effect Schema',
                            ),
                            checkItem(
                              'Local search and provider failures use Effect contracts',
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ]
            : []),
          ...(options.landing.sections.includes('features')
            ? [
                sectionGlyph('|>'),
                h.section(
                  [h.Class('fd-landing-section')],
                  [
                    h.div(
                      [h.Class('fd-landing-section-inner')],
                      [
                        h.h2([], ['Batteries included.']),
                        h.p(
                          [h.Class('fd-landing-lede')],
                          [
                            'The parts a real documentation site needs already work together.',
                          ],
                        ),
                        h.div(
                          [h.Class('fd-landing-grid fd-landing-grid-features')],
                          [
                            feature(
                              'search',
                              'Local search',
                              'Fast keyboard-first Orama search with a provider-neutral interface.',
                            ),
                            feature(
                              'markdown',
                              'Markdown URLs',
                              'Every page has a processed .md endpoint plus copy and view actions.',
                            ),
                            feature(
                              'system',
                              'Responsive shell',
                              'Desktop sidebar, mobile dialog, table of contents, and persistent themes.',
                            ),
                            feature(
                              'copy',
                              'Authoring tools',
                              'Syntax highlighting, code copying, callouts, cards, steps, tables, and tasks.',
                            ),
                            feature(
                              'arrow',
                              'Generated outputs',
                              'Sitemap, llms.txt, llms-full.txt, metadata, and production assets.',
                            ),
                            feature(
                              'github',
                              'Ready to own',
                              'A normal generated repository with reusable packages and editable content.',
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ]
            : []),
          ...(options.landing.sections.includes('ai')
            ? [
                sectionGlyph('~~'),
                h.section(
                  [h.Class('fd-landing-section fd-ai-section')],
                  [
                    h.div(
                      [h.Class('fd-landing-section-inner')],
                      [
                        h.h2([], ['Built for humans. Readable by AI.']),
                        h.p(
                          [h.Class('fd-landing-lede')],
                          [
                            'LLM indexes, complete Markdown output, content negotiation, and stable page URLs ship with the same source your readers see.',
                          ],
                        ),
                        h.a(
                          [
                            h.Class('fd-button fd-button-secondary'),
                            h.Href(options.docsUrl),
                          ],
                          [t.exploreDocumentation, icon<Message>('arrow', h)],
                        ),
                      ],
                    ),
                  ],
                ),
              ]
            : []),
          ...(options.landing.sections.includes('proof')
            ? [
                sectionGlyph('...'),
                h.section(
                  [h.Class('fd-landing-section fd-proof-section')],
                  [
                    h.div(
                      [h.Class('fd-landing-section-inner')],
                      [
                        h.h2([], ['Everything is connected.']),
                        h.div(
                          [h.Class('fd-proof-grid')],
                          [
                            h.div(
                              [],
                              [
                                h.span([], ['CONTENT']),
                                h.strong([], ['.md + .mdx']),
                              ],
                            ),
                            h.div(
                              [],
                              [
                                h.span([], ['RUNTIME']),
                                h.strong([], ['Foldkit + Effect']),
                              ],
                            ),
                            h.div(
                              [],
                              [
                                h.span([], ['SEARCH']),
                                h.strong([], ['Local by default']),
                              ],
                            ),
                            h.div(
                              [],
                              [
                                h.span([], ['AGENTS']),
                                h.strong([], ['LLM ready']),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ]
            : []),
          ...(options.landing.sections.includes('cta')
            ? [
                sectionGlyph('->'),
                h.section(
                  [h.Class('fd-landing-section fd-final-cta')],
                  [
                    h.div(
                      [h.Class('fd-landing-section-inner')],
                      [
                        h.h2([], ['Start writing.']),
                        h.p(
                          [h.Class('fd-landing-lede')],
                          [
                            'Create the app once. From then on, your documentation is just content.',
                          ],
                        ),
                        h.div(
                          [h.Class('fd-hero-actions')],
                          [
                            h.a(
                              [
                                h.Class('fd-button fd-button-primary'),
                                h.Href(options.docsUrl),
                              ],
                              [t.diveIn, icon<Message>('arrow', h)],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ]
            : []),
        ],
      ),
      siteFooterView<Message>(
        options.site,
        options.landing.footer,
        'fd-home-footer',
        h,
      ),
      searchDialogView(options, h),
    ],
  )
}
