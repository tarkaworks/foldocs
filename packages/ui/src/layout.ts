import type { TocItem } from "@foldocs/content";
import type { SearchResult } from "@foldocs/search";
import type {
  NavigationNode,
  NavigationTab,
  PageManifestEntry,
  LayoutPreset,
  ResolvedLandingConfig,
  ResolvedUiTranslations,
  SiteConfig,
} from "foldocs-core";
import { interpolateTranslation } from "foldocs-core";
import type { CompiledPage } from "foldocs-mdx";
import { Option } from "effect";
import { type Html, html } from "foldkit/html";

import { renderMarkdown, type MarkdownViewOptions } from "./markdown.js";
import { foldocsLogoSvg, icons, type IconName } from "./icons.js";

export type ThemePreference = "light" | "system" | "dark";

interface SearchActions<Message> {
  readonly toggleSearch: Message;
  readonly closeSearch: Message;
  readonly updateSearch: (query: string) => Message;
  readonly searchKeyDown: (key: string) => Message;
  readonly selectSearchResult: (url: string) => Message;
}

interface SearchOptions<Message> {
  readonly searchOpen: boolean;
  readonly searchQuery: string;
  readonly searchResults: ReadonlyArray<SearchResult>;
  readonly searchLoading: boolean;
  readonly searchError: string;
  readonly activeSearchResultIndex: number;
  readonly translations: ResolvedUiTranslations;
  readonly actions: SearchActions<Message>;
}

export interface LocaleLink {
  readonly locale: string;
  readonly name: string;
  readonly dir: "ltr" | "rtl";
  readonly href: string;
  readonly current: boolean;
}

export interface DocsLayoutActions<Message> extends SearchActions<Message> {
  readonly toggleSidebar: Message;
  readonly closeSidebar: Message;
  readonly toggleSidebarGroup: (key: string) => Message;
  readonly setMobileTocOpen: (open: boolean) => Message;
  readonly selectToc: (id: string) => Message;
  readonly selectTheme: (preference: ThemePreference) => Message;
  readonly copyMarkdown: Message;
}

export interface DocsLayoutOptions<Message> extends SearchOptions<Message> {
  readonly site: SiteConfig;
  readonly preset?: LayoutPreset;
  readonly navigation: ReadonlyArray<NavigationNode>;
  readonly tabs: ReadonlyArray<NavigationTab>;
  readonly currentUrl: string;
  readonly page: CompiledPage;
  readonly previous?: PageManifestEntry<CompiledPage>;
  readonly next?: PageManifestEntry<CompiledPage>;
  readonly sidebarOpen: boolean;
  readonly collapsedSidebarGroups: ReadonlyArray<string>;
  readonly activeTocId: string;
  readonly mobileTocOpen: boolean;
  readonly narrowViewport: boolean;
  readonly theme: "light" | "dark";
  readonly themePreference: ThemePreference;
  readonly docsUrl: string;
  readonly homeUrl: string;
  readonly locales: ReadonlyArray<LocaleLink>;
  readonly currentLocale: string;
  readonly markdownUrl: string;
  readonly markdownEnabled: boolean;
  readonly copyMarkdownStatus: "idle" | "loading" | "copied" | "error";
  readonly actions: DocsLayoutActions<Message>;
  readonly markdown?: MarkdownViewOptions<Message>;
}

export interface LandingLayoutActions<Message> extends SearchActions<Message> {
  readonly selectTheme: (preference: ThemePreference) => Message;
  readonly copyText: (value: string) => Message;
}

export interface LandingLayoutOptions<Message> extends SearchOptions<Message> {
  readonly site: SiteConfig;
  readonly landing: ResolvedLandingConfig;
  readonly docsUrl: string;
  readonly homeUrl: string;
  readonly locales: ReadonlyArray<LocaleLink>;
  readonly currentLocale: string;
  readonly theme: "light" | "dark";
  readonly themePreference: ThemePreference;
  readonly copiedText: string;
  readonly actions: LandingLayoutActions<Message>;
}

const icon = <Message>(name: IconName, className?: string): Html => {
  const h = html<Message>();
  return h.span(
    [
      h.Class(`fd-icon${className === undefined ? "" : ` ${className}`}`),
      h.InnerHTML(icons[name]),
    ],
    [],
  );
};

const brandView = <Message>(
  site: SiteConfig,
  homeUrl = "/",
  homeLabel = "home",
): Html => {
  const h = html<Message>();
  return h.a(
    [
      h.Class("fd-brand"),
      h.Href(homeUrl),
      h.AriaLabel(`${site.title} ${homeLabel}`),
    ],
    [
      h.span(
        [
          h.Class("fd-brand-mark"),
          h.AriaHidden(true),
          h.InnerHTML(foldocsLogoSvg),
        ],
        [],
      ),
      h.span([h.Class("fd-brand-name")], [site.logoText ?? site.title]),
      ...(site.badge === undefined
        ? []
        : [h.span([h.Class("fd-brand-badge")], [site.badge])]),
    ],
  );
};

const themeSelector = <Message>(
  preference: ThemePreference,
  selectTheme: (preference: ThemePreference) => Message,
  translations: ResolvedUiTranslations,
): Html => {
  const h = html<Message>();
  const entries = [
    ["light", translations.lightTheme, "light"],
    ["system", translations.systemTheme, "system"],
    ["dark", translations.darkTheme, "dark"],
  ] as const;
  return h.div(
    [
      h.Class("fd-theme-selector"),
      h.Role("group"),
      h.AriaLabel(translations.colorTheme),
    ],
    entries.map(([value, label, iconName]) =>
      h.button(
        [
          h.Class(value === preference ? "fd-theme-active" : ""),
          h.OnClick(selectTheme(value)),
          h.AriaLabel(label),
          h.Title(label),
          h.Attribute("aria-pressed", String(value === preference)),
        ],
        [icon<Message>(iconName)],
      ),
    ),
  );
};

const socialLinks = <Message>(site: SiteConfig): ReadonlyArray<Html> => {
  const h = html<Message>();
  const entries = [
    [site.githubUrl, "GitHub", "github"],
    [site.discordUrl, "Discord", "discord"],
    [site.xUrl, "X", "x"],
    [site.npmUrl, "npm", "npm"],
  ] as const;
  return entries.flatMap(([href, label, iconName]) =>
    href === undefined
      ? []
      : [
          h.a(
            [
              h.Class("fd-social-link"),
              h.Href(href),
              h.Target("_blank"),
              h.Rel("noreferrer noopener"),
              h.AriaLabel(label),
              h.Title(label),
            ],
            [
              icon<Message>(
                iconName,
                iconName === "npm" ? "fd-social-npm-icon" : "fd-social-icon",
              ),
            ],
          ),
        ],
  );
};

const languageSelector = <Message>(
  locales: ReadonlyArray<LocaleLink>,
  translations: ResolvedUiTranslations,
): Html => {
  const h = html<Message>();
  if (locales.length <= 1) return h.empty;
  const current = locales.find((locale) => locale.current) ?? locales[0]!;
  return h.details(
    [h.Class("fd-language-selector")],
    [
      h.summary(
        [
          h.AriaLabel(translations.selectLanguage),
          h.Title(translations.selectLanguage),
        ],
        [
          icon<Message>("globe"),
          h.span([h.Class("fd-language-current")], [current.name]),
          icon<Message>("chevron", "fd-language-chevron"),
        ],
      ),
      h.div(
        [h.Class("fd-language-menu"), h.Role("listbox")],
        locales.map((locale) =>
          h.a(
            [
              h.Href(locale.href),
              h.Attribute("lang", locale.locale),
              h.Attribute("hreflang", locale.locale),
              h.Attribute("dir", locale.dir),
              h.Role("option"),
              h.AriaSelected(locale.current),
              h.Class(locale.current ? "fd-language-active" : ""),
            ],
            [
              h.span([], [locale.name]),
              locale.current ? icon<Message>("check") : h.empty,
            ],
          ),
        ),
      ),
    ],
  );
};

const searchTrigger = <Message>(
  action: Message,
  expanded: boolean,
  translations: ResolvedUiTranslations,
  mobile = false,
): Html => {
  const h = html<Message>();
  return h.button(
    [
      h.Class(
        mobile
          ? "fd-search-trigger fd-search-trigger-mobile"
          : "fd-search-trigger",
      ),
      h.Id(mobile ? "fd-search-trigger-mobile" : "fd-search-trigger"),
      h.OnClickFocus("#fd-search-keyboard-warmup", action),
      h.AriaExpanded(expanded),
      h.AriaHasPopup("dialog"),
      h.AriaLabel(translations.searchDocumentation),
    ],
    mobile
      ? [icon<Message>("search")]
      : [
          icon<Message>("search"),
          h.span([], [translations.search]),
          h.kbd([], ["⌘K"]),
        ],
  );
};

const headerActions = <Message>(
  site: SiteConfig,
  preference: ThemePreference,
  selectTheme: (preference: ThemePreference) => Message,
  searchAction: Message,
  searchOpen: boolean,
  locales: ReadonlyArray<LocaleLink>,
  translations: ResolvedUiTranslations,
  mobileMenu?: Html,
): Html => {
  const h = html<Message>();
  return h.div(
    [h.Class("fd-header-actions")],
    [
      searchTrigger(searchAction, searchOpen, translations),
      searchTrigger(searchAction, searchOpen, translations, true),
      languageSelector(locales, translations),
      themeSelector(preference, selectTheme, translations),
      h.div(
        [h.Class("fd-social-links fd-social-links-header")],
        socialLinks(site),
      ),
      ...(mobileMenu === undefined ? [] : [mobileMenu]),
    ],
  );
};

const nodeContainsUrl = (node: NavigationNode, currentUrl: string): boolean =>
  node._tag === "Page"
    ? node.url === currentUrl
    : node._tag === "Folder"
      ? node.children.some((child) => nodeContainsUrl(child, currentUrl))
      : false;

const navigationContextForUrl = (
  nodes: ReadonlyArray<NavigationNode>,
  currentUrl: string,
  ancestors: ReadonlyArray<string> = [],
): ReadonlyArray<string> | undefined => {
  for (const node of nodes) {
    if (node._tag === "Separator") continue;
    if (node._tag === "Page") {
      if (node.url === currentUrl) return ancestors;
      continue;
    }
    const nested = navigationContextForUrl(node.children, currentUrl, [
      ...ancestors,
      node.label,
    ]);
    if (nested !== undefined) return nested;
  }
  return undefined;
};

const navigationView = <Message>(
  nodes: ReadonlyArray<NavigationNode>,
  currentUrl: string,
  collapsedGroups: ReadonlyArray<string>,
  closeSidebar: Message,
  toggleGroup: (key: string) => Message,
  parentKey = "",
  depth = 0,
): ReadonlyArray<Html> => {
  const h = html<Message>();
  return nodes.map((node) => {
    if (node._tag === "Separator") {
      return h.li(
        [h.Class("fd-sidebar-section"), h.Role("presentation")],
        [h.span([h.Class("fd-sidebar-section-label")], [node.label])],
      );
    }
    if (node._tag === "Page") {
      const active = node.url === currentUrl;
      return h.li(
        [],
        [
          h.a(
            [
              h.Href(node.url),
              h.Class(
                `fd-sidebar-link${depth === 0 ? " fd-sidebar-link-root" : ""}${active ? " fd-sidebar-link-active" : ""}`,
              ),
              h.OnClick(closeSidebar),
              ...(active ? [h.AriaCurrent("page")] : []),
            ],
            [node.label],
          ),
        ],
      );
    }
    const key = `${parentKey}/${node.segment}`;
    const containsActive = nodeContainsUrl(node, currentUrl);
    const collapsed = collapsedGroups.includes(key);
    return h.li(
      [
        h.Class(
          `fd-sidebar-folder${containsActive ? " fd-sidebar-folder-active" : ""}${collapsed ? " fd-sidebar-folder-collapsed" : ""}`,
        ),
      ],
      [
        h.button(
          [
            h.Class("fd-sidebar-folder-label"),
            h.OnClick(toggleGroup(key)),
            h.AriaExpanded(!collapsed),
          ],
          [
            h.span([], [node.label]),
            icon<Message>("chevron", "fd-sidebar-chevron"),
          ],
        ),
        ...(collapsed
          ? []
          : [
              h.div(
                [h.Class("fd-sidebar-group-panel")],
                [
                  h.ul(
                    [],
                    navigationView(
                      node.children,
                      currentUrl,
                      collapsedGroups,
                      closeSidebar,
                      toggleGroup,
                      key,
                      depth + 1,
                    ),
                  ),
                ],
              ),
            ]),
      ],
    );
  });
};

const layoutTabsView = <Message>(
  tabs: ReadonlyArray<NavigationTab>,
  translations: ResolvedUiTranslations,
): Html => {
  const h = html<Message>();
  const current = tabs.find((tab) => tab.current);
  if (current === undefined) return h.empty;
  return h.details(
    [h.Class("fd-layout-tabs")],
    [
      h.summary(
        [
          h.AriaLabel(translations.selectDocumentation),
          h.Title(translations.selectDocumentation),
        ],
        [
          h.span(
            [h.Class("fd-layout-tab-current")],
            [
              h.strong([], [current.title]),
              ...(current.description === undefined
                ? []
                : [h.span([], [current.description])]),
            ],
          ),
          icon<Message>("chevron", "fd-layout-tabs-chevron"),
        ],
      ),
      h.div(
        [h.Class("fd-layout-tabs-menu"), h.Role("listbox")],
        tabs.map((tab) =>
          h.a(
            [
              h.Href(tab.url),
              h.Role("option"),
              h.AriaSelected(tab.current),
              h.Class(tab.current ? "fd-layout-tab-active" : ""),
            ],
            [
              h.strong([], [tab.title]),
              ...(tab.description === undefined
                ? []
                : [h.span([], [tab.description])]),
              ...(tab.current ? [icon<Message>("check")] : []),
            ],
          ),
        ),
      ),
    ],
  );
};

const tocItemsView = <Message>(
  toc: ReadonlyArray<TocItem>,
  activeTocId: string,
  selectToc: (id: string) => Message,
): ReadonlyArray<Html> => {
  const h = html<Message>();
  return toc.map((item) => {
    const active = item.id === activeTocId;
    return h.li(
      [h.Class(`fd-toc-depth-${item.depth}`)],
      [
        h.a(
          [
            h.Href(`#${item.id}`),
            h.OnClick(selectToc(item.id)),
            ...(active ? [h.AriaCurrent("location")] : []),
            h.Class(active ? "fd-toc-link-active" : ""),
          ],
          [item.title],
        ),
      ],
    );
  });
};

const tocView = <Message>(
  toc: ReadonlyArray<TocItem>,
  activeTocId: string,
  selectToc: (id: string) => Message,
  translations: ResolvedUiTranslations,
): Html => {
  const h = html<Message>();
  return h.aside(
    [h.Class("fd-toc-shell")],
    [
      h.nav(
        [h.Class("fd-toc"), h.AriaLabel(translations.onThisPage)],
        [
          h.div([h.Class("fd-toc-title")], [translations.onThisPage]),
          h.ul([], tocItemsView(toc, activeTocId, selectToc)),
        ],
      ),
    ],
  );
};

const mobileTocView = <Message>(
  toc: ReadonlyArray<TocItem>,
  activeTocId: string,
  open: boolean,
  setOpen: (open: boolean) => Message,
  selectToc: (id: string) => Message,
  translations: ResolvedUiTranslations,
): Html => {
  const h = html<Message>();
  if (toc.length === 0) return h.empty;
  const activeTitle =
    toc.find((item) => item.id === activeTocId)?.title ?? toc[0]?.title ?? "";
  return h.details(
    [h.Class("fd-mobile-toc"), h.Open(open), h.OnToggle(setOpen)],
    [
      h.summary(
        [],
        [
          h.span([h.Class("fd-mobile-toc-label")], [translations.onThisPage]),
          h.span([h.Class("fd-mobile-toc-current")], [activeTitle]),
          icon<Message>("chevron", "fd-mobile-toc-chevron"),
        ],
      ),
      h.nav(
        [h.AriaLabel(translations.tableOfContents)],
        [h.ul([], tocItemsView(toc, activeTocId, selectToc))],
      ),
    ],
  );
};

const searchResultId = (index: number): string => `fd-search-result-${index}`;

const searchDialogView = <Message>(options: SearchOptions<Message>): Html => {
  const h = html<Message>();
  const t = options.translations;
  if (!options.searchOpen) return h.empty;
  return h.div(
    [h.Class("fd-search-layer")],
    [
      h.button(
        [
          h.Class("fd-search-backdrop"),
          h.AriaLabel(t.closeSearch),
          h.OnClick(options.actions.closeSearch),
        ],
        [],
      ),
      h.div(
        [
          h.Class("fd-search-dialog"),
          h.Role("dialog"),
          h.AriaModal(true),
          h.AriaLabel(t.searchDocumentation),
          h.Tabindex(-1),
        ],
        [
          h.div(
            [h.Class("fd-search-input-wrap")],
            [
              icon<Message>("search"),
              h.input([
                h.Id("fd-search-input"),
                h.Class("fd-search-input"),
                h.Type("text"),
                h.Role("combobox"),
                h.AriaExpanded(options.searchResults.length > 0),
                h.AriaControls("fd-search-results"),
                h.AriaHasPopup("listbox"),
                h.AriaAutocomplete("list"),
                h.AriaLabel(t.searchDocumentation),
                ...(options.activeSearchResultIndex >= 0
                  ? [
                      h.AriaActiveDescendant(
                        searchResultId(options.activeSearchResultIndex),
                      ),
                    ]
                  : []),
                h.Autocomplete("off"),
                h.Value(options.searchQuery),
                h.Placeholder(`${t.searchDocumentation}…`),
                h.Autofocus(true),
                h.OnInput(options.actions.updateSearch),
                h.OnKeyDownPreventDefault((key) =>
                  key === "ArrowDown" || key === "ArrowUp" || key === "Enter"
                    ? Option.some(options.actions.searchKeyDown(key))
                    : Option.none(),
                ),
              ]),
              h.button(
                [
                  h.Class("fd-search-close"),
                  h.OnClick(options.actions.closeSearch),
                  h.AriaLabel(t.closeSearch),
                ],
                ["Esc"],
              ),
            ],
          ),
          h.div(
            [
              h.Id("fd-search-results"),
              h.Class("fd-search-results"),
              h.Role("listbox"),
              h.AriaLabel(t.searchResults),
            ],
            [
              ...(options.searchQuery.trim().length === 0
                ? [h.p([h.Class("fd-search-empty")], [t.searchPrompt])]
                : options.searchLoading && options.searchResults.length === 0
                  ? [
                      h.p(
                        [h.Class("fd-search-empty"), h.AriaLive("polite")],
                        [t.searching],
                      ),
                    ]
                  : options.searchError.length > 0
                    ? [
                        h.p(
                          [h.Class("fd-search-empty"), h.AriaLive("polite")],
                          [t.searchUnavailable],
                        ),
                      ]
                    : options.searchResults.length === 0
                      ? [
                          h.p(
                            [h.Class("fd-search-empty"), h.AriaLive("polite")],
                            [
                              interpolateTranslation(t.noSearchResults, {
                                query: options.searchQuery,
                              }),
                            ],
                          ),
                        ]
                      : options.searchResults.map((result, index) =>
                          h.a(
                            [
                              h.Id(searchResultId(index)),
                              h.Href(result.url),
                              h.Role("option"),
                              h.AriaSelected(
                                index === options.activeSearchResultIndex,
                              ),
                              h.Tabindex(-1),
                              h.OnClick(
                                options.actions.selectSearchResult(result.url),
                              ),
                              h.Class(
                                `fd-search-result${index === options.activeSearchResultIndex ? " fd-search-result-active" : ""}`,
                              ),
                            ],
                            [
                              h.strong([], [result.title]),
                              h.span([], [result.excerpt]),
                            ],
                          ),
                        )),
            ],
          ),
          h.span(
            [h.Class("fd-sr-only"), h.AriaLive("polite")],
            options.searchResults.length > 0
              ? [
                  interpolateTranslation(t.searchResultsAvailable, {
                    count: options.searchResults.length,
                  }),
                ]
              : [],
          ),
        ],
      ),
    ],
  );
};

const keyboardWarmup = <Message>(): Html => {
  const h = html<Message>();
  return h.input([
    h.Id("fd-search-keyboard-warmup"),
    h.Type("text"),
    h.AriaHidden(true),
    h.Tabindex(-1),
    h.Class("fd-search-keyboard-warmup"),
  ]);
};

const markdownDocumentUrl = (site: SiteConfig, markdownUrl: string): string => {
  if (site.baseUrl === undefined) return markdownUrl;
  try {
    return new URL(
      markdownUrl.replace(/^\//u, ""),
      `${site.baseUrl.replace(/\/+$/u, "")}/`,
    ).toString();
  } catch {
    return markdownUrl;
  }
};

const pageActionsView = <Message>(
  options: DocsLayoutOptions<Message>,
): Html => {
  const h = html<Message>();
  const t = options.translations;
  if (!options.markdownEnabled) return h.empty;
  const sourceUrl = markdownDocumentUrl(options.site, options.markdownUrl);
  const prompt = interpolateTranslation(t.askAiAboutPage, { url: sourceUrl });
  const aiLinks = [
    {
      label: t.openInChatGPT,
      href: `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`,
    },
    {
      label: t.openInClaude,
      href: `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
    },
    {
      label: t.openInGrok,
      href: `https://grok.com/?q=${encodeURIComponent(prompt)}`,
    },
  ];

  return h.div(
    [h.Class("fd-page-actions")],
    [
      h.button(
        [
          h.OnClick(options.actions.copyMarkdown),
          h.Disabled(options.copyMarkdownStatus === "loading"),
          h.AriaLabel(t.copyPageMarkdown),
        ],
        [
          icon<Message>(
            options.copyMarkdownStatus === "copied" ? "check" : "copy",
          ),
          options.copyMarkdownStatus === "loading"
            ? t.loading
            : options.copyMarkdownStatus === "copied"
              ? t.copiedMarkdown
              : options.copyMarkdownStatus === "error"
                ? t.tryCopyAgain
                : t.copyMarkdown,
        ],
      ),
      h.details(
        [h.Class("fd-page-open")],
        [
          h.summary(
            [h.AriaLabel(t.openPageMenu), h.Title(t.openPageMenu)],
            [t.openPage, icon<Message>("chevron", "fd-page-open-chevron")],
          ),
          h.div(
            [h.Class("fd-page-open-menu"), h.Role("menu")],
            [
              h.a(
                [
                  h.Href(options.markdownUrl),
                  h.Target("_blank"),
                  h.Rel("noreferrer"),
                  h.Role("menuitem"),
                ],
                [
                  icon<Message>("markdown"),
                  h.span([h.Class("fd-page-open-label")], [t.viewAsMarkdown]),
                ],
              ),
              h.div([h.Class("fd-page-open-separator")], []),
              ...aiLinks.map(({ label, href }) =>
                h.a(
                  [
                    h.Href(href),
                    h.Target("_blank"),
                    h.Rel("noreferrer noopener"),
                    h.Role("menuitem"),
                  ],
                  [
                    h.span([h.Class("fd-page-open-label")], [label]),
                    icon<Message>("arrow", "fd-page-open-external"),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    ],
  );
};

export const docsLayout = <Message>(
  options: DocsLayoutOptions<Message>,
): Html => {
  const h = html<Message>();
  const t = options.translations;
  const pageContext =
    navigationContextForUrl(options.navigation, options.currentUrl)?.filter(
      (label, index, labels) => index === 0 || labels[index - 1] !== label,
    ) ?? [];
  const backgroundDisabled = options.searchOpen
    ? [h.AriaHidden(true), h.Attribute("inert", "")]
    : [];
  const sidebarBackgroundDisabled =
    options.narrowViewport && options.sidebarOpen
      ? [h.AriaHidden(true), h.Attribute("inert", "")]
      : [];
  const mobileMenuButton = h.button(
    [
      h.Id("fd-menu-trigger"),
      h.Class("fd-header-icon-button fd-menu-button"),
      h.OnClick(options.actions.toggleSidebar),
      h.AriaLabel(t.openNavigation),
      h.AriaControls("fd-sidebar"),
      h.AriaExpanded(options.sidebarOpen),
    ],
    [icon<Message>("menu")],
  );
  const navItems = navigationView(
    options.navigation,
    options.currentUrl,
    options.collapsedSidebarGroups,
    options.actions.closeSidebar,
    options.actions.toggleSidebarGroup,
  );

  return h.div(
    [
      h.Class(`fd-root fd-layout-${options.preset ?? "docs"}`),
      h.Attribute("data-layout", options.preset ?? "docs"),
    ],
    [
      h.a(
        [h.Class("fd-skip-link"), h.Href("#main-content")],
        [t.skipToContent],
      ),
      keyboardWarmup(),
      h.header(
        [h.Class("fd-header fd-docs-header"), ...backgroundDisabled],
        [
          h.div(
            [h.Class("fd-header-inner")],
            [
              brandView(options.site, options.homeUrl, t.home),
              headerActions(
                options.site,
                options.themePreference,
                options.actions.selectTheme,
                options.actions.toggleSearch,
                options.searchOpen,
                options.locales,
                t,
                mobileMenuButton,
              ),
            ],
          ),
        ],
      ),
      h.div(
        [
          h.Class("fd-mobile-toc-shell"),
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
          ),
        ],
      ),
      h.aside(
        [
          h.Class(`fd-sidebar${options.sidebarOpen ? " fd-sidebar-open" : ""}`),
          h.Id("fd-sidebar"),
          ...(options.narrowViewport && !options.sidebarOpen
            ? [h.AriaHidden(true), h.Attribute("inert", "")]
            : []),
          ...(options.narrowViewport && options.sidebarOpen
            ? [
                h.Role("dialog"),
                h.AriaModal(true),
                h.AriaLabel(t.documentationNavigation),
                h.Tabindex(-1),
              ]
            : []),
        ],
        [
          h.div(
            [h.Class("fd-sidebar-mobile-header")],
            [
              brandView(options.site, options.homeUrl, t.home),
              h.button(
                [
                  h.Class("fd-header-icon-button"),
                  h.OnClick(options.actions.closeSidebar),
                  h.AriaLabel(t.closeNavigation),
                ],
                [icon<Message>("close")],
              ),
            ],
          ),
          layoutTabsView(options.tabs, t),
          h.nav([h.AriaLabel(t.documentation)], [h.ul([], navItems)]),
          h.div(
            [h.Class("fd-sidebar-mobile-footer")],
            [
              themeSelector(
                options.themePreference,
                options.actions.selectTheme,
                t,
              ),
              languageSelector(options.locales, t),
              h.div([h.Class("fd-social-links")], socialLinks(options.site)),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class("fd-docs-body"), ...backgroundDisabled],
        [
          h.main(
            [
              h.Id("main-content"),
              h.Class("fd-main"),
              h.Tabindex(-1),
              ...sidebarBackgroundDisabled,
            ],
            [
              h.div(
                [h.Class("fd-content-column")],
                [
                  h.article(
                    [h.Class("fd-article")],
                    [
                      ...(pageContext.length === 0
                        ? []
                        : [
                            h.div(
                              [
                                h.Class("fd-page-context"),
                                h.AriaLabel(t.documentationNavigation),
                              ],
                              pageContext.flatMap((label, index) => [
                                ...(index === 0
                                  ? []
                                  : [
                                      icon<Message>(
                                        "chevronRight",
                                        "fd-page-context-separator",
                                      ),
                                    ]),
                                h.span([], [label]),
                              ]),
                            ),
                          ]),
                      h.h1(
                        [h.Class("fd-page-title")],
                        [options.page.frontmatter.title],
                      ),
                      ...(options.page.frontmatter.description === undefined
                        ? []
                        : [
                            h.p(
                              [h.Class("fd-page-description")],
                              [options.page.frontmatter.description],
                            ),
                          ]),
                      pageActionsView(options),
                      renderMarkdown(
                        {
                          blocks:
                            options.page.document.blocks[0]?._tag ===
                              "Heading" &&
                            options.page.document.blocks[0].level === 1
                              ? options.page.document.blocks.slice(1)
                              : options.page.document.blocks,
                        },
                        options.markdown,
                      ),
                      h.nav(
                        [h.Class("fd-pager"), h.AriaLabel(t.pagination)],
                        [
                          options.previous === undefined
                            ? h.span([], [])
                            : h.a(
                                [
                                  h.Href(options.previous.url),
                                  h.Class(
                                    "fd-pager-link fd-pager-link-previous",
                                  ),
                                ],
                                [
                                  h.span(
                                    [h.Class("fd-pager-direction")],
                                    [t.previousPage],
                                  ),
                                  h.span(
                                    [h.Class("fd-pager-title")],
                                    [
                                      icon<Message>(
                                        "chevronLeft",
                                        "fd-pager-arrow",
                                      ),
                                      h.span(
                                        [],
                                        [options.previous.frontmatter.title],
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
                                  h.Class("fd-pager-link fd-pager-link-next"),
                                ],
                                [
                                  h.span(
                                    [h.Class("fd-pager-direction")],
                                    [t.nextPage],
                                  ),
                                  h.span(
                                    [h.Class("fd-pager-title")],
                                    [
                                      h.span(
                                        [],
                                        [options.next.frontmatter.title],
                                      ),
                                      icon<Message>(
                                        "chevronRight",
                                        "fd-pager-arrow",
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                        ],
                      ),
                    ],
                  ),
                  h.footer(
                    [h.Class("fd-doc-footer")],
                    [
                      h.div(
                        [h.Class("fd-doc-footer-inner")],
                        [
                          h.span([], [t.builtWith]),
                          h.a([h.Href(options.docsUrl)], [t.documentation]),
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
              ),
            ],
          ),
        ],
      ),
      searchDialogView(options),
    ],
  );
};

export const landingLayout = <Message>(
  options: LandingLayoutOptions<Message>,
): Html => {
  const h = html<Message>();
  const t = options.translations;
  const command = options.landing.command;
  const sectionGlyph = (value: string): Html =>
    h.div(
      [h.Class("fd-landing-glyph"), h.AriaHidden(true)],
      [h.span([], [value])],
    );
  const feature = (
    iconName: IconName,
    title: string,
    description: string,
  ): Html =>
    h.article(
      [h.Class("fd-landing-card")],
      [
        icon<Message>(iconName, "fd-landing-card-icon"),
        h.h3([], [title]),
        h.p([], [description]),
      ],
    );
  const checkItem = (value: string): Html =>
    h.li([], [icon<Message>("check"), h.span([], [value])]);

  return h.div(
    [h.Class("fd-root fd-landing-root")],
    [
      h.a(
        [h.Class("fd-skip-link"), h.Href("#main-content")],
        [t.skipToContent],
      ),
      h.header(
        [h.Class("fd-header fd-landing-header")],
        [
          h.div(
            [h.Class("fd-header-inner")],
            [
              brandView(options.site, options.homeUrl, t.home),
              h.nav(
                [h.Class("fd-landing-nav"), h.AriaLabel(t.mainNavigation)],
                [
                  languageSelector(options.locales, t),
                  themeSelector(
                    options.themePreference,
                    options.actions.selectTheme,
                    t,
                  ),
                  h.a(
                    [h.Class("fd-dive-in"), h.Href(options.docsUrl)],
                    [t.diveIn, icon<Message>("arrow")],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      h.main(
        [h.Id("main-content")],
        [
          ...(options.landing.sections.includes("hero")
            ? [
                h.section(
                  [h.Class("fd-landing-section fd-hero")],
                  [
                    h.div(
                      [h.Class("fd-landing-section-inner")],
                      [
                        h.div(
                          [h.Class("fd-hero-brand")],
                          [brandView(options.site, options.homeUrl, t.home)],
                        ),
                        h.h1(
                          [],
                          options.landing.headline === undefined
                            ? [
                                "The documentation framework for ",
                                h.span([], ["Foldkit"]),
                                ".",
                              ]
                            : [options.landing.headline],
                        ),
                        h.p(
                          [h.Class("fd-hero-copy")],
                          [
                            options.landing.description ??
                              options.site.tagline ??
                              options.site.description ??
                              "Beautiful, searchable, LLM-ready documentation for Foldkit, powered by Effect.",
                          ],
                        ),
                        h.div(
                          [h.Class("fd-install-command")],
                          [
                            h.code([], [h.span([], ["$"]), ` ${command}`]),
                            h.button(
                              [
                                h.OnClick(options.actions.copyText(command)),
                                h.AriaLabel(t.copyCreateCommand),
                              ],
                              [
                                icon<Message>(
                                  options.copiedText === command
                                    ? "check"
                                    : "copy",
                                ),
                                options.copiedText === command
                                  ? t.copied
                                  : t.copy,
                              ],
                            ),
                          ],
                        ),
                        h.div(
                          [h.Class("fd-hero-actions")],
                          [
                            h.a(
                              [
                                h.Class("fd-button fd-button-primary"),
                                h.Href(options.docsUrl),
                              ],
                              [t.readTheDocs, icon<Message>("arrow")],
                            ),
                            ...(options.site.githubUrl === undefined
                              ? []
                              : [
                                  h.a(
                                    [
                                      h.Class("fd-button fd-button-secondary"),
                                      h.Href(options.site.githubUrl),
                                      h.Target("_blank"),
                                      h.Rel("noreferrer noopener"),
                                    ],
                                    [icon<Message>("github"), t.viewOnGitHub],
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
          ...(options.landing.sections.includes("overview")
            ? [
                sectionGlyph("{ }"),
                h.section(
                  [h.Class("fd-landing-section")],
                  [
                    h.div(
                      [h.Class("fd-landing-section-inner")],
                      [
                        h.h2([], ["Write docs. Ship. Repeat."]),
                        h.p(
                          [h.Class("fd-landing-lede")],
                          [
                            "Foldocs gives you the complete documentation architecture, so you can focus on explaining your product.",
                          ],
                        ),
                        h.div(
                          [h.Class("fd-landing-grid fd-landing-grid-three")],
                          [
                            feature(
                              "lock",
                              "Content first",
                              "Add Markdown or MDX. Routes, navigation, frontmatter, tables of contents, and highlighting stay in sync automatically.",
                            ),
                            feature(
                              "bolt",
                              "Foldkit native",
                              "Every generated site is a Foldkit application, with its layout, routing, commands, and subscriptions ready to extend.",
                            ),
                            feature(
                              "expand",
                              "Scales with grace",
                              "Use meta.json route groups to keep a five-page guide and a thousand-page reference equally deliberate.",
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ]
            : []),
          ...(options.landing.sections.includes("stack")
            ? [
                sectionGlyph("=>"),
                h.section(
                  [h.Class("fd-landing-section fd-landing-section-compact")],
                  [
                    h.div(
                      [h.Class("fd-landing-section-inner")],
                      [
                        h.h2(
                          [],
                          [
                            "Built on ",
                            h.span([], ["Foldkit"]),
                            ". Powered by Effect.",
                          ],
                        ),
                        h.p(
                          [h.Class("fd-landing-lede")],
                          [
                            "A Foldkit application generated with one opinionated stack and no compatibility questionnaire.",
                          ],
                        ),
                        h.ul(
                          [h.Class("fd-landing-checks")],
                          [
                            checkItem(
                              "Every generated documentation site is a Foldkit application",
                            ),
                            checkItem(
                              "All runtime state and messages are typed with Effect Schema",
                            ),
                            checkItem(
                              "Local search and provider failures use Effect contracts",
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ]
            : []),
          ...(options.landing.sections.includes("features")
            ? [
                sectionGlyph("|>"),
                h.section(
                  [h.Class("fd-landing-section")],
                  [
                    h.div(
                      [h.Class("fd-landing-section-inner")],
                      [
                        h.h2([], ["Batteries included."]),
                        h.p(
                          [h.Class("fd-landing-lede")],
                          [
                            "The parts a real documentation site needs already work together.",
                          ],
                        ),
                        h.div(
                          [h.Class("fd-landing-grid fd-landing-grid-features")],
                          [
                            feature(
                              "search",
                              "Local search",
                              "Fast keyboard-first Orama search with a provider-neutral interface.",
                            ),
                            feature(
                              "markdown",
                              "Markdown URLs",
                              "Every page has a processed .md endpoint plus copy and view actions.",
                            ),
                            feature(
                              "system",
                              "Responsive shell",
                              "Desktop sidebar, mobile dialog, table of contents, and persistent themes.",
                            ),
                            feature(
                              "copy",
                              "Authoring tools",
                              "Syntax highlighting, code copying, callouts, cards, steps, tables, and tasks.",
                            ),
                            feature(
                              "arrow",
                              "Generated outputs",
                              "Sitemap, llms.txt, llms-full.txt, metadata, and production assets.",
                            ),
                            feature(
                              "github",
                              "Ready to own",
                              "A normal generated repository with reusable packages and editable content.",
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ]
            : []),
          ...(options.landing.sections.includes("ai")
            ? [
                sectionGlyph("~~"),
                h.section(
                  [h.Class("fd-landing-section fd-ai-section")],
                  [
                    h.div(
                      [h.Class("fd-landing-section-inner")],
                      [
                        h.h2([], ["Built for humans. Readable by AI."]),
                        h.p(
                          [h.Class("fd-landing-lede")],
                          [
                            "LLM indexes, complete Markdown output, content negotiation, and stable page URLs ship with the same source your readers see.",
                          ],
                        ),
                        h.a(
                          [
                            h.Class("fd-button fd-button-secondary"),
                            h.Href(options.docsUrl),
                          ],
                          [t.exploreDocumentation, icon<Message>("arrow")],
                        ),
                      ],
                    ),
                  ],
                ),
              ]
            : []),
          ...(options.landing.sections.includes("proof")
            ? [
                sectionGlyph("..."),
                h.section(
                  [h.Class("fd-landing-section fd-proof-section")],
                  [
                    h.div(
                      [h.Class("fd-landing-section-inner")],
                      [
                        h.h2([], ["Everything is connected."]),
                        h.div(
                          [h.Class("fd-proof-grid")],
                          [
                            h.div(
                              [],
                              [
                                h.span([], ["CONTENT"]),
                                h.strong([], [".md + .mdx"]),
                              ],
                            ),
                            h.div(
                              [],
                              [
                                h.span([], ["RUNTIME"]),
                                h.strong([], ["Foldkit + Effect"]),
                              ],
                            ),
                            h.div(
                              [],
                              [
                                h.span([], ["SEARCH"]),
                                h.strong([], ["Local by default"]),
                              ],
                            ),
                            h.div(
                              [],
                              [
                                h.span([], ["AGENTS"]),
                                h.strong([], ["LLM ready"]),
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
          ...(options.landing.sections.includes("cta")
            ? [
                sectionGlyph("->"),
                h.section(
                  [h.Class("fd-landing-section fd-final-cta")],
                  [
                    h.div(
                      [h.Class("fd-landing-section-inner")],
                      [
                        h.h2([], ["Start writing."]),
                        h.p(
                          [h.Class("fd-landing-lede")],
                          [
                            "Create the app once. From then on, your documentation is just content.",
                          ],
                        ),
                        h.div(
                          [h.Class("fd-hero-actions")],
                          [
                            h.a(
                              [
                                h.Class("fd-button fd-button-primary"),
                                h.Href(options.docsUrl),
                              ],
                              [t.diveIn, icon<Message>("arrow")],
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
      h.footer(
        [h.Class("fd-home-footer")],
        [
          brandView(options.site, options.homeUrl, t.home),
          h.span([], [t.builtWith]),
          h.div([h.Class("fd-social-links")], socialLinks(options.site)),
        ],
      ),
    ],
  );
};
