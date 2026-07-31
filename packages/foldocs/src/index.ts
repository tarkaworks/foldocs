import {
  SearchError,
  SearchDocument,
  SearchResult,
  type SearchClient,
} from "@foldocs/search";
import {
  adjacentPages,
  buildNavigation,
  defaultLandingSections,
  defaultUiTranslations,
  findPageByUrl,
  localeDefinition,
  localeFromPathname,
  localeHomePath,
  localizedPathname,
  navigationForUrl,
  navigationTabsForUrl,
  stripLocalePrefix,
  type NavigationNode,
  type LayoutPreset,
  type PageManifest,
  type ResolvedLandingConfig,
  type ResolvedI18nConfig,
  type SiteConfig,
} from "foldocs-core";
import {
  CompiledPage,
  type CompiledPage as CompiledPageType,
} from "foldocs-mdx/ast";
import {
  docsLayout,
  headerLanguageMenuId,
  initLanguageMenu,
  landingLayout,
  LanguageMenuMessage,
  LanguageMenuModel,
  sidebarLanguageMenuId,
  type MdxComponents,
} from "foldocs-ui";
import { Menu } from "@foldkit/ui";
import { Effect, Option, Queue, Schema as S, Stream } from "effect";
import { Command, Render, Subscription, type Runtime } from "foldkit";
import * as Dom from "foldkit/dom";
import { type Document, html } from "foldkit/html";
import { m } from "foldkit/message";
import { UrlRequest, load, pushUrl } from "foldkit/navigation";
import { Url, toString as urlToString } from "foldkit/url";

const LanguageMenu = Menu.create<string>();

export interface DocsProgramOptions {
  readonly manifest: PageManifest<CompiledPageType>;
  readonly navigation?: ReadonlyArray<NavigationNode>;
  readonly navigations?: Readonly<
    Record<string, ReadonlyArray<NavigationNode>>
  >;
  readonly site: SiteConfig;
  readonly layoutPreset?: LayoutPreset;
  readonly landing?: ResolvedLandingConfig;
  readonly i18n?: ResolvedI18nConfig;
  readonly basePath?: string;
  readonly search?: SearchClient;
  readonly markdown?: boolean;
  /** Presentational Foldkit renderers for deterministic MDX component nodes. */
  readonly components?: MdxComponents;
  /** Per-locale JSON indexes emitted by the Foldocs Vite plugin. */
  readonly searchIndexUrls?: Readonly<Record<string, string>>;
  /**
   * Page module loaded before the Foldkit runtime starts. Production entry
   * points use this to adopt prerendered HTML without briefly rendering the
   * asynchronous loading state first.
   */
  readonly preloadedPage?: PreloadedDocsPage;
}

export interface PreloadedDocsPage {
  readonly pathname: string;
  readonly page: CompiledPageType;
}

const hasLocalePrefix = (i18n: ResolvedI18nConfig, pathname: string): boolean =>
  !i18n.enabled ||
  i18n.locales.some(
    (entry) =>
      pathname === `/${entry.locale}` ||
      pathname.startsWith(`/${entry.locale}/`),
  );

const initialPathname = (i18n: ResolvedI18nConfig, pathname: string): string =>
  hasLocalePrefix(i18n, pathname)
    ? pathname
    : localizedPathname(i18n, i18n.defaultLocale, pathname);

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
  const resolvedPathname = initialPathname(i18n, pathname);
  const entry = findPageByUrl(manifest, resolvedPathname);
  if (entry === undefined) return undefined;
  try {
    const { default: page } = await entry.load();
    return { pathname: resolvedPathname, page };
  } catch {
    // The normal LoadPage command retains the existing error UI and retry path.
    return undefined;
  }
};

const messageFromError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Creates the complete Foldkit program used by generated Foldocs sites.
 * The returned schemas can be passed directly to `Runtime.makeApplication`.
 */
export const createDocsProgram = (options: DocsProgramOptions) => {
  const narrowViewportQuery = "(max-width: 48rem)";
  const manifest = options.manifest;
  const legacyLocale = options.site.locale ?? "en";
  const i18n: ResolvedI18nConfig = options.i18n ?? {
    enabled: false,
    defaultLocale: legacyLocale,
    fallbackLocale: legacyLocale,
    locales: [
      {
        locale: legacyLocale,
        name: legacyLocale,
        dir: "ltr",
        ui: defaultUiTranslations,
      },
    ],
  };
  const basePath = options.basePath ?? "/docs";
  const landing = options.landing ?? {
    sections: defaultLandingSections,
    command: "pnpm create foldocs@latest",
  };
  const fallbackNavigation = options.navigation ?? buildNavigation(manifest);
  const navigations = options.navigations ?? {
    [i18n.defaultLocale]: fallbackNavigation,
  };
  const navigationFor = (locale: string): ReadonlyArray<NavigationNode> =>
    navigations[locale] ??
    navigations[i18n.fallbackLocale] ??
    fallbackNavigation;
  const defaultCollapsedSidebarGroups = (() => {
    const groups: string[] = [];
    const visit = (
      nodes: ReadonlyArray<NavigationNode>,
      parentKey = "",
    ): void => {
      for (const node of nodes) {
        if (node._tag !== "Folder") continue;
        if (node.root) {
          visit(node.children);
          continue;
        }
        const key = `${parentKey}/${node.segment}`;
        if (!node.defaultOpen) groups.push(key);
        visit(node.children, key);
      }
    };
    for (const navigation of Object.values(navigations)) visit(navigation);
    return groups;
  })();
  const docsUrlFor = (locale: string): string =>
    manifest.find(
      (page) =>
        (page.locale ?? i18n.defaultLocale) === locale && page.slug === "",
    )?.url ??
    manifest.find((page) => (page.locale ?? i18n.defaultLocale) === locale)
      ?.url ??
    localizedPathname(i18n, locale, basePath);
  const searchDocuments: ReadonlyArray<SearchDocument> = manifest.map(
    (page) => ({
      id: page.id,
      url: page.url,
      title: page.frontmatter.title,
      ...(page.frontmatter.description === undefined
        ? {}
        : { description: page.frontmatter.description }),
      content: page.plainText,
      locale: page.locale ?? i18n.defaultLocale,
      ...(page.frontmatter.tags === undefined
        ? {}
        : { tags: page.frontmatter.tags }),
    }),
  );
  const localSearch = new Map<string, Promise<SearchClient>>();
  const loadSearchDocuments = async (
    locale: string,
  ): Promise<ReadonlyArray<SearchDocument>> => {
    const indexUrl =
      options.searchIndexUrls?.[locale] ??
      options.searchIndexUrls?.[i18n.defaultLocale];
    if (indexUrl === undefined) return searchDocuments;
    const response = await fetch(indexUrl, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new Error(
        `Unable to load ${indexUrl}: ${String(response.status)} ${response.statusText}`,
      );
    return S.decodeUnknownSync(S.Array(SearchDocument))(await response.json());
  };
  const defaultSearch: SearchClient = {
    provider: "orama",
    search: (query, searchOptions = {}) => {
      if (query.trim().length === 0) return Effect.succeed([]);
      return Effect.tryPromise({
        try: async () => {
          const locale = searchOptions.locale ?? i18n.defaultLocale;
          let client = localSearch.get(locale);
          if (client === undefined) {
            client = Promise.all([
              import("@foldocs/search-orama"),
              loadSearchDocuments(locale),
            ]).then(([{ createOramaSearchClient }, documents]) =>
              createOramaSearchClient(documents),
            );
            localSearch.set(locale, client);
          }
          return Effect.runPromise((await client).search(query, searchOptions));
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
    locale: S.String,
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
    headerLanguageMenu: LanguageMenuModel,
    sidebarLanguageMenu: LanguageMenuModel,
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
  const CompletedApplyLocaleMetadata = m("CompletedApplyLocaleMetadata");
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
  const CompletedRestoreDialogFocus = m("CompletedRestoreDialogFocus");
  const CompletedScrollSearchResult = m("CompletedScrollSearchResult");
  const PressedGlobalKey = m("PressedGlobalKey", {
    key: S.String,
    ctrlKey: S.Boolean,
    metaKey: S.Boolean,
  });
  const GotHeaderLanguageMenuMessage = m("GotHeaderLanguageMenuMessage", {
    message: LanguageMenuMessage,
  });
  const GotSidebarLanguageMenuMessage = m("GotSidebarLanguageMenuMessage", {
    message: LanguageMenuMessage,
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
    CompletedApplyLocaleMetadata,
    CompletedSaveTheme,
    ClickedCopyText,
    CompletedCopyText,
    ClickedCopyMarkdown,
    SucceededLoadMarkdown,
    FailedLoadMarkdown,
    CompletedFocusSearch,
    CompletedFocusSidebar,
    CompletedRestoreDialogFocus,
    CompletedScrollSearchResult,
    PressedGlobalKey,
    GotHeaderLanguageMenuMessage,
    GotSidebarLanguageMenuMessage,
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
    { query: S.String, locale: S.String },
    SearchResultMessage,
  )(({ query, locale }) =>
    searchClient.search(query, { limit: 12, locale }).pipe(
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
    Dom.focus("#fd-search-input").pipe(
      Effect.ignore,
      Effect.as(CompletedFocusSearch()),
    ),
  );

  const FocusSidebar = Command.define(
    "FocusSidebar",
    CompletedFocusSidebar,
  )(
    Dom.focus("#fd-sidebar a").pipe(
      Effect.ignore,
      Effect.as(CompletedFocusSidebar()),
    ),
  );

  const RestoreDialogFocus = Command.define(
    "RestoreDialogFocus",
    { selector: S.String },
    CompletedRestoreDialogFocus,
  )(({ selector }) =>
    Dom.focus(selector).pipe(
      Effect.ignore,
      Effect.as(CompletedRestoreDialogFocus()),
    ),
  );

  const ScrollSearchResult = Command.define(
    "ScrollSearchResult",
    { index: S.Number },
    CompletedScrollSearchResult,
  )(({ index }) =>
    Dom.scrollIntoView(`#fd-search-result-${index}`).pipe(
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

  const readThemePreference = (): "light" | "system" | "dark" => {
    let stored: string | null | undefined;
    try {
      stored = globalThis.localStorage?.getItem("foldocs-theme");
    } catch {
      stored = undefined;
    }
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : "system";
  };

  const ReadTheme = Command.define(
    "ReadTheme",
    LoadedTheme,
  )(
    Effect.sync(() => {
      const preference = readThemePreference();
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
        globalThis.localStorage?.setItem("foldocs-theme", preference);
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

  const alternatePathnames = (
    pathname: string,
  ): ReadonlyArray<{ readonly locale: string; readonly pathname: string }> => {
    const current = findPageByUrl(manifest, pathname);
    if (current === undefined) {
      return i18n.locales.map(({ locale }) => ({
        locale,
        pathname: localeHomePath(i18n, locale),
      }));
    }
    const translationKey = current.translationKey ?? current.slug;
    return i18n.locales.map(({ locale }) => ({
      locale,
      pathname:
        manifest.find(
          (page) =>
            page.locale === locale &&
            (page.translationKey ?? page.slug) === translationKey,
        )?.url ?? localizedPathname(i18n, locale, pathname),
    }));
  };

  const ApplyLocaleMetadata = Command.define(
    "ApplyLocaleMetadata",
    { locale: S.String, pathname: S.String },
    CompletedApplyLocaleMetadata,
  )(({ locale, pathname }) =>
    Effect.sync(() => {
      const document = globalThis.document;
      if (document === undefined) return CompletedApplyLocaleMetadata();
      const definition = localeDefinition(i18n, locale);
      document.documentElement.lang = definition.locale;
      document.documentElement.dir = definition.dir;
      const currentPage = findPageByUrl(manifest, pathname);
      const pageTitle =
        currentPage === undefined
          ? options.site.title
          : `${currentPage.frontmatter.title} | ${options.site.title}`;
      const description =
        currentPage?.frontmatter.description ?? options.site.description;
      const keywords =
        currentPage?.frontmatter.keywords ?? options.site.keywords;
      const configuredImage =
        currentPage?.frontmatter.socialImage ?? options.site.socialImage;
      const socialImage =
        configuredImage === undefined || options.site.baseUrl === undefined
          ? configuredImage
          : new URL(
              configuredImage.replace(/^\//u, ""),
              `${options.site.baseUrl.replace(/\/+$/u, "")}/`,
            ).toString();
      const syncMeta = (
        selector: string,
        attribute: "name" | "property",
        key: string,
        content: string | undefined,
      ): void => {
        const existing = document.head.querySelector<HTMLMetaElement>(selector);
        if (content === undefined) {
          existing?.remove();
          return;
        }
        const meta = existing ?? document.createElement("meta");
        meta.setAttribute(attribute, key);
        meta.content = content;
        meta.dataset.foldocsRoute = "true";
        if (existing === null) document.head.append(meta);
      };
      document.title = pageTitle;
      syncMeta('meta[name="description"]', "name", "description", description);
      syncMeta(
        'meta[property="og:description"]',
        "property",
        "og:description",
        description,
      );
      syncMeta(
        'meta[name="twitter:description"]',
        "name",
        "twitter:description",
        description,
      );
      syncMeta(
        'meta[name="keywords"]',
        "name",
        "keywords",
        keywords?.join(", "),
      );
      syncMeta('meta[property="og:title"]', "property", "og:title", pageTitle);
      syncMeta(
        'meta[property="og:type"]',
        "property",
        "og:type",
        currentPage === undefined ? "website" : "article",
      );
      syncMeta(
        'meta[name="twitter:title"]',
        "name",
        "twitter:title",
        pageTitle,
      );
      syncMeta(
        'meta[name="twitter:card"]',
        "name",
        "twitter:card",
        socialImage === undefined ? "summary" : "summary_large_image",
      );
      syncMeta(
        'meta[property="og:image"]',
        "property",
        "og:image",
        socialImage,
      );
      syncMeta(
        'meta[name="twitter:image"]',
        "name",
        "twitter:image",
        socialImage,
      );
      for (const selector of document.querySelectorAll(
        "details.fd-language-selector[open]",
      ))
        selector.removeAttribute("open");
      for (const element of document.head.querySelectorAll(
        "link[data-foldocs-i18n]",
      ))
        element.remove();
      if (i18n.enabled && options.site.baseUrl !== undefined) {
        const absolute = (value: string): string =>
          new URL(
            value.replace(/^\//u, ""),
            `${options.site.baseUrl!.replace(/\/+$/u, "")}/`,
          ).toString();
        for (const alternate of alternatePathnames(pathname)) {
          const link = document.createElement("link");
          link.rel = "alternate";
          link.hreflang = alternate.locale;
          link.href = absolute(alternate.pathname);
          link.dataset.foldocsI18n = "true";
          document.head.append(link);
        }
        const defaultAlternate = alternatePathnames(pathname).find(
          (alternate) => alternate.locale === i18n.defaultLocale,
        );
        if (defaultAlternate !== undefined) {
          const link = document.createElement("link");
          link.rel = "alternate";
          link.hreflang = "x-default";
          link.href = absolute(defaultAlternate.pathname);
          link.dataset.foldocsI18n = "true";
          document.head.append(link);
        }
      }
      return CompletedApplyLocaleMetadata();
    }),
  );

  const ReadSidebarGroups = Command.define(
    "ReadSidebarGroups",
    LoadedSidebarGroups,
  )(
    Effect.sync(() => {
      try {
        const value = globalThis.localStorage?.getItem(
          "foldocs-sidebar-groups",
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
          "foldocs-sidebar-groups",
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

  const preloadedPageFor = (
    pathname: string,
  ): typeof PageReady.Type | undefined => {
    if (options.preloadedPage === undefined) return undefined;
    const requestedEntry = findPageByUrl(manifest, pathname);
    const preloadedEntry = findPageByUrl(
      manifest,
      options.preloadedPage.pathname,
    );
    if (
      requestedEntry === undefined ||
      preloadedEntry?.url !== requestedEntry.url
    )
      return undefined;
    return PageReady({ pathname, page: options.preloadedPage.page });
  };

  const pageRequest = (
    pathname: string,
  ): readonly [
    typeof PageState.Type,
    ReadonlyArray<Command.Command<Message>>,
    string,
    string,
  ] => {
    const locale = localeFromPathname(i18n, pathname);
    if (!hasLocalePrefix(i18n, pathname)) {
      const target = initialPathname(i18n, pathname);
      const preloaded = preloadedPageFor(target);
      const home =
        stripLocalePrefix(i18n, target) === "/" &&
        findPageByUrl(manifest, target) === undefined;
      return [
        preloaded ?? (home ? PageHome() : PageLoading({ pathname: target })),
        [
          NavigateInternal({
            url: target,
          }),
        ],
        i18n.defaultLocale,
        target,
      ];
    }
    const home =
      stripLocalePrefix(i18n, pathname) === "/" &&
      findPageByUrl(manifest, pathname) === undefined;
    const preloaded = preloadedPageFor(pathname);
    return home
      ? [PageHome(), [], locale, pathname]
      : preloaded === undefined
        ? [
            PageLoading({ pathname }),
            [LoadPage({ pathname })],
            locale,
            pathname,
          ]
        : [preloaded, [], locale, pathname];
  };

  const init: Runtime.RoutingApplicationInit<Model, Message> = (url) => {
    const [page, commands, locale, pathname] = pageRequest(url.pathname);
    const systemTheme = preferredSystemTheme();
    const themePreference = readThemePreference();
    const theme = resolveTheme(themePreference, systemTheme);
    return [
      {
        pathname,
        locale,
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
        theme,
        systemTheme,
        themePreference,
        copiedText: "",
        copyMarkdownStatus: "idle",
        headerLanguageMenu: initLanguageMenu(headerLanguageMenuId),
        sidebarLanguageMenu: initLanguageMenu(sidebarLanguageMenuId),
      },
      [
        ...commands,
        ReadTheme(),
        ReadSidebarGroups(),
        ApplyLocaleMetadata({ locale, pathname }),
      ],
    ];
  };

  type UpdateReturn = readonly [Model, ReadonlyArray<Command.Command<Message>>];
  const update = (model: Model, message: Message): UpdateReturn => {
    switch (message._tag) {
      case "GotHeaderLanguageMenuMessage": {
        const [headerLanguageMenu, commands, maybeOutMessage] =
          LanguageMenu.update(model.headerLanguageMenu, message.message);
        const nextModel = { ...model, headerLanguageMenu };
        const mappedCommands = Command.mapMessages(commands, (childMessage) =>
          GotHeaderLanguageMenuMessage({ message: childMessage }),
        );
        return Option.match(maybeOutMessage, {
          onNone: (): UpdateReturn => [nextModel, mappedCommands],
          onSome: ({ value }): UpdateReturn => [
            nextModel,
            value === model.pathname
              ? mappedCommands
              : [...mappedCommands, NavigateInternal({ url: value })],
          ],
        });
      }
      case "GotSidebarLanguageMenuMessage": {
        const [sidebarLanguageMenu, commands, maybeOutMessage] =
          LanguageMenu.update(model.sidebarLanguageMenu, message.message);
        const nextModel = { ...model, sidebarLanguageMenu };
        const mappedCommands = Command.mapMessages(commands, (childMessage) =>
          GotSidebarLanguageMenuMessage({ message: childMessage }),
        );
        return Option.match(maybeOutMessage, {
          onNone: (): UpdateReturn => [nextModel, mappedCommands],
          onSome: ({ value }): UpdateReturn => [
            nextModel,
            value === model.pathname
              ? mappedCommands
              : [...mappedCommands, NavigateInternal({ url: value })],
          ],
        });
      }
      case "ClickedLink":
        return message.request._tag === "Internal"
          ? [
              model,
              [NavigateInternal({ url: urlToString(message.request.url) })],
            ]
          : [model, [LoadExternal({ href: message.request.href })]];
      case "ChangedUrl": {
        if (message.url.pathname === model.pathname) return [model, []];
        const [page, commands, locale, pathname] = pageRequest(
          message.url.pathname,
        );
        const transitionPage =
          model.page._tag === "PageReady" && page._tag === "PageLoading"
            ? model.page
            : page;
        return [
          {
            ...model,
            pathname,
            locale,
            page: transitionPage,
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
          [
            ...commands,
            ApplyLocaleMetadata({
              locale,
              pathname,
            }),
          ],
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
          query.trim().length === 0
            ? []
            : [Search({ query, locale: model.locale })],
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
          ? [
              { ...model, sidebarOpen: false },
              [RestoreDialogFocus({ selector: "#fd-menu-trigger" })],
            ]
          : [{ ...model, sidebarOpen: true }, [FocusSidebar()]];
      case "ClosedSidebar":
        return [
          { ...model, sidebarOpen: false },
          model.narrowViewport && model.sidebarOpen
            ? [RestoreDialogFocus({ selector: "#fd-menu-trigger" })]
            : [],
        ];
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
              [
                RestoreDialogFocus({
                  selector: model.narrowViewport
                    ? "#fd-search-trigger-mobile"
                    : "#fd-search-trigger",
                }),
              ],
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
          model.searchOpen
            ? [
                RestoreDialogFocus({
                  selector: model.narrowViewport
                    ? "#fd-search-trigger-mobile"
                    : "#fd-search-trigger",
                }),
              ]
            : [],
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
            ? [
                { ...model, searchOpen: false },
                [
                  RestoreDialogFocus({
                    selector: model.narrowViewport
                      ? "#fd-search-trigger-mobile"
                      : "#fd-search-trigger",
                  }),
                ],
              ]
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
            : [
                { ...model, searchOpen: false },
                [
                  RestoreDialogFocus({
                    selector: model.narrowViewport
                      ? "#fd-search-trigger-mobile"
                      : "#fd-search-trigger",
                  }),
                ],
              ];
        }
        if (message.key === "Escape" && model.sidebarOpen) {
          return [
            { ...model, sidebarOpen: false },
            [RestoreDialogFocus({ selector: "#fd-menu-trigger" })],
          ];
        }
        return [model, []];
      case "CompletedSaveTheme":
      case "CompletedApplyTheme":
      case "CompletedApplyLocaleMetadata":
      case "CompletedSaveSidebarGroups":
      case "CompletedFocusSearch":
      case "CompletedFocusSidebar":
      case "CompletedRestoreDialogFocus":
      case "CompletedScrollSearchResult":
      case "CompletedNavigateInternal":
      case "CompletedLoadExternal":
        return [model, []];
    }
  };

  const pendingView = (model: Model): Document => {
    const h = html<Message>();
    const failed = model.page._tag === "PageFailed";
    const translations = localeDefinition(i18n, model.locale).ui;
    return {
      title: `${failed ? translations.documentNotFound : translations.loading} | ${options.site.title}`,
      body: h.div(
        [h.Class("fd-root")],
        [
          h.main(
            [h.Class("fd-state-page")],
            [
              h.div([h.Class("fd-logo-mark")], ["F"]),
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
    };
  };

  const commonSearchOptions = (model: Model) => ({
    searchOpen: model.searchOpen,
    searchQuery: model.searchQuery,
    searchResults: model.searchResults,
    searchLoading: model.searchLoading,
    searchError: model.searchError,
    activeSearchResultIndex: model.activeSearchResultIndex,
    translations: localeDefinition(i18n, model.locale).ui,
  });

  const localeLinks = (model: Model) =>
    alternatePathnames(model.pathname).map((alternate) => {
      const definition = localeDefinition(i18n, alternate.locale);
      return {
        locale: alternate.locale,
        name: definition.name,
        dir: definition.dir,
        href: alternate.pathname,
        current: alternate.locale === model.locale,
      } as const;
    });

  const view = (model: Model): Document => {
    if (model.page._tag === "PageHome") {
      const homeUrl = localeHomePath(i18n, model.locale);
      const canonical =
        options.site.baseUrl === undefined
          ? undefined
          : `${options.site.baseUrl.replace(/\/+$/u, "")}${homeUrl === "/" ? "" : homeUrl}`;
      return {
        title: options.site.title,
        ...(canonical === undefined ? {} : { canonical }),
        ...(canonical === undefined ? {} : { ogUrl: canonical }),
        body: landingLayout<Message>({
          site: options.site,
          landing,
          docsUrl: docsUrlFor(model.locale),
          homeUrl,
          locales: localeLinks(model),
          currentLocale: model.locale,
          headerLanguageMenu: model.headerLanguageMenu,
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
            gotHeaderLanguageMenuMessage: (message) =>
              GotHeaderLanguageMenuMessage({ message }),
          },
        }),
      };
    }
    if (model.page._tag !== "PageReady") return pendingView(model);
    const completeNavigation = navigationFor(model.locale);
    const navigation = navigationForUrl(completeNavigation, model.pathname);
    const adjacent = adjacentPages(manifest, model.pathname, navigation);
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
        preset: options.layoutPreset ?? "docs",
        navigation,
        tabs: navigationTabsForUrl(completeNavigation, model.pathname),
        currentUrl: model.pathname,
        docsUrl: docsUrlFor(model.locale),
        homeUrl: localeHomePath(i18n, model.locale),
        locales: localeLinks(model),
        currentLocale: model.locale,
        headerLanguageMenu: model.headerLanguageMenu,
        sidebarLanguageMenu: model.sidebarLanguageMenu,
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
          gotHeaderLanguageMenuMessage: (message) =>
            GotHeaderLanguageMenuMessage({ message }),
          gotSidebarLanguageMenuMessage: (message) =>
            GotSidebarLanguageMenuMessage({ message }),
        },
        markdown: {
          ...(options.components === undefined
            ? {}
            : { components: options.components }),
          copiedCode: model.copiedText,
          copyCode: (value) => ClickedCopyText({ value }),
          copyLabel: localeDefinition(i18n, model.locale).ui.copy,
          copiedLabel: localeDefinition(i18n, model.locale).ui.copied,
          copyAriaLabel: localeDefinition(i18n, model.locale).ui.copyCode,
          copiedAriaLabel: localeDefinition(i18n, model.locale).ui.codeCopied,
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
              if (event.key === "Tab") {
                const dialog = globalThis.document?.querySelector<HTMLElement>(
                  '[role="dialog"][aria-modal="true"]',
                );
                if (dialog === null || dialog === undefined) return;
                const focusable = [
                  ...dialog.querySelectorAll<HTMLElement>(
                    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
                  ),
                ].filter(
                  (element) =>
                    element.getAttribute("aria-hidden") !== "true" &&
                    element.getClientRects().length > 0,
                );
                const first = focusable[0];
                const last = focusable.at(-1);
                if (first === undefined || last === undefined) {
                  event.preventDefault();
                  dialog.focus();
                  return;
                }
                const active = globalThis.document?.activeElement;
                if (
                  event.shiftKey &&
                  (active === first || !dialog.contains(active))
                ) {
                  event.preventDefault();
                  last.focus();
                } else if (
                  !event.shiftKey &&
                  (active === last || !dialog.contains(active))
                ) {
                  event.preventDefault();
                  first.focus();
                }
                return;
              }
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

export { defineConfig } from "foldocs-core";
export { defineContentAdapter } from "@foldocs/content";
export type { ContentAdapter, ContentFile } from "@foldocs/content";
export type {
  FoldocsConfig,
  I18nConfig,
  LocaleConfig,
  PageManifest,
  ResolvedI18nConfig,
  SiteConfig,
  UiTranslations,
} from "foldocs-core";
export type { SearchClient, SearchProvider } from "@foldocs/search";
export type { CompiledPage } from "foldocs-mdx/ast";
export type {
  BlockComponentView,
  InlineComponentView,
  MdxComponents,
} from "foldocs-ui";
