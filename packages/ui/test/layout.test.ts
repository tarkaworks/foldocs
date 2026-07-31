import { Scene } from "foldkit/test";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

import {
  defaultUiTranslations,
  type NavigationNode,
  type PageManifestEntry,
} from "foldocs-core";
import type { CompiledPage } from "foldocs-mdx";

import { docsLayout, initLanguageMenu, landingLayout } from "../src/layout.js";

describe("landing layout", () => {
  it("uses custom hero copy and selected sections", () => {
    const rendered = landingLayout<string>({
      site: { title: "Example" },
      landing: {
        sections: ["hero", "cta"],
        headline: "Own your docs.",
        description: "A small and deliberate landing page.",
        command: "pnpm create foldocs@latest example",
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
      copiedText: "",
      searchOpen: false,
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
        selectTheme: () => "select-theme",
        copyText: () => "copy-text",
        gotHeaderLanguageMenuMessage: () => "language-menu",
      },
    });
    const text = Scene.textContent(rendered);
    expect(text).toContain("Own your docs.");
    expect(text).toContain("pnpm create foldocs@latest example");
    expect(text).toContain("Start writing.");
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
        segment: "manual-installation",
        defaultOpen: true,
        root: false,
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
    const rendered = docsLayout<string>({
      site: { title: "Example", baseUrl: "https://example.com" },
      navigation,
      tabs: [],
      currentUrl: metadata.url,
      page,
      previous: adjacent("Overview", "/docs"),
      next: adjacent("Install with npm", "/docs/manual-installation/npm"),
      sidebarOpen: false,
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
      copyMarkdownStatus: "idle",
      searchOpen: false,
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
        gotHeaderLanguageMenuMessage: () => "header-language-menu",
        gotSidebarLanguageMenuMessage: () => "sidebar-language-menu",
      },
    });
    const text = Scene.textContent(rendered);
    const article = Option.getOrThrow(Scene.find(rendered, ".fd-article"));

    expect(text).toContain("Introduction");
    expect(text).toContain("Manual installation");
    expect(text).toContain("View as Markdown");
    expect(text).toContain("Open in ChatGPT");
    expect(text).toContain("Open in Claude");
    expect(text).toContain("Open in Grok");
    expect(text).toContain("Previous");
    expect(text).toContain("Next");
    expect(Option.isSome(Scene.find(rendered, ".fd-sidebar-section"))).toBe(
      true,
    );
    expect(Option.isSome(Scene.find(rendered, ".fd-sidebar-folder"))).toBe(
      true,
    );
    expect(Scene.textContent(article)).toContain("Manual installation");
    expect(Scene.textContent(article)).not.toContain("Introduction");
    expect(Scene.textContent(article)).not.toContain("Built with Foldocs");
    expect(text).toContain("Built with Foldocs and Foldkit.");
  });
});
