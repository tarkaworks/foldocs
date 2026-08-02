import { Scene } from "foldkit/test";
import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import { describe, expect, it } from "vitest";

import {
  defaultUiTranslations,
  type NavigationNode,
  type PageManifestEntry,
} from "foldocs-core";
import type { CompiledPage } from "foldocs-mdx";

import {
  docsLayout,
  initLanguageMenu,
  initSearchDialog,
  initSidebarDialog,
  landingLayout,
} from "../src/layout.js";

const renderLayout = <Message>(
  toView: (h: HtmlBuilder<Message>) => Html,
): Html => {
  let rendered: Html = null;
  Scene.scene(
    {
      update: (model: null, _message: Message) => [model, []] as const,
      view: (_model: null, h: HtmlBuilder<Message>) => toView(h),
    },
    Scene.given(null),
    Scene.tap((simulation) => {
      rendered = simulation.html;
    }),
  );
  return rendered;
};

describe("landing layout", () => {
  it("uses custom hero copy and selected sections", () => {
    const rendered = renderLayout<string>((h) =>
      landingLayout<string>(
        {
          site: {
            title: "Example",
            githubUrl: "https://github.com/example/docs",
          },
          landing: {
            sections: ["hero", "cta"],
            headline: "Own your docs.",
            description: "A small and deliberate landing page.",
            command: "pnpm create foldocs@latest example",
            footer: {
              author: "Aniket",
              copyright: "Copyright 2026 Tarka Works",
              twitterUrl: "https://x.com/tarkaworks",
            },
          },
          docsUrl: "/docs",
          homeUrl: "/",
          locales: [
            {
              locale: "en",
              name: "English",
              dir: "ltr",
              href: "/",
              current: true,
            },
          ],
          currentLocale: "en",
          headerLanguageMenu: initLanguageMenu("test-landing-language"),
          theme: "light",
          themePreference: "system",
          headerVisible: false,
          copiedText: "",
          searchOpen: false,
          searchDialog: initSearchDialog(),
          searchQuery: "",
          searchResults: [],
          searchLoading: false,
          searchError: "",
          activeSearchResultIndex: -1,
          translations: defaultUiTranslations,
          actions: {
            toggleSearch: "toggle-search",
            closeSearch: "close-search",
            updateSearch: () => "update-search",
            searchKeyDown: () => "search-key",
            selectSearchResult: () => "select-result",
            gotSearchDialogMessage: () => "search-dialog",
            selectTheme: () => "select-theme",
            copyText: () => "copy-text",
            openExternal: () => "open-external",
            gotHeaderLanguageMenuMessage: () => "language-menu",
          },
        },
        h,
      ),
    );
    if (rendered === null) throw new Error("Landing layout was not rendered.");
    const text = Scene.textContent(rendered);
    expect(text).toContain("Own your docs.");
    expect(text).toContain("pnpm create foldocs@latest example");
    expect(text).toContain("Start writing.");
    expect(text).toContain("Built by Aniket.");
    expect(text).toContain("The source code is available on GitHub.");
    expect(text).toContain("Copyright 2026 Tarka Works");
    expect(text).not.toContain("Batteries included.");
  });
});

describe("documentation layout", () => {
  it("distinguishes section headings, folder dropdowns, and page context", () => {
    const page: CompiledPage = {
      frontmatter: {
        title: "Install with pnpm",
        description: "Install the package.",
      },
      document: {
        blocks: [
          {
            _tag: "Paragraph",
            content: [{ _tag: "Text", value: "Page content." }],
          },
        ],
      },
      toc: [],
      source: "# Install with pnpm",
      plainText: "Install with pnpm Page content.",
    };
    const metadata = {
      id: "manual-installation/pnpm.mdx",
      slug: "manual-installation/pnpm",
      url: "/docs/manual-installation/pnpm",
      file: "content/docs/manual-installation/pnpm.mdx",
      navigationPath: "manual-installation/pnpm.mdx",
      frontmatter: page.frontmatter,
      toc: page.toc,
      plainText: page.plainText,
    };
    const navigation: ReadonlyArray<NavigationNode> = [
      { _tag: "Separator", label: "Introduction" },
      {
        _tag: "Folder",
        label: "Manual installation",
        icon: "package",
        segment: "manual-installation",
        defaultOpen: true,
        root: false,
        index: {
          _tag: "Page",
          label: "Manual installation",
          url: "/docs/manual-installation",
          page: {
            ...metadata,
            id: "manual-installation/index.md",
            slug: "manual-installation",
            url: "/docs/manual-installation",
            navigationPath: "manual-installation/index.md",
            frontmatter: { title: "Manual installation", index: true },
          },
        },
        children: [
          {
            _tag: "Page",
            label: "Install with pnpm",
            url: metadata.url,
            page: metadata,
          },
        ],
      },
    ];
    const adjacent = (title: string, url: string) =>
      ({
        ...metadata,
        id: title,
        slug: title.toLowerCase(),
        url,
        frontmatter: { title },
        load: async () => ({ default: page }),
      }) satisfies PageManifestEntry<CompiledPage>;
    const rendered = renderLayout<string>((h) =>
      docsLayout<string>(
        {
          site: {
            title: "Example",
            baseUrl: "https://example.com",
            githubUrl: "https://github.com/example/docs",
            icons: {
              package:
                '<svg viewBox="0 0 24 24" data-custom-icon="true"></svg>',
            },
          },
          navigation,
          tabs: [],
          currentUrl: metadata.url,
          page,
          previous: adjacent("Overview", "/docs"),
          next: adjacent("Install with npm", "/docs/manual-installation/npm"),
          sidebarOpen: false,
          sidebarDialog: initSidebarDialog(),
          collapsedSidebarGroups: [],
          activeTocId: "",
          mobileTocOpen: false,
          narrowViewport: false,
          theme: "light",
          themePreference: "system",
          docsUrl: "/docs",
          homeUrl: "/",
          locales: [
            {
              locale: "en",
              name: "English",
              dir: "ltr",
              href: "/",
              current: true,
            },
          ],
          currentLocale: "en",
          headerLanguageMenu: initLanguageMenu("test-header-language"),
          sidebarLanguageMenu: initLanguageMenu("test-sidebar-language"),
          markdownUrl: "/docs/manual-installation/pnpm.md",
          markdownEnabled: true,
          footer: {
            author: "Aniket",
            copyright: "Copyright 2026 Tarka Works",
            twitterUrl: "https://x.com/tarkaworks",
          },
          copyMarkdownStatus: "idle",
          searchOpen: false,
          searchDialog: initSearchDialog(),
          searchQuery: "",
          searchResults: [],
          searchLoading: false,
          searchError: "",
          activeSearchResultIndex: -1,
          translations: defaultUiTranslations,
          actions: {
            toggleSidebar: "toggle-sidebar",
            closeSidebar: "close-sidebar",
            toggleSidebarGroup: () => "toggle-group",
            setMobileTocOpen: () => "toggle-toc",
            selectToc: () => "select-toc",
            selectTheme: () => "select-theme",
            copyMarkdown: "copy-markdown",
            toggleSearch: "toggle-search",
            closeSearch: "close-search",
            updateSearch: () => "update-search",
            searchKeyDown: () => "search-key",
            selectSearchResult: () => "select-result",
            gotSearchDialogMessage: () => "search-dialog",
            gotSidebarDialogMessage: () => "sidebar-dialog",
            gotHeaderLanguageMenuMessage: () => "header-language-menu",
            gotSidebarLanguageMenuMessage: () => "sidebar-language-menu",
          },
        },
        h,
      ),
    );
    if (rendered === null)
      throw new Error("Documentation layout was not rendered.");
    const text = Scene.textContent(rendered);
    const article = Option.getOrThrow(Scene.find(rendered, ".fd-article"));

    expect(text).toContain("Introduction");
    expect(text).toContain("Manual installation");
    expect(text).toContain("Copy Markdown");
    expect(text).toContain("Open");
    expect(text).toContain("Previous");
    expect(text).toContain("Next");
    expect(Option.isSome(Scene.find(rendered, ".fd-sidebar-section"))).toBe(
      true,
    );
    expect(Option.isSome(Scene.find(rendered, ".fd-sidebar-folder"))).toBe(
      true,
    );
    expect(
      Option.isSome(Scene.find(rendered, ".fd-sidebar-folder-index")),
    ).toBe(true);
    expect(
      Option.isSome(Scene.find(rendered, ".fd-sidebar-folder-toggle")),
    ).toBe(true);
    expect(Option.isSome(Scene.find(rendered, ".fd-navigation-icon"))).toBe(
      true,
    );
    expect(Scene.textContent(article)).toContain("Manual installation");
    expect(Scene.textContent(article)).not.toContain("Introduction");
    expect(Scene.textContent(article)).not.toContain("Built by Aniket");
    expect(text).toContain("Built by Aniket.");
    expect(text).toContain("The source code is available on GitHub.");
    expect(text).toContain("Copyright 2026 Tarka Works");
  });
});
