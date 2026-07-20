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
  type PageManifest,
  type SiteConfig,
} from "effectdocs-core";
import {
  CompiledPage,
  type CompiledPage as CompiledPageType,
} from "effectdocs-mdx";
import { docsLayout } from "effectdocs-ui";
import { Effect, Option, Schema as S, Stream } from "effect";
import { Command, Subscription, type Runtime } from "foldkit";
import { type Document, html } from "foldkit/html";
import { m } from "foldkit/message";
import { UrlRequest, load, pushUrl } from "foldkit/navigation";
import { Url, toString as urlToString } from "foldkit/url";

export interface DocsProgramOptions {
  readonly manifest: PageManifest<CompiledPageType>;
  readonly site: SiteConfig;
  readonly search?: SearchClient;
}

const messageFromError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Creates the complete Foldkit program used by generated Effectdocs sites.
 * The returned schemas can be passed directly to `Runtime.makeApplication`.
 */
export const createDocsProgram = (options: DocsProgramOptions) => {
  const manifest = options.manifest;
  const navigation = buildNavigation(manifest);
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
  const PageReady = m("PageReady", { pathname: S.String, page: CompiledPage });
  const PageFailed = m("PageFailed", { pathname: S.String, reason: S.String });
  const PageState = S.Union([PageLoading, PageReady, PageFailed]);

  const Model = S.Struct({
    pathname: S.String,
    page: PageState,
    sidebarOpen: S.Boolean,
    searchOpen: S.Boolean,
    searchQuery: S.String,
    searchResults: S.Array(SearchResult),
    searchError: S.String,
    theme: S.Literals(["light", "dark"]),
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
  const ToggledSidebar = m("ToggledSidebar");
  const ClosedSidebar = m("ClosedSidebar");
  const ToggledSearch = m("ToggledSearch");
  const ClosedSearch = m("ClosedSearch");
  const ToggledTheme = m("ToggledTheme");
  const LoadedTheme = m("LoadedTheme", {
    theme: S.Literals(["light", "dark"]),
  });
  const CompletedSaveTheme = m("CompletedSaveTheme");
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
    ToggledSidebar,
    ClosedSidebar,
    ToggledSearch,
    ClosedSearch,
    ToggledTheme,
    LoadedTheme,
    CompletedSaveTheme,
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

  const ReadTheme = Command.define(
    "ReadTheme",
    LoadedTheme,
  )(
    Effect.sync(() => {
      const stored = globalThis.localStorage?.getItem("effectdocs-theme");
      const theme =
        stored === "light" || stored === "dark"
          ? stored
          : globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
      return LoadedTheme({ theme });
    }),
  );

  const SaveTheme = Command.define(
    "SaveTheme",
    { theme: S.Literals(["light", "dark"]) },
    CompletedSaveTheme,
  )(({ theme }) =>
    Effect.sync(() => {
      globalThis.localStorage?.setItem("effectdocs-theme", theme);
      return CompletedSaveTheme();
    }),
  );

  const pageRequest = (
    pathname: string,
  ): readonly [
    typeof PageLoading.Type,
    ReadonlyArray<Command.Command<Message>>,
  ] => [PageLoading({ pathname }), [LoadPage({ pathname })]];

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
        theme: "light",
      },
      [...commands, ReadTheme()],
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
          { ...model, searchQuery: query, searchError: "" },
          query.trim().length === 0 ? [] : [Search({ query })],
        ];
      }
      case "SucceededSearch":
        return message.query !== model.searchQuery
          ? [model, []]
          : [{ ...model, searchResults: message.results, searchError: "" }, []];
      case "FailedSearch":
        return message.query !== model.searchQuery
          ? [model, []]
          : [{ ...model, searchResults: [], searchError: message.reason }, []];
      case "ToggledSidebar":
        return [{ ...model, sidebarOpen: !model.sidebarOpen }, []];
      case "ClosedSidebar":
        return [{ ...model, sidebarOpen: false }, []];
      case "ToggledSearch":
        return [{ ...model, searchOpen: !model.searchOpen }, []];
      case "ClosedSearch":
        return [{ ...model, searchOpen: false }, []];
      case "ToggledTheme": {
        const theme = model.theme === "light" ? "dark" : "light";
        return [{ ...model, theme }, [SaveTheme({ theme })]];
      }
      case "LoadedTheme":
        return [{ ...model, theme: message.theme }, []];
      case "PressedGlobalKey":
        if (
          message.key.toLowerCase() === "k" &&
          (message.metaKey || message.ctrlKey)
        ) {
          return [{ ...model, searchOpen: !model.searchOpen }, []];
        }
        if (message.key === "Escape" && model.searchOpen) {
          return [{ ...model, searchOpen: false }, []];
        }
        if (message.key === "Escape" && model.sidebarOpen) {
          return [{ ...model, sidebarOpen: false }, []];
        }
        return [model, []];
      case "CompletedSaveTheme":
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

  const view = (model: Model): Document => {
    if (model.page._tag !== "PageReady") return pendingView(model);
    const adjacent = adjacentPages(manifest, model.pathname);
    const title = `${model.page.page.frontmatter.title} | ${options.site.title}`;
    const canonical =
      options.site.baseUrl === undefined
        ? undefined
        : `${options.site.baseUrl.replace(/\/+$/u, "")}${model.pathname}`;
    return {
      title,
      ...(canonical === undefined ? {} : { canonical }),
      body: docsLayout<Message>({
        site: options.site,
        navigation,
        currentUrl: model.pathname,
        page: model.page.page,
        ...(adjacent.previous === undefined
          ? {}
          : { previous: adjacent.previous }),
        ...(adjacent.next === undefined ? {} : { next: adjacent.next }),
        sidebarOpen: model.sidebarOpen,
        searchOpen: model.searchOpen,
        searchQuery: model.searchQuery,
        searchResults: model.searchResults,
        theme: model.theme,
        actions: {
          toggleSidebar: ToggledSidebar(),
          closeSidebar: ClosedSidebar(),
          toggleSearch: ToggledSearch(),
          closeSearch: ClosedSearch(),
          updateSearch: (query) => ChangedSearch({ query }),
          toggleTheme: ToggledTheme(),
        },
      }),
    };
  };

  const subscriptions = Subscription.make<Model, Message>()(() => ({
    keyboard: Subscription.persistent(
      Stream.fromEventListener<KeyboardEvent>(document, "keydown").pipe(
        Stream.map((event) =>
          event.key === "Escape" ||
          (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey))
            ? Option.some(event)
            : Option.none(),
        ),
        Stream.filter(Option.isSome),
        Stream.mapEffect(({ value: event }) =>
          Effect.sync(() => event.preventDefault()).pipe(
            Effect.as(
              PressedGlobalKey({
                key: event.key,
                ctrlKey: event.ctrlKey,
                metaKey: event.metaKey,
              }),
            ),
          ),
        ),
      ),
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
