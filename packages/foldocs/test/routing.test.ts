import { defaultUiTranslations, type PageManifest } from "foldocs-core";
import type { CompiledPage } from "foldocs-mdx";
import { Option } from "effect";
import { fromString } from "foldkit/url";
import { describe, expect, it } from "vitest";

import { createDocsProgram } from "../src/index.js";

const url = (value: string) => Option.getOrThrow(fromString(value));

const manifestEntry = (
  pathname: string,
  slug: string,
  locale?: string,
): PageManifest<CompiledPage>[number] => ({
  id: slug || "index",
  slug,
  url: pathname,
  file: "index.mdx",
  ...(locale === undefined
    ? {}
    : { locale, sourceLocale: locale, translationKey: slug }),
  frontmatter: { title: "Introduction" },
  toc: [],
  plainText: "Introduction",
  load: async () => {
    throw new Error("The routing test must not load content.");
  },
});

describe("generated homepage routing", () => {
  it("renders the built-in homepage when docs use /docs", () => {
    const program = createDocsProgram({
      manifest: [manifestEntry("/docs", "")],
      site: { title: "Example docs" },
    });

    const [model] = program.init(url("https://example.com/"));

    expect(model.page._tag).toBe("PageHome");
  });

  it("keeps a root document when basePath is /", () => {
    const program = createDocsProgram({
      manifest: [manifestEntry("/", "")],
      site: { title: "Example docs" },
    });

    const [model] = program.init(url("https://example.com/"));

    expect(model.page._tag).toBe("PageLoading");
  });

  it("redirects unprefixed routes and renders locale home routes", () => {
    const i18n = {
      enabled: true,
      defaultLocale: "en",
      fallbackLocale: "en",
      locales: [
        {
          locale: "en",
          name: "English",
          dir: "ltr" as const,
          ui: defaultUiTranslations,
        },
      ],
    };
    const program = createDocsProgram({
      manifest: [manifestEntry("/en/docs", "", "en")],
      site: { title: "Example docs" },
      basePath: "/docs",
      i18n,
    });

    const [redirecting] = program.init(url("https://example.com/docs"));
    const [home] = program.init(url("https://example.com/en"));

    expect(redirecting.page._tag).toBe("PageLoading");
    expect(redirecting.locale).toBe("en");
    expect(home.page._tag).toBe("PageHome");
  });
});
