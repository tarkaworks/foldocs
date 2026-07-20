import type { TocItem } from "@effectdocs/content";
import type { SearchResult } from "@effectdocs/search";
import type {
  NavigationNode,
  PageManifestEntry,
  SiteConfig,
} from "effectdocs-core";
import type { CompiledPage } from "effectdocs-mdx";
import { Option } from "effect";
import { type Html, html } from "foldkit/html";

import { renderMarkdown, type MarkdownViewOptions } from "./markdown.js";
import { icons, type IconName } from "./icons.js";

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
  readonly actions: SearchActions<Message>;
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
  readonly navigation: ReadonlyArray<NavigationNode>;
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
  readonly docsUrl: string;
  readonly theme: "light" | "dark";
  readonly themePreference: ThemePreference;
  readonly copiedText: string;
  readonly actions: LandingLayoutActions<Message>;
}

const icon = <Message>(name: IconName, className = "ed-icon"): Html => {
  const h = html<Message>();
  return h.span([h.Class(className), h.InnerHTML(icons[name])], []);
};

const brandView = <Message>(site: SiteConfig, homeUrl = "/"): Html => {
  const h = html<Message>();
  return h.a(
    [h.Class("ed-brand"), h.Href(homeUrl), h.AriaLabel(`${site.title} home`)],
    [
      h.span(
        [
          h.Class("ed-brand-mark"),
          h.AriaHidden(true),
          h.InnerHTML(
            '<svg viewBox="0 0 180 180" fill="currentColor"><rect x="41.25" y="41.25" width="45" height="97.5"/><rect x="93.75" y="41.25" width="45" height="18.75"/><rect x="93.75" y="67.5" width="45" height="18.75"/></svg>',
          ),
        ],
        [],
      ),
      h.span([h.Class("ed-brand-name")], [site.logoText ?? site.title]),
      ...(site.badge === undefined
        ? []
        : [h.span([h.Class("ed-brand-badge")], [site.badge])]),
    ],
  );
};

const themeSelector = <Message>(
  preference: ThemePreference,
  selectTheme: (preference: ThemePreference) => Message,
): Html => {
  const h = html<Message>();
  const entries = [
    ["light", "Light", "light"],
    ["system", "System", "system"],
    ["dark", "Dark", "dark"],
  ] as const;
  return h.div(
    [h.Class("ed-theme-selector"), h.Role("group"), h.AriaLabel("Color theme")],
    entries.map(([value, label, iconName]) =>
      h.button(
        [
          h.Class(value === preference ? "ed-theme-active" : ""),
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
              h.Class("ed-social-link"),
              h.Href(href),
              h.Target("_blank"),
              h.Rel("noreferrer noopener"),
              h.AriaLabel(label),
              h.Title(label),
            ],
            [
              icon<Message>(
                iconName,
                iconName === "npm"
                  ? "ed-icon ed-social-npm-icon"
                  : "ed-icon ed-social-icon",
              ),
            ],
          ),
        ],
  );
};

const searchTrigger = <Message>(
  action: Message,
  expanded: boolean,
  mobile = false,
): Html => {
  const h = html<Message>();
  return h.button(
    [
      h.Class(
        mobile
          ? "ed-search-trigger ed-search-trigger-mobile"
          : "ed-search-trigger",
      ),
      h.OnClickFocus("#ed-search-keyboard-warmup", action),
      h.AriaExpanded(expanded),
      h.AriaHasPopup("dialog"),
      h.AriaLabel("Search documentation"),
    ],
    mobile
      ? [icon<Message>("search")]
      : [icon<Message>("search"), h.span([], ["Search"]), h.kbd([], ["⌘K"])],
  );
};

const headerActions = <Message>(
  site: SiteConfig,
  preference: ThemePreference,
  selectTheme: (preference: ThemePreference) => Message,
  searchAction: Message,
  searchOpen: boolean,
  mobileMenu?: Html,
): Html => {
  const h = html<Message>();
  return h.div(
    [h.Class("ed-header-actions")],
    [
      searchTrigger(searchAction, searchOpen),
      searchTrigger(searchAction, searchOpen, true),
      themeSelector(preference, selectTheme),
      h.div(
        [h.Class("ed-social-links ed-social-links-header")],
        socialLinks(site),
      ),
      ...(mobileMenu === undefined ? [] : [mobileMenu]),
    ],
  );
};

const nodeContainsUrl = (node: NavigationNode, currentUrl: string): boolean =>
  node._tag === "Page"
    ? node.url === currentUrl
    : node.children.some((child) => nodeContainsUrl(child, currentUrl));

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
    if (node._tag === "Page") {
      const active = node.url === currentUrl;
      return h.li(
        [],
        [
          h.a(
            [
              h.Href(node.url),
              h.Class(
                `ed-sidebar-link${active ? " ed-sidebar-link-active" : ""}`,
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
    const collapsed = !containsActive && collapsedGroups.includes(key);
    return h.li(
      [
        h.Class(
          `${depth === 0 ? "ed-sidebar-group" : "ed-sidebar-subgroup"}${collapsed ? " ed-sidebar-group-collapsed" : ""}`,
        ),
      ],
      [
        h.button(
          [
            h.Class(
              depth === 0
                ? "ed-sidebar-group-label"
                : "ed-sidebar-subgroup-label",
            ),
            h.OnClick(toggleGroup(key)),
            h.AriaExpanded(!collapsed),
            h.Disabled(containsActive),
          ],
          [
            h.span([], [node.label]),
            icon<Message>("chevron", "ed-sidebar-chevron"),
          ],
        ),
        ...(collapsed
          ? []
          : [
              h.div(
                [h.Class("ed-sidebar-group-panel")],
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

const tocItemsView = <Message>(
  toc: ReadonlyArray<TocItem>,
  activeTocId: string,
  selectToc: (id: string) => Message,
): ReadonlyArray<Html> => {
  const h = html<Message>();
  return toc.map((item) => {
    const active = item.id === activeTocId;
    return h.li(
      [h.Class(`ed-toc-depth-${item.depth}`)],
      [
        h.a(
          [
            h.Href(`#${item.id}`),
            h.OnClick(selectToc(item.id)),
            ...(active ? [h.AriaCurrent("location")] : []),
            h.Class(active ? "ed-toc-link-active" : ""),
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
): Html => {
  const h = html<Message>();
  return h.aside(
    [h.Class("ed-toc-shell")],
    [
      h.nav(
        [h.Class("ed-toc"), h.AriaLabel("On this page")],
        [
          h.div([h.Class("ed-toc-title")], ["On this page"]),
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
): Html => {
  const h = html<Message>();
  if (toc.length === 0) return h.empty;
  const activeTitle =
    toc.find((item) => item.id === activeTocId)?.title ?? toc[0]?.title ?? "";
  return h.details(
    [h.Class("ed-mobile-toc"), h.Open(open), h.OnToggle(setOpen)],
    [
      h.summary(
        [],
        [
          h.span([h.Class("ed-mobile-toc-label")], ["On this page"]),
          h.span([h.Class("ed-mobile-toc-current")], [activeTitle]),
          icon<Message>("chevron", "ed-mobile-toc-chevron"),
        ],
      ),
      h.nav(
        [h.AriaLabel("Table of contents")],
        [h.ul([], tocItemsView(toc, activeTocId, selectToc))],
      ),
    ],
  );
};

const searchResultId = (index: number): string => `ed-search-result-${index}`;

const searchDialogView = <Message>(options: SearchOptions<Message>): Html => {
  const h = html<Message>();
  if (!options.searchOpen) return h.empty;
  return h.div(
    [h.Class("ed-search-layer")],
    [
      h.button(
        [
          h.Class("ed-search-backdrop"),
          h.AriaLabel("Close search"),
          h.OnClick(options.actions.closeSearch),
        ],
        [],
      ),
      h.div(
        [
          h.Class("ed-search-dialog"),
          h.Role("dialog"),
          h.AriaModal(true),
          h.AriaLabel("Search documentation"),
        ],
        [
          h.div(
            [h.Class("ed-search-input-wrap")],
            [
              icon<Message>("search"),
              h.input([
                h.Id("ed-search-input"),
                h.Class("ed-search-input"),
                h.Type("text"),
                h.Role("combobox"),
                h.AriaExpanded(options.searchResults.length > 0),
                h.AriaControls("ed-search-results"),
                h.AriaHasPopup("listbox"),
                h.AriaAutocomplete("list"),
                h.AriaLabel("Search documentation"),
                ...(options.activeSearchResultIndex >= 0
                  ? [
                      h.AriaActiveDescendant(
                        searchResultId(options.activeSearchResultIndex),
                      ),
                    ]
                  : []),
                h.Autocomplete("off"),
                h.Value(options.searchQuery),
                h.Placeholder("Search documentation…"),
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
                  h.Class("ed-search-close"),
                  h.OnClick(options.actions.closeSearch),
                ],
                ["Esc"],
              ),
            ],
          ),
          h.div(
            [
              h.Id("ed-search-results"),
              h.Class("ed-search-results"),
              h.Role("listbox"),
              h.AriaLabel("Search results"),
            ],
            [
              ...(options.searchQuery.trim().length === 0
                ? [
                    h.p(
                      [h.Class("ed-search-empty")],
                      ["Start typing to search every document."],
                    ),
                  ]
                : options.searchLoading && options.searchResults.length === 0
                  ? [
                      h.p(
                        [h.Class("ed-search-empty"), h.AriaLive("polite")],
                        ["Searching…"],
                      ),
                    ]
                  : options.searchError.length > 0
                    ? [
                        h.p(
                          [h.Class("ed-search-empty"), h.AriaLive("polite")],
                          ["Search is temporarily unavailable."],
                        ),
                      ]
                    : options.searchResults.length === 0
                      ? [
                          h.p(
                            [h.Class("ed-search-empty"), h.AriaLive("polite")],
                            [`No results for “${options.searchQuery}”.`],
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
                                `ed-search-result${index === options.activeSearchResultIndex ? " ed-search-result-active" : ""}`,
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
            [h.Class("ed-sr-only"), h.AriaLive("polite")],
            options.searchResults.length > 0
              ? [`${options.searchResults.length} results available.`]
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
    h.Id("ed-search-keyboard-warmup"),
    h.Type("text"),
    h.AriaHidden(true),
    h.Tabindex(-1),
    h.Class("ed-search-keyboard-warmup"),
  ]);
};

export const docsLayout = <Message>(
  options: DocsLayoutOptions<Message>,
): Html => {
  const h = html<Message>();
  const backgroundDisabled = options.searchOpen
    ? [h.AriaHidden(true), h.Attribute("inert", "")]
    : [];
  const sidebarBackgroundDisabled =
    options.narrowViewport && options.sidebarOpen
      ? [h.AriaHidden(true), h.Attribute("inert", "")]
      : [];
  const mobileMenuButton = h.button(
    [
      h.Class("ed-header-icon-button ed-menu-button"),
      h.OnClick(options.actions.toggleSidebar),
      h.AriaLabel("Open navigation"),
      h.AriaControls("ed-sidebar"),
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
    [h.Class(`ed-root ${options.theme}`)],
    [
      h.a(
        [h.Class("ed-skip-link"), h.Href("#main-content")],
        ["Skip to content"],
      ),
      keyboardWarmup(),
      h.header(
        [h.Class("ed-header ed-docs-header"), ...backgroundDisabled],
        [
          h.div(
            [h.Class("ed-header-inner")],
            [
              brandView(options.site),
              headerActions(
                options.site,
                options.themePreference,
                options.actions.selectTheme,
                options.actions.toggleSearch,
                options.searchOpen,
                mobileMenuButton,
              ),
            ],
          ),
        ],
      ),
      h.div(
        [
          h.Class("ed-mobile-toc-shell"),
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
          ),
        ],
      ),
      h.aside(
        [
          h.Class(`ed-sidebar${options.sidebarOpen ? " ed-sidebar-open" : ""}`),
          h.Id("ed-sidebar"),
          ...(options.narrowViewport && !options.sidebarOpen
            ? [h.AriaHidden(true), h.Attribute("inert", "")]
            : []),
          ...(options.narrowViewport && options.sidebarOpen
            ? [
                h.Role("dialog"),
                h.AriaModal(true),
                h.AriaLabel("Documentation navigation"),
              ]
            : []),
        ],
        [
          h.div(
            [h.Class("ed-sidebar-mobile-header")],
            [
              brandView(options.site),
              h.button(
                [
                  h.Class("ed-header-icon-button"),
                  h.OnClick(options.actions.closeSidebar),
                  h.AriaLabel("Close navigation"),
                ],
                [icon<Message>("close")],
              ),
            ],
          ),
          h.nav([h.AriaLabel("Documentation")], [h.ul([], navItems)]),
          h.div(
            [h.Class("ed-sidebar-mobile-footer")],
            [
              themeSelector(
                options.themePreference,
                options.actions.selectTheme,
              ),
              h.div([h.Class("ed-social-links")], socialLinks(options.site)),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class("ed-docs-body"), ...backgroundDisabled],
        [
          h.main(
            [
              h.Id("main-content"),
              h.Class("ed-main"),
              h.Tabindex(-1),
              ...sidebarBackgroundDisabled,
            ],
            [
              h.article(
                [h.Class("ed-article")],
                [
                  h.h1(
                    [h.Class("ed-page-title")],
                    [options.page.frontmatter.title],
                  ),
                  ...(options.page.frontmatter.description === undefined
                    ? []
                    : [
                        h.p(
                          [h.Class("ed-page-description")],
                          [options.page.frontmatter.description],
                        ),
                      ]),
                  ...(options.markdownEnabled
                    ? [
                        h.div(
                          [h.Class("ed-page-actions")],
                          [
                            h.button(
                              [
                                h.OnClick(options.actions.copyMarkdown),
                                h.Disabled(
                                  options.copyMarkdownStatus === "loading",
                                ),
                                h.AriaLabel("Copy page as Markdown"),
                              ],
                              [
                                icon<Message>(
                                  options.copyMarkdownStatus === "copied"
                                    ? "check"
                                    : "copy",
                                ),
                                options.copyMarkdownStatus === "loading"
                                  ? "Loading…"
                                  : options.copyMarkdownStatus === "copied"
                                    ? "Copied Markdown"
                                    : options.copyMarkdownStatus === "error"
                                      ? "Try Copy Again"
                                      : "Copy Markdown",
                              ],
                            ),
                            h.a(
                              [
                                h.Href(options.markdownUrl),
                                h.Target("_blank"),
                                h.Rel("noreferrer"),
                              ],
                              [icon<Message>("markdown"), "View as Markdown"],
                            ),
                          ],
                        ),
                      ]
                    : []),
                  renderMarkdown(
                    {
                      blocks:
                        options.page.document.blocks[0]?._tag === "Heading" &&
                        options.page.document.blocks[0].level === 1
                          ? options.page.document.blocks.slice(1)
                          : options.page.document.blocks,
                    },
                    options.markdown,
                  ),
                  h.nav(
                    [h.Class("ed-pager"), h.AriaLabel("Pagination")],
                    [
                      options.previous === undefined
                        ? h.span([], [])
                        : h.a(
                            [h.Href(options.previous.url)],
                            [
                              h.span(
                                [
                                  h.Class(
                                    "ed-pager-arrow ed-pager-arrow-previous",
                                  ),
                                ],
                                ["←"],
                              ),
                              h.span([], [options.previous.frontmatter.title]),
                            ],
                          ),
                      options.next === undefined
                        ? h.span([], [])
                        : h.a(
                            [
                              h.Href(options.next.url),
                              h.Class("ed-pager-next"),
                            ],
                            [
                              h.span([], [options.next.frontmatter.title]),
                              h.span([h.Class("ed-pager-arrow")], ["→"]),
                            ],
                          ),
                    ],
                  ),
                  h.footer(
                    [h.Class("ed-doc-footer")],
                    [
                      h.span([], ["Built with Effectdocs and Foldkit."]),
                      h.a([h.Href(options.docsUrl)], ["Documentation"]),
                    ],
                  ),
                ],
              ),
              tocView(
                options.page.toc,
                options.activeTocId,
                options.actions.selectToc,
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
  const command = "pnpm create effectdocs@latest";
  const sectionGlyph = (value: string): Html =>
    h.div(
      [h.Class("ed-landing-glyph"), h.AriaHidden(true)],
      [h.span([], [value])],
    );
  const feature = (
    iconName: IconName,
    title: string,
    description: string,
  ): Html =>
    h.article(
      [h.Class("ed-landing-card")],
      [
        icon<Message>(iconName, "ed-landing-card-icon"),
        h.h3([], [title]),
        h.p([], [description]),
      ],
    );
  const checkItem = (value: string): Html =>
    h.li([], [icon<Message>("check"), h.span([], [value])]);

  return h.div(
    [h.Class(`ed-root ed-landing-root ${options.theme}`)],
    [
      h.a(
        [h.Class("ed-skip-link"), h.Href("#main-content")],
        ["Skip to content"],
      ),
      h.header(
        [h.Class("ed-header ed-landing-header")],
        [
          h.div(
            [h.Class("ed-header-inner")],
            [
              brandView(options.site),
              h.nav(
                [h.Class("ed-landing-nav"), h.AriaLabel("Main")],
                [
                  themeSelector(
                    options.themePreference,
                    options.actions.selectTheme,
                  ),
                  h.a(
                    [h.Class("ed-dive-in"), h.Href(options.docsUrl)],
                    ["Dive In", icon<Message>("arrow")],
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
          h.section(
            [h.Class("ed-landing-section ed-hero")],
            [
              h.div(
                [h.Class("ed-landing-section-inner")],
                [
                  h.div([h.Class("ed-hero-brand")], [brandView(options.site)]),
                  h.h1(
                    [],
                    [
                      "The documentation framework for ",
                      h.span([], ["Effect"]),
                      ".",
                    ],
                  ),
                  h.p(
                    [h.Class("ed-hero-copy")],
                    [
                      options.site.tagline ??
                        options.site.description ??
                        "Beautiful, searchable, LLM-ready documentation powered by Effect and Foldkit.",
                    ],
                  ),
                  h.div(
                    [h.Class("ed-install-command")],
                    [
                      h.code([], [h.span([], ["$"]), ` ${command}`]),
                      h.button(
                        [
                          h.OnClick(options.actions.copyText(command)),
                          h.AriaLabel("Copy create command"),
                        ],
                        [
                          icon<Message>(
                            options.copiedText === command ? "check" : "copy",
                          ),
                          options.copiedText === command ? "Copied" : "Copy",
                        ],
                      ),
                    ],
                  ),
                  h.div(
                    [h.Class("ed-hero-actions")],
                    [
                      h.a(
                        [
                          h.Class("ed-button ed-button-primary"),
                          h.Href(options.docsUrl),
                        ],
                        ["Read the docs", icon<Message>("arrow")],
                      ),
                      ...(options.site.githubUrl === undefined
                        ? []
                        : [
                            h.a(
                              [
                                h.Class("ed-button ed-button-secondary"),
                                h.Href(options.site.githubUrl),
                                h.Target("_blank"),
                                h.Rel("noreferrer noopener"),
                              ],
                              [icon<Message>("github"), "View on GitHub"],
                            ),
                          ]),
                    ],
                  ),
                ],
              ),
            ],
          ),
          sectionGlyph("{ }"),
          h.section(
            [h.Class("ed-landing-section")],
            [
              h.div(
                [h.Class("ed-landing-section-inner")],
                [
                  h.h2([], ["Write docs. Ship. Repeat."]),
                  h.p(
                    [h.Class("ed-landing-lede")],
                    [
                      "Effectdocs gives you the complete documentation architecture, so you can focus on explaining your product.",
                    ],
                  ),
                  h.div(
                    [h.Class("ed-landing-grid ed-landing-grid-three")],
                    [
                      feature(
                        "lock",
                        "Content first",
                        "Add Markdown or MDX. Routes, navigation, frontmatter, tables of contents, and highlighting stay in sync automatically.",
                      ),
                      feature(
                        "bolt",
                        "Effect native",
                        "Page loading, search, routing, commands, subscriptions, and failures are modeled with Effect from end to end.",
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
          sectionGlyph("=>"),
          h.section(
            [h.Class("ed-landing-section ed-landing-section-compact")],
            [
              h.div(
                [h.Class("ed-landing-section-inner")],
                [
                  h.h2(
                    [],
                    ["Built on ", h.span([], ["Effect"]), ". Inside and out."],
                  ),
                  h.p(
                    [h.Class("ed-landing-lede")],
                    [
                      "A Foldkit application generated with one opinionated stack and no compatibility questionnaire.",
                    ],
                  ),
                  h.ul(
                    [h.Class("ed-landing-checks")],
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
          sectionGlyph("|>"),
          h.section(
            [h.Class("ed-landing-section")],
            [
              h.div(
                [h.Class("ed-landing-section-inner")],
                [
                  h.h2([], ["Batteries included."]),
                  h.p(
                    [h.Class("ed-landing-lede")],
                    [
                      "The parts a real documentation site needs already work together.",
                    ],
                  ),
                  h.div(
                    [h.Class("ed-landing-grid ed-landing-grid-features")],
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
          sectionGlyph("~~"),
          h.section(
            [h.Class("ed-landing-section ed-ai-section")],
            [
              h.div(
                [h.Class("ed-landing-section-inner")],
                [
                  h.h2([], ["Built for humans. Readable by AI."]),
                  h.p(
                    [h.Class("ed-landing-lede")],
                    [
                      "LLM indexes, complete Markdown output, content negotiation, and stable page URLs ship with the same source your readers see.",
                    ],
                  ),
                  h.a(
                    [
                      h.Class("ed-button ed-button-secondary"),
                      h.Href(options.docsUrl),
                    ],
                    ["Explore the documentation", icon<Message>("arrow")],
                  ),
                ],
              ),
            ],
          ),
          sectionGlyph("..."),
          h.section(
            [h.Class("ed-landing-section ed-proof-section")],
            [
              h.div(
                [h.Class("ed-landing-section-inner")],
                [
                  h.h2([], ["Everything is connected."]),
                  h.div(
                    [h.Class("ed-proof-grid")],
                    [
                      h.div(
                        [],
                        [h.span([], ["CONTENT"]), h.strong([], [".md + .mdx"])],
                      ),
                      h.div(
                        [],
                        [
                          h.span([], ["RUNTIME"]),
                          h.strong([], ["Effect + Foldkit"]),
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
                        [h.span([], ["AGENTS"]), h.strong([], ["LLM ready"])],
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          sectionGlyph("->"),
          h.section(
            [h.Class("ed-landing-section ed-final-cta")],
            [
              h.div(
                [h.Class("ed-landing-section-inner")],
                [
                  h.h2([], ["Start writing."]),
                  h.p(
                    [h.Class("ed-landing-lede")],
                    [
                      "Create the app once. From then on, your documentation is just content.",
                    ],
                  ),
                  h.div(
                    [h.Class("ed-hero-actions")],
                    [
                      h.a(
                        [
                          h.Class("ed-button ed-button-primary"),
                          h.Href(options.docsUrl),
                        ],
                        ["Dive In", icon<Message>("arrow")],
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
        [h.Class("ed-home-footer")],
        [
          brandView(options.site),
          h.span([], ["Built with Effectdocs and Foldkit."]),
          h.div([h.Class("ed-social-links")], socialLinks(options.site)),
        ],
      ),
    ],
  );
};
