import {
  SearchError,
  SearchResult,
  type SearchClient,
  type SearchDocument,
} from "@effectdocs/search";
import {
  adjacentPages,
  buildNavigation,
  findPageByUrl,
  type NavigationNode,
  type PageManifest,
  type SiteConfig,
} from "effectdocs-core";
import {
  CompiledPage,
  type CompiledPage as CompiledPageType,
} from "effectdocs-mdx";
import { docsLayout, landingLayout } from "effectdocs-ui";
import { Effect, Option, Queue, Schema as S, Stream } from "effect";
import { Command, Render, Subscription, type Runtime } from "foldkit";
import * as Dom from "foldkit/dom";
import { type Document, html } from "foldkit/html";
import { m } from "foldkit/message";
import { UrlRequest, load, pushUrl } from "foldkit/navigation";
import { Url, toString as urlToString } from "foldkit/url";

export interface DocsProgramOptions {
  readonly manifest: PageManifest<CompiledPageType>;
  readonly navigation?: ReadonlyArray<NavigationNode>;
  readonly site: SiteConfig;
  readonly search?: SearchClient;
  readonly markdown?: boolean;
}

const messageFromError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Creates the complete Foldkit program used by generated Effectdocs sites.
 * The returned schemas can be passed directly to `Runtime.makeApplication`.
 */
export const createDocsProgram = (options: DocsProgramOptions) => {
  const narrowViewportQuery = "(max-width: 48rem)";
  const manifest = options.manifest;
  const navigation = options.navigation ?? buildNavigation(manifest);
  const defaultCollapsedSidebarGroups = (() => {
    const groups: string[] = [];
    const visit = (
      nodes: ReadonlyArray<NavigationNode>,
      parentKey = "",
    ): void => {
      for (const node of nodes) {
        if (node._tag !== "Folder") continue;
        const key = `${parentKey}/${node.segment}`;
        if (!node.defaultOpen) groups.push(key);
        visit(node.children, key);
      }
    };
    visit(navigation);
    return groups;
  })();
  const docsUrl =
    manifest.find((page) => page.slug === "")?.url ??
    manifest[0]?.url ??
    "/docs";
  const searchDocuments: ReadonlyArray<SearchDocument> = manifest.map(
    (page) => ({
      id: page.id,
      url: page.url,
      title: page.frontmatter.title,
      ...(page.frontmatter.description === undefined
        ? {}
        : { description: page.frontmatter.description }),
      content: page.plainText,
      ...(page.frontmatter.tags === undefined
        ? {}
        : { tags: page.frontmatter.tags }),
    }),
  );
  let localSearch: Promise<SearchClient> | undefined;
  const defaultSearch: SearchClient = {
    provider: "orama",
    search: (query, searchOptions = {}) => {
      if (query.trim().length === 0) return Effect.succeed([]);
      return Effect.tryPromise({
        try: async () => {
          localSearch ??= import("@effectdocs/search-orama").then(
            ({ createOramaSearchClient }) =>
              createOramaSearchClient(searchDocuments),
          );
          return Effect.runPromise(
            (await localSearch).search(query, searchOptions),
          );
        },
        catch: (cause) => new SearchError("orama", cause),
      });
    },
  };
  const searchClient = options.search ?? defaultSearch;

  const PageLoading = m("PageLoading", { pathname: S.String });
  const PageHome = m("PageHome");
  const PageReady = m("PageReady", { pathname: S.String, page: CompiledPage });
  const PageFailed = m("PageFailed", { pathname: S.String, reason: S.String });
  const PageState = S.Union([PageHome, PageLoading, PageReady, PageFailed]);

  const Model = S.Struct({
    pathname: S.String,
    page: PageState,
    sidebarOpen: S.Boolean,
    searchOpen: S.Boolean,
    searchQuery: S.String,
    searchResults: S.Array(SearchResult),
    searchError: S.String,
    searchLoading: S.Boolean,
    activeSearchResultIndex: S.Number,
    activeTocId: S.String,
    mobileTocOpen: S.Boolean,
    narrowViewport: S.Boolean,
    collapsedSidebarGroups: S.Array(S.String),
    theme: S.Literals(["light", "dark"]),
    systemTheme: S.Literals(["light", "dark"]),
    themePreference: S.Literals(["light", "system", "dark"]),
    copiedText: S.String,
    copyMarkdownStatus: S.Literals(["idle", "loading", "copied", "error"]),
  });
  type Model = typeof Model.Type;

  const CompletedNavigateInternal = m("CompletedNavigateInternal");
  const CompletedLoadExternal = m("CompletedLoadExternal");
  const ClickedLink = m("ClickedLink", { request: UrlRequest });
  const ChangedUrl = m("ChangedUrl", { url: Url });
  const SucceededLoadPage = m("SucceededLoadPage", {
    pathname: S.String,
    page: CompiledPage,
  });
  const FailedLoadPage = m("FailedLoadPage", {
    pathname: S.String,
    reason: S.String,
  });
  const LoadPageResult = S.Union([SucceededLoadPage, FailedLoadPage]);
  const ChangedSearch = m("ChangedSearch", { query: S.String });
  const SucceededSearch = m("SucceededSearch", {
    query: S.String,
    results: S.Array(SearchResult),
  });
  const FailedSearch = m("FailedSearch", { query: S.String, reason: S.String });
  const SearchResultMessage = S.Union([SucceededSearch, FailedSearch]);
  const PressedSearchKey = m("PressedSearchKey", { key: S.String });
  const ChangedActiveSection = m("ChangedActiveSection", {
    sectionId: S.String,
  });
  const SelectedToc = m("SelectedToc", { sectionId: S.String });
  const ToggledMobileToc = m("ToggledMobileToc", { open: S.Boolean });
  const SelectedSearchResult = m("SelectedSearchResult", { url: S.String });
  const ChangedNarrowViewport = m("ChangedNarrowViewport", {
    narrow: S.Boolean,
  });
  const ToggledSidebar = m("ToggledSidebar");
  const ClosedSidebar = m("ClosedSidebar");
  const ToggledSearch = m("ToggledSearch");
  const ClosedSearch = m("ClosedSearch");
  const ToggledSidebarGroup = m("ToggledSidebarGroup", { key: S.String });
  const LoadedSidebarGroups = m("LoadedSidebarGroups", {
    groups: S.Array(S.String),
  });
  const CompletedSaveSidebarGroups = m("CompletedSaveSidebarGroups");
  const SelectedTheme = m("SelectedTheme", {
    preference: S.Literals(["light", "system", "dark"]),
  });
  const LoadedTheme = m("LoadedTheme", {
    preference: S.Literals(["light", "system", "dark"]),
    theme: S.Literals(["light", "dark"]),
    systemTheme: S.Literals(["light", "dark"]),
  });
  const ChangedSystemTheme = m("ChangedSystemTheme", {
    theme: S.Literals(["light", "dark"]),
  });
  const CompletedApplyTheme = m("CompletedApplyTheme");
  const CompletedSaveTheme = m("CompletedSaveTheme");
  const ClickedCopyText = m("ClickedCopyText", { value: S.String });
  const CompletedCopyText = m("CompletedCopyText", { value: S.String });
  const ClickedCopyMarkdown = m("ClickedCopyMarkdown", { url: S.String });
  const SucceededLoadMarkdown = m("SucceededLoadMarkdown", {
    markdown: S.String,
  });
  const FailedLoadMarkdown = m("FailedLoadMarkdown");
  const LoadMarkdownResult = S.Union([
    SucceededLoadMarkdown,
    FailedLoadMarkdown,
  ]);
  const CompletedFocusSearch = m("CompletedFocusSearch");
  const CompletedFocusSidebar = m("CompletedFocusSidebar");
  const CompletedScrollSearchResult = m("CompletedScrollSearchResult");
  const PressedGlobalKey = m("PressedGlobalKey", {
    key: S.String,
    ctrlKey: S.Boolean,
    metaKey: S.Boolean,
  });

  const Message = S.Union([
    CompletedNavigateInternal,
    CompletedLoadExternal,
    ClickedLink,
    ChangedUrl,
    SucceededLoadPage,
    FailedLoadPage,
    ChangedSearch,
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
    CompletedSaveTheme,
    ClickedCopyText,
    CompletedCopyText,
    ClickedCopyMarkdown,
    SucceededLoadMarkdown,
    FailedLoadMarkdown,
    CompletedFocusSearch,
    CompletedFocusSidebar,
    CompletedScrollSearchResult,
    PressedGlobalKey,
  ]);
  type Message = typeof Message.Type;

  const NavigateInternal = Command.define(
    "NavigateInternal",
    { url: S.String },
    CompletedNavigateInternal,
  )(({ url }) => pushUrl(url).pipe(Effect.as(CompletedNavigateInternal())));

  const LoadExternal = Command.define(
    "LoadExternal",
    { href: S.String },
    CompletedLoadExternal,
  )(({ href }) => load(href).pipe(Effect.as(CompletedLoadExternal())));

  const LoadPage = Command.define(
    "LoadPage",
    { pathname: S.String },
    LoadPageResult,
  )(({ pathname }) => {
    const entry = findPageByUrl(manifest, pathname);
    if (entry === undefined) {
      return Effect.succeed(
        FailedLoadPage({
          pathname,
          reason: `No document exists at ${pathname}.`,
        }),
      );
    }
    return Effect.tryPromise({
      try: entry.load,
      catch: messageFromError,
    }).pipe(
      Effect.map(({ default: page }) => SucceededLoadPage({ pathname, page })),
      Effect.catch((reason) =>
        Effect.succeed(FailedLoadPage({ pathname, reason })),
      ),
    );
  });

  const Search = Command.define(
    "Search",
    { query: S.String },
    SearchResultMessage,
  )(({ query }) =>
    searchClient.search(query, { limit: 12 }).pipe(
      Effect.map((results) =>
        SucceededSearch({ query, results: [...results] }),
      ),
      Effect.catch((error) =>
        Effect.succeed(
          FailedSearch({ query, reason: messageFromError(error) }),
        ),
      ),
    ),
  );

  const FocusSearch = Command.define(
    "FocusSearch",
    CompletedFocusSearch,
  )(
    Dom.focus("#ed-search-input").pipe(
      Effect.ignore,
      Effect.as(CompletedFocusSearch()),
    ),
  );

  const FocusSidebar = Command.define(
    "FocusSidebar",
    CompletedFocusSidebar,
  )(
    Dom.focus("#ed-sidebar a").pipe(
      Effect.ignore,
      Effect.as(CompletedFocusSidebar()),
    ),
  );

  const ScrollSearchResult = Command.define(
    "ScrollSearchResult",
    { index: S.Number },
    CompletedScrollSearchResult,
  )(({ index }) =>
    Dom.scrollIntoView(`#ed-search-result-${index}`).pipe(
      Effect.ignore,
      Effect.as(CompletedScrollSearchResult()),
    ),
  );

  const applyTheme = (theme: "light" | "dark"): void => {
    const root = globalThis.document?.documentElement;
    root?.classList.toggle("dark", theme === "dark");
    if (root !== undefined) root.style.colorScheme = theme;
  };

  const preferredSystemTheme = (): "light" | "dark" =>
    globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

  const resolveTheme = (
    preference: "light" | "system" | "dark",
    systemTheme: "light" | "dark",
  ): "light" | "dark" => (preference === "system" ? systemTheme : preference);

  const ReadTheme = Command.define(
    "ReadTheme",
    LoadedTheme,
  )(
    Effect.sync(() => {
      let stored: string | null | undefined;
      try {
        stored = globalThis.localStorage?.getItem("effectdocs-theme");
      } catch {
        stored = undefined;
      }
      const preference =
        stored === "light" || stored === "dark" || stored === "system"
          ? stored
          : "system";
      const systemTheme = preferredSystemTheme();
      const theme = resolveTheme(preference, systemTheme);
      applyTheme(theme);
      return LoadedTheme({ preference, systemTheme, theme });
    }),
  );

  const SaveTheme = Command.define(
    "SaveTheme",
    {
      preference: S.Literals(["light", "system", "dark"]),
      theme: S.Literals(["light", "dark"]),
    },
    CompletedSaveTheme,
  )(({ preference, theme }) =>
    Effect.sync(() => {
      applyTheme(theme);
      try {
        globalThis.localStorage?.setItem("effectdocs-theme", preference);
      } catch {
        // Storage can be unavailable in private or embedded browsing contexts.
      }
      return CompletedSaveTheme();
    }),
  );

  const ApplyTheme = Command.define(
    "ApplyTheme",
    { theme: S.Literals(["light", "dark"]) },
    CompletedApplyTheme,
  )(({ theme }) =>
    Effect.sync(() => {
      applyTheme(theme);
      return CompletedApplyTheme();
    }),
  );

  const ReadSidebarGroups = Command.define(
    "ReadSidebarGroups",
    LoadedSidebarGroups,
  )(
    Effect.sync(() => {
      try {
        const value = globalThis.localStorage?.getItem(
          "effectdocs-sidebar-groups",
        );
        const parsed: unknown =
          value === null || value === undefined
            ? defaultCollapsedSidebarGroups
            : JSON.parse(value);
        return LoadedSidebarGroups({
          groups: Array.isArray(parsed)
            ? parsed.filter(
                (entry): entry is string => typeof entry === "string",
              )
            : [],
        });
      } catch {
        return LoadedSidebarGroups({ groups: defaultCollapsedSidebarGroups });
      }
    }),
  );

  const SaveSidebarGroups = Command.define(
    "SaveSidebarGroups",
    { groups: S.Array(S.String) },
    CompletedSaveSidebarGroups,
  )(({ groups }) =>
    Effect.sync(() => {
      try {
        globalThis.localStorage?.setItem(
          "effectdocs-sidebar-groups",
          JSON.stringify(groups),
        );
      } catch {
        // Storage can be unavailable in private or embedded browsing contexts.
      }
      return CompletedSaveSidebarGroups();
    }),
  );

  const CopyText = Command.define(
    "CopyText",
    { value: S.String },
    CompletedCopyText,
  )(({ value }) =>
    Effect.tryPromise({
      try: async () => {
        if (globalThis.navigator?.clipboard?.writeText !== undefined) {
          await globalThis.navigator.clipboard.writeText(value);
          return;
        }
        const textarea = globalThis.document?.createElement("textarea");
        if (textarea === undefined) return;
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        globalThis.document.body.append(textarea);
        textarea.select();
        globalThis.document.execCommand("copy");
        textarea.remove();
      },
      catch: messageFromError,
    }).pipe(
      Effect.ignore,
      Effect.andThen(Effect.sleep("2 seconds")),
      Effect.as(CompletedCopyText({ value })),
    ),
  );

  const LoadMarkdown = Command.define(
    "LoadMarkdown",
    { url: S.String },
    LoadMarkdownResult,
  )(({ url }) =>
    Effect.tryPromise({
      try: async () => {
        const response = await globalThis.fetch(url, {
          headers: { Accept: "text/markdown" },
        });
        if (!response.ok)
          throw new Error(`Markdown request failed with ${response.status}.`);
        return await response.text();
      },
      catch: messageFromError,
    }).pipe(
      Effect.map((markdown) => SucceededLoadMarkdown({ markdown })),
      Effect.catch(() => Effect.succeed(FailedLoadMarkdown())),
    ),
  );

  const pageRequest = (
    pathname: string,
  ): readonly [
    typeof PageState.Type,
    ReadonlyArray<Command.Command<Message>>,
  ] =>
    pathname === "/" && findPageByUrl(manifest, pathname) === undefined
      ? [PageHome(), []]
      : [PageLoading({ pathname }), [LoadPage({ pathname })]];

  const init: Runtime.RoutingApplicationInit<Model, Message> = (url) => {
    const [page, commands] = pageRequest(url.pathname);
    return [
      {
        pathname: url.pathname,
        page,
        sidebarOpen: false,
        searchOpen: false,
        searchQuery: "",
        searchResults: [],
        searchError: "",
        searchLoading: false,
        activeSearchResultIndex: -1,
        activeTocId: "",
        mobileTocOpen: false,
        narrowViewport:
          globalThis.matchMedia?.(narrowViewportQuery).matches ?? false,
        collapsedSidebarGroups: [],
        theme: "light",
        systemTheme: "light",
        themePreference: "system",
        copiedText: "",
        copyMarkdownStatus: "idle",
      },
      [...commands, ReadTheme(), ReadSidebarGroups()],
    ];
  };

  type UpdateReturn = readonly [Model, ReadonlyArray<Command.Command<Message>>];
  const update = (model: Model, message: Message): UpdateReturn => {
    switch (message._tag) {
      case "ClickedLink":
        return message.request._tag === "Internal"
          ? [
              model,
              [NavigateInternal({ url: urlToString(message.request.url) })],
            ]
          : [model, [LoadExternal({ href: message.request.href })]];
      case "ChangedUrl": {
        if (message.url.pathname === model.pathname) return [model, []];
        const [page, commands] = pageRequest(message.url.pathname);
        return [
          {
            ...model,
            pathname: message.url.pathname,
            page,
            sidebarOpen: false,
            searchOpen: false,
            searchQuery: "",
            searchResults: [],
            searchError: "",
            searchLoading: false,
            activeSearchResultIndex: -1,
            activeTocId: "",
            mobileTocOpen: false,
            copiedText: "",
            copyMarkdownStatus: "idle",
          },
          commands,
        ];
      }
      case "SucceededLoadPage":
        return message.pathname !== model.pathname
          ? [model, []]
          : [
              {
                ...model,
                page: PageReady({
                  pathname: message.pathname,
                  page: message.page,
                }),
                activeTocId: message.page.toc[0]?.id ?? "",
                mobileTocOpen: false,
              },
              [],
            ];
      case "FailedLoadPage":
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
            ];
      case "ChangedSearch": {
        const query = message.query;
        return [
          {
            ...model,
            searchQuery: query,
            searchResults: query.trim().length === 0 ? [] : model.searchResults,
            searchError: "",
            searchLoading: query.trim().length > 0,
            activeSearchResultIndex: -1,
          },
          query.trim().length === 0 ? [] : [Search({ query })],
        ];
      }
      case "SucceededSearch":
        return message.query !== model.searchQuery
          ? [model, []]
          : [
              {
                ...model,
                searchResults: message.results,
                searchError: "",
                searchLoading: false,
                activeSearchResultIndex: message.results.length === 0 ? -1 : 0,
              },
              [],
            ];
      case "FailedSearch":
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
            ];
      case "PressedSearchKey": {
        if (message.key === "Escape") {
          return model.searchQuery.length > 0
            ? [
                {
                  ...model,
                  searchQuery: "",
                  searchResults: [],
                  searchError: "",
                  searchLoading: false,
                  activeSearchResultIndex: -1,
                },
                [],
              ]
            : [{ ...model, searchOpen: false }, []];
        }
        if (
          (message.key === "ArrowDown" || message.key === "ArrowUp") &&
          model.searchResults.length > 0
        ) {
          const last = model.searchResults.length - 1;
          const index =
            message.key === "ArrowDown"
              ? model.activeSearchResultIndex >= last
                ? 0
                : model.activeSearchResultIndex + 1
              : model.activeSearchResultIndex <= 0
                ? last
                : model.activeSearchResultIndex - 1;
          return [
            { ...model, activeSearchResultIndex: index },
            [ScrollSearchResult({ index })],
          ];
        }
        if (message.key === "Enter" && model.activeSearchResultIndex >= 0) {
          const result = model.searchResults[model.activeSearchResultIndex];
          if (result !== undefined) {
            return [
              {
                ...model,
                searchOpen: false,
                searchQuery: "",
                searchResults: [],
                searchLoading: false,
                activeSearchResultIndex: -1,
              },
              [NavigateInternal({ url: result.url })],
            ];
          }
        }
        return [model, []];
      }
      case "ChangedActiveSection":
        return [{ ...model, activeTocId: message.sectionId }, []];
      case "SelectedToc":
        return [
          {
            ...model,
            activeTocId: message.sectionId,
            mobileTocOpen: false,
          },
          [],
        ];
      case "ToggledMobileToc":
        return [{ ...model, mobileTocOpen: message.open }, []];
      case "SelectedSearchResult":
        return [
          {
            ...model,
            searchOpen: false,
            searchQuery: "",
            searchResults: [],
            searchError: "",
            searchLoading: false,
            activeSearchResultIndex: -1,
          },
          message.url === model.pathname
            ? []
            : [NavigateInternal({ url: message.url })],
        ];
      case "ChangedNarrowViewport":
        return [
          {
            ...model,
            narrowViewport: message.narrow,
            sidebarOpen: false,
          },
          [],
        ];
      case "ToggledSidebar":
        return model.sidebarOpen
          ? [{ ...model, sidebarOpen: false }, []]
          : [{ ...model, sidebarOpen: true }, [FocusSidebar()]];
      case "ClosedSidebar":
        return [{ ...model, sidebarOpen: false }, []];
      case "ToggledSearch":
        return model.searchOpen
          ? [
              {
                ...model,
                searchOpen: false,
                searchQuery: "",
                searchResults: [],
                searchLoading: false,
                activeSearchResultIndex: -1,
              },
              [],
            ]
          : [
              { ...model, searchOpen: true, sidebarOpen: false },
              [FocusSearch()],
            ];
      case "ClosedSearch":
        return [
          {
            ...model,
            searchOpen: false,
            searchQuery: "",
            searchResults: [],
            searchError: "",
            searchLoading: false,
            activeSearchResultIndex: -1,
          },
          [],
        ];
      case "ToggledSidebarGroup": {
        const collapsedSidebarGroups = model.collapsedSidebarGroups.includes(
          message.key,
        )
          ? model.collapsedSidebarGroups.filter((key) => key !== message.key)
          : [...model.collapsedSidebarGroups, message.key];
        return [
          { ...model, collapsedSidebarGroups },
          [SaveSidebarGroups({ groups: collapsedSidebarGroups })],
        ];
      }
      case "LoadedSidebarGroups":
        return [{ ...model, collapsedSidebarGroups: message.groups }, []];
      case "SelectedTheme": {
        const theme = resolveTheme(message.preference, model.systemTheme);
        return [
          { ...model, themePreference: message.preference, theme },
          [SaveTheme({ preference: message.preference, theme })],
        ];
      }
      case "LoadedTheme":
        return [
          {
            ...model,
            themePreference: message.preference,
            systemTheme: message.systemTheme,
            theme: message.theme,
          },
          [],
        ];
      case "ChangedSystemTheme": {
        const theme = resolveTheme(model.themePreference, message.theme);
        return [
          { ...model, systemTheme: message.theme, theme },
          theme === model.theme ? [] : [ApplyTheme({ theme })],
        ];
      }
      case "ClickedCopyText":
        return [
          { ...model, copiedText: message.value, copyMarkdownStatus: "idle" },
          [CopyText({ value: message.value })],
        ];
      case "CompletedCopyText":
        return model.copiedText === message.value
          ? [{ ...model, copiedText: "", copyMarkdownStatus: "idle" }, []]
          : [model, []];
      case "ClickedCopyMarkdown":
        return [
          { ...model, copyMarkdownStatus: "loading" },
          [LoadMarkdown({ url: message.url })],
        ];
      case "SucceededLoadMarkdown":
        return [
          {
            ...model,
            copiedText: message.markdown,
            copyMarkdownStatus: "copied",
          },
          [CopyText({ value: message.markdown })],
        ];
      case "FailedLoadMarkdown":
        return [{ ...model, copyMarkdownStatus: "error" }, []];
      case "PressedGlobalKey":
        if (
          message.key.toLowerCase() === "k" &&
          (message.metaKey || message.ctrlKey)
        ) {
          return model.searchOpen
            ? [{ ...model, searchOpen: false }, []]
            : [
                { ...model, searchOpen: true, sidebarOpen: false },
                [FocusSearch()],
              ];
        }
        if (message.key === "Escape" && model.searchOpen) {
          return model.searchQuery.length > 0
            ? [
                {
                  ...model,
                  searchQuery: "",
                  searchResults: [],
                  searchError: "",
                  searchLoading: false,
                  activeSearchResultIndex: -1,
                },
                [],
              ]
            : [{ ...model, searchOpen: false }, []];
        }
        if (message.key === "Escape" && model.sidebarOpen) {
          return [{ ...model, sidebarOpen: false }, []];
        }
        return [model, []];
      case "CompletedSaveTheme":
      case "CompletedApplyTheme":
      case "CompletedSaveSidebarGroups":
      case "CompletedFocusSearch":
      case "CompletedFocusSidebar":
      case "CompletedScrollSearchResult":
      case "CompletedNavigateInternal":
      case "CompletedLoadExternal":
        return [model, []];
    }
  };

  const pendingView = (model: Model): Document => {
    const h = html<Message>();
    const failed = model.page._tag === "PageFailed";
    return {
      title: `${failed ? "Not Found" : "Loading"} | ${options.site.title}`,
      body: h.div(
        [h.Class(`ed-root ${model.theme}`)],
        [
          h.main(
            [h.Class("ed-state-page")],
            [
              h.div([h.Class("ed-logo-mark")], ["E"]),
              h.h1(
                [],
                [failed ? "Document not found" : "Loading documentation…"],
              ),
              ...(failed ? [h.p([], [model.page.reason])] : []),
              h.a(
                [h.Href(manifest[0]?.url ?? "/")],
                ["Go to documentation home"],
              ),
            ],
          ),
        ],
      ),
    };
  };

  const commonSearchOptions = (model: Model) => ({
    searchOpen: model.searchOpen,
    searchQuery: model.searchQuery,
    searchResults: model.searchResults,
    searchLoading: model.searchLoading,
    searchError: model.searchError,
    activeSearchResultIndex: model.activeSearchResultIndex,
  });

  const view = (model: Model): Document => {
    if (model.page._tag === "PageHome") {
      const canonical = options.site.baseUrl?.replace(/\/+$/u, "");
      return {
        title: options.site.title,
        ...(canonical === undefined ? {} : { canonical }),
        ...(canonical === undefined ? {} : { ogUrl: canonical }),
        body: landingLayout<Message>({
          site: options.site,
          docsUrl,
          theme: model.theme,
          themePreference: model.themePreference,
          copiedText: model.copiedText,
          ...commonSearchOptions(model),
          actions: {
            toggleSearch: ToggledSearch(),
            closeSearch: ClosedSearch(),
            updateSearch: (query) => ChangedSearch({ query }),
            searchKeyDown: (key) => PressedSearchKey({ key }),
            selectSearchResult: (url) => SelectedSearchResult({ url }),
            selectTheme: (preference) => SelectedTheme({ preference }),
            copyText: (value) => ClickedCopyText({ value }),
          },
        }),
      };
    }
    if (model.page._tag !== "PageReady") return pendingView(model);
    const adjacent = adjacentPages(manifest, model.pathname);
    const markdownUrl =
      model.pathname === "/"
        ? "/index.md"
        : `${model.pathname.replace(/\/+$/u, "")}.md`;
    const title = `${model.page.page.frontmatter.title} | ${options.site.title}`;
    const canonical =
      options.site.baseUrl === undefined
        ? undefined
        : `${options.site.baseUrl.replace(/\/+$/u, "")}${model.pathname}`;
    return {
      title,
      ...(canonical === undefined ? {} : { canonical }),
      ...(canonical === undefined ? {} : { ogUrl: canonical }),
      body: docsLayout<Message>({
        site: options.site,
        navigation,
        currentUrl: model.pathname,
        docsUrl,
        markdownUrl,
        markdownEnabled: options.markdown ?? true,
        copyMarkdownStatus: model.copyMarkdownStatus,
        page: model.page.page,
        ...(adjacent.previous === undefined
          ? {}
          : { previous: adjacent.previous }),
        ...(adjacent.next === undefined ? {} : { next: adjacent.next }),
        sidebarOpen: model.sidebarOpen,
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
          toggleSidebarGroup: (key) => ToggledSidebarGroup({ key }),
          toggleSearch: ToggledSearch(),
          closeSearch: ClosedSearch(),
          updateSearch: (query) => ChangedSearch({ query }),
          searchKeyDown: (key) => PressedSearchKey({ key }),
          selectSearchResult: (url) => SelectedSearchResult({ url }),
          setMobileTocOpen: (open) => ToggledMobileToc({ open }),
          selectToc: (sectionId) => SelectedToc({ sectionId }),
          selectTheme: (preference) => SelectedTheme({ preference }),
          copyMarkdown: ClickedCopyMarkdown({ url: markdownUrl }),
        },
        markdown: {
          copiedCode: model.copiedText,
          copyCode: (value) => ClickedCopyText({ value }),
        },
      }),
    };
  };

  const subscriptions = Subscription.make<Model, Message>()((entry) => ({
    keyboard: Subscription.persistent(
      Stream.callback<typeof PressedGlobalKey.Type>((queue) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const onKeyDown = (event: KeyboardEvent) => {
              if (
                event.key !== "Escape" &&
                !(
                  event.key.toLowerCase() === "k" &&
                  (event.metaKey || event.ctrlKey)
                )
              )
                return;
              event.preventDefault();
              Queue.offerUnsafe(
                queue,
                PressedGlobalKey({
                  key: event.key,
                  ctrlKey: event.ctrlKey,
                  metaKey: event.metaKey,
                }),
              );
            };
            globalThis.document?.addEventListener("keydown", onKeyDown);
            return onKeyDown;
          }),
          (onKeyDown) =>
            Effect.sync(() =>
              globalThis.document?.removeEventListener("keydown", onKeyDown),
            ),
        ).pipe(Effect.flatMap(() => Effect.never)),
      ),
    ),
    viewport: Subscription.persistent(
      Stream.callback<typeof ChangedNarrowViewport.Type>((queue) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const mediaQuery = window.matchMedia(narrowViewportQuery);
            const onChange = (event: MediaQueryListEvent) => {
              Queue.offerUnsafe(
                queue,
                ChangedNarrowViewport({ narrow: event.matches }),
              );
            };
            mediaQuery.addEventListener("change", onChange);
            return { mediaQuery, onChange };
          }),
          ({ mediaQuery, onChange }) =>
            Effect.sync(() =>
              mediaQuery.removeEventListener("change", onChange),
            ),
        ).pipe(Effect.flatMap(() => Effect.never)),
      ),
    ),
    systemTheme: Subscription.persistent(
      Stream.callback<typeof ChangedSystemTheme.Type>((queue) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const mediaQuery = window.matchMedia(
              "(prefers-color-scheme: dark)",
            );
            const onChange = (event: MediaQueryListEvent) => {
              Queue.offerUnsafe(
                queue,
                ChangedSystemTheme({ theme: event.matches ? "dark" : "light" }),
              );
            };
            mediaQuery.addEventListener("change", onChange);
            return { mediaQuery, onChange };
          }),
          ({ mediaQuery, onChange }) =>
            Effect.sync(() =>
              mediaQuery.removeEventListener("change", onChange),
            ),
        ).pipe(Effect.flatMap(() => Effect.never)),
      ),
    ),
    activeSection: entry(
      { pathname: S.String, sections: S.Array(S.String) },
      {
        modelToDependencies: (model) => ({
          pathname: model.pathname,
          sections:
            model.page._tag === "PageReady"
              ? model.page.page.toc.map(({ id }) => id)
              : [],
        }),
        dependenciesToStream: ({ sections }) =>
          Stream.callback<typeof ChangedActiveSection.Type>((queue) =>
            Effect.gen(function* () {
              if (sections.length === 0) return yield* Effect.never;
              yield* Render.afterCommit;
              yield* Effect.acquireRelease(
                Effect.sync(() => {
                  const visible = new Set<string>();
                  const intersectionObserver = new IntersectionObserver(
                    (entries) => {
                      for (const observed of entries) {
                        if (observed.isIntersecting)
                          visible.add(observed.target.id);
                        else visible.delete(observed.target.id);
                      }
                      const sectionId = sections.find((id) => visible.has(id));
                      if (sectionId !== undefined) {
                        Queue.offerUnsafe(
                          queue,
                          ChangedActiveSection({ sectionId }),
                        );
                      }
                    },
                    { rootMargin: "-110px 0px -75% 0px" },
                  );
                  for (const id of sections) {
                    const element = document.getElementById(id);
                    if (element !== null) intersectionObserver.observe(element);
                  }
                  return intersectionObserver;
                }),
                (observer) => Effect.sync(() => observer.disconnect()),
              );
              return yield* Effect.never;
            }),
          ),
      },
    ),
  }));

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
  };
};

export { defineConfig } from "effectdocs-core";
export type {
  EffectdocsConfig,
  PageManifest,
  SiteConfig,
} from "effectdocs-core";
export type { SearchClient, SearchProvider } from "@effectdocs/search";
export type { CompiledPage } from "effectdocs-mdx";
