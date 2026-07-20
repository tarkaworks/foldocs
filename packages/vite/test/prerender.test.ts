import { buildNavigation, resolveConfig } from "foldocs-core";
import type { CompiledPage } from "foldocs-mdx";
import { describe, expect, it } from "vitest";

import {
  prerenderRouteHtml,
  routeHtmlFile,
  type PrerenderPage,
} from "../src/prerender.js";
import { searchIndexAssetPath } from "../src/index.js";

const compiled: CompiledPage = {
  frontmatter: {
    title: "Static page",
    description: "Page-specific description.",
    keywords: ["static", "docs"],
    socialImage: "/static-page.png",
  },
  document: {
    blocks: [
      {
        _tag: "Heading",
        id: "static-content",
        level: 2,
        content: [{ _tag: "Text", value: "Static content" }],
      },
      {
        _tag: "Paragraph",
        content: [{ _tag: "Text", value: "Available without JavaScript." }],
      },
    ],
  },
  toc: [{ id: "static-content", title: "Static content", depth: 2 }],
  source: "# Static page",
  plainText: "Static page Static content Available without JavaScript.",
};

describe("route prerendering", () => {
  it("writes full localized HTML with route metadata", () => {
    const config = resolveConfig({
      site: {
        title: "Example",
        description: "Site description.",
        baseUrl: "https://example.com",
      },
      i18n: {
        defaultLocale: "en",
        locales: [
          { locale: "en", name: "English" },
          { locale: "es", name: "Español" },
        ],
      },
    });
    const page: PrerenderPage = {
      compiled,
      metadata: {
        id: "en/static.mdx",
        slug: "static",
        url: "/en/docs/static",
        file: "content/docs/en/static.mdx",
        locale: "en",
        sourceLocale: "en",
        translationKey: "static",
        navigationPath: "static.mdx",
        frontmatter: compiled.frontmatter,
        toc: compiled.toc,
        plainText: compiled.plainText,
      },
    };
    const navigation = buildNavigation([page.metadata]);
    const html = prerenderRouteHtml(
      '<!doctype html><html lang="en"><head><title>Old</title><meta name="description" content="Old"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>',
      config,
      [page],
      { en: navigation, es: navigation },
      { url: page.metadata.url, locale: "en", page },
    );

    expect(html).toContain("<title>Static page | Example</title>");
    expect(html).toContain('content="Page-specific description."');
    expect(html).toContain('content="https://example.com/static-page.png"');
    expect(html).toContain(
      'rel="canonical" href="https://example.com/en/docs/static"',
    );
    expect(html).toContain(
      'hreflang="es" href="https://example.com/es/docs/static"',
    );
    expect(html).toContain(
      'class="fd-root fd-layout-docs light" data-layout="docs" id="root"',
    );
    expect(html).toContain("Available without JavaScript.");
    expect(html).toContain('<script type="module" src="/app.js"></script>');
    expect(html.match(/name="description"/gu)).toHaveLength(1);
  });

  it("maps clean URLs to directory index files", () => {
    expect(routeHtmlFile("/")).toBe("index.html");
    expect(routeHtmlFile("/en/docs/static/")).toBe("en/docs/static/index.html");
    expect(searchIndexAssetPath(false, "en")).toBe("search-index.json");
    expect(searchIndexAssetPath(true, "es")).toBe("es/search-index.json");
  });
});
