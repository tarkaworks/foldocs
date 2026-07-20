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

export interface DocsLayoutActions<Message> {
  readonly toggleSidebar: Message;
  readonly closeSidebar: Message;
  readonly toggleSearch: Message;
  readonly closeSearch: Message;
  readonly updateSearch: (query: string) => Message;
  readonly toggleTheme: Message;
}

export interface DocsLayoutOptions<Message> {
  readonly site: SiteConfig;
  readonly navigation: ReadonlyArray<NavigationNode>;
  readonly currentUrl: string;
  readonly page: CompiledPage;
  readonly previous?: PageManifestEntry<CompiledPage>;
  readonly next?: PageManifestEntry<CompiledPage>;
  readonly sidebarOpen: boolean;
  readonly searchOpen: boolean;
  readonly searchQuery: string;
  readonly searchResults: ReadonlyArray<SearchResult>;
  readonly theme: "light" | "dark";
  readonly actions: DocsLayoutActions<Message>;
  readonly markdown?: MarkdownViewOptions<Message>;
}

const navigationView = <Message>(
  nodes: ReadonlyArray<NavigationNode>,
  currentUrl: string,
): ReadonlyArray<Html> => {
  const h = html<Message>();
  return nodes.map((node) => {
    if (node._tag === "Page") {
      return h.li(
        [],
        [
          h.a(
            [
              h.Href(node.url),
              h.Class(
                `ed-sidebar-link${node.url === currentUrl ? " ed-sidebar-link-active" : ""}`,
              ),
              ...(node.url === currentUrl ? [h.AriaCurrent("page")] : []),
            ],
            [node.label],
          ),
        ],
      );
    }
    return h.li(
      [h.Class("ed-sidebar-group")],
      [
        h.div([h.Class("ed-sidebar-group-label")], [node.label]),
        h.ul([], navigationView<Message>(node.children, currentUrl)),
      ],
    );
  });
};

const tocView = <Message>(toc: ReadonlyArray<TocItem>): Html => {
  const h = html<Message>();
  return h.nav(
    [h.Class("ed-toc"), h.AriaLabel("On this page")],
    [
      h.div([h.Class("ed-toc-title")], ["On this page"]),
      h.ul(
        [],
        toc.map((item) =>
          h.li(
            [h.Class(`ed-toc-depth-${item.depth}`)],
            [h.a([h.Href(`#${item.id}`)], [item.title])],
          ),
        ),
      ),
    ],
  );
};

const searchDialogView = <Message>(
  options: DocsLayoutOptions<Message>,
): Html => {
  const h = html<Message>();
  if (!options.searchOpen) return h.empty;
  return h.div(
    [h.Class("ed-search-layer")],
    [
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
              h.span([h.AriaHidden(true)], ["⌕"]),
              h.input([
                h.Class("ed-search-input"),
                h.Type("search"),
                h.Value(options.searchQuery),
                h.Placeholder("Search documentation…"),
                h.Autofocus(true),
                h.OnInput(options.actions.updateSearch),
                h.OnKeyDownPreventDefault((key) =>
                  key === "Escape"
                    ? Option.some(options.actions.closeSearch)
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
            [h.Class("ed-search-results")],
            [
              ...(options.searchQuery.trim().length === 0
                ? [
                    h.p(
                      [h.Class("ed-search-empty")],
                      ["Start typing to search titles and document content."],
                    ),
                  ]
                : options.searchResults.length === 0
                  ? [h.p([h.Class("ed-search-empty")], ["No results found."])]
                  : options.searchResults.map((result) =>
                      h.a(
                        [h.Href(result.url), h.Class("ed-search-result")],
                        [
                          h.strong([], [result.title]),
                          h.span([], [result.excerpt]),
                        ],
                      ),
                    )),
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
  return h.div(
    [
      h.Class(`ed-root ${options.theme}`),
      h.OnKeyDownPreventDefault((key, modifiers) =>
        key.toLowerCase() === "k" && (modifiers.metaKey || modifiers.ctrlKey)
          ? Option.some(options.actions.toggleSearch)
          : key === "Escape" && (options.searchOpen || options.sidebarOpen)
            ? Option.some(
                options.searchOpen
                  ? options.actions.closeSearch
                  : options.actions.closeSidebar,
              )
            : Option.none(),
      ),
    ],
    [
      h.header(
        [h.Class("ed-header")],
        [
          h.div(
            [h.Class("ed-header-inner")],
            [
              h.button(
                [
                  h.Class("ed-icon-button ed-menu-button"),
                  h.OnClick(options.actions.toggleSidebar),
                  h.AriaLabel("Toggle navigation"),
                ],
                ["☰"],
              ),
              h.a(
                [
                  h.Href(
                    options.currentUrl.split("/").slice(0, 2).join("/") || "/",
                  ),
                ],
                [
                  h.span([h.Class("ed-logo-mark")], ["E"]),
                  h.span(
                    [h.Class("ed-logo-text")],
                    [options.site.logoText ?? options.site.title],
                  ),
                ],
              ),
              h.div(
                [h.Class("ed-header-actions")],
                [
                  h.button(
                    [
                      h.Class("ed-search-trigger"),
                      h.OnClick(options.actions.toggleSearch),
                    ],
                    [h.span([], ["Search documentation"]), h.kbd([], ["⌘ K"])],
                  ),
                  h.button(
                    [
                      h.Class("ed-icon-button"),
                      h.OnClick(options.actions.toggleTheme),
                      h.AriaLabel("Toggle color theme"),
                    ],
                    [options.theme === "dark" ? "☀" : "☾"],
                  ),
                  ...(options.site.githubUrl === undefined
                    ? []
                    : [
                        h.a(
                          [
                            h.Class("ed-icon-button"),
                            h.Href(options.site.githubUrl),
                            h.Target("_blank"),
                            h.Rel("noreferrer noopener"),
                            h.AriaLabel("GitHub repository"),
                          ],
                          ["↗"],
                        ),
                      ]),
                ],
              ),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class("ed-body")],
        [
          h.aside(
            [
              h.Class(
                `ed-sidebar${options.sidebarOpen ? " ed-sidebar-open" : ""}`,
              ),
            ],
            [
              h.nav(
                [h.AriaLabel("Documentation")],
                [
                  h.ul(
                    [],
                    navigationView<Message>(
                      options.navigation,
                      options.currentUrl,
                    ),
                  ),
                ],
              ),
            ],
          ),
          ...(options.sidebarOpen
            ? [
                h.button(
                  [
                    h.Class("ed-sidebar-backdrop"),
                    h.AriaLabel("Close navigation"),
                    h.OnClick(options.actions.closeSidebar),
                  ],
                  [],
                ),
              ]
            : []),
          h.main(
            [h.Class("ed-main")],
            [
              h.article(
                [h.Class("ed-article")],
                [
                  h.div([h.Class("ed-eyebrow")], ["Documentation"]),
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
                              h.small([], ["Previous"]),
                              h.strong(
                                [],
                                [options.previous.frontmatter.title],
                              ),
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
                              h.small([], ["Next"]),
                              h.strong([], [options.next.frontmatter.title]),
                            ],
                          ),
                    ],
                  ),
                ],
              ),
              tocView<Message>(options.page.toc),
            ],
          ),
        ],
      ),
      h.footer([h.Class("ed-footer")], ["Built with Effectdocs and Foldkit"]),
      searchDialogView(options),
    ],
  );
};
