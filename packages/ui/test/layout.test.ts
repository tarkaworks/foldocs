import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import { defaultUiTranslations } from "foldocs-core";

import { landingLayout } from "../src/layout.js";

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
      },
    });
    const text = Scene.textContent(rendered);
    expect(text).toContain("Own your docs.");
    expect(text).toContain("pnpm create foldocs@latest example");
    expect(text).toContain("Start writing.");
    expect(text).not.toContain("Batteries included.");
  });
});
