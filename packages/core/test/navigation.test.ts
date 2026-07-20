import type { PageMetadata } from "@effectdocs/content";
import { describe, expect, it } from "vitest";

import { adjacentPages, buildNavigation, findPageByUrl } from "../src/index.js";

const page = (
  slug: string,
  title: string,
  options: { order?: number; hidden?: boolean } = {},
): PageMetadata => ({
  id: `${slug || "index"}.mdx`,
  slug,
  url: `/docs${slug.length === 0 ? "" : `/${slug}`}`,
  file: `content/docs/${slug || "index"}.mdx`,
  frontmatter: { title, ...options },
  toc: [],
  plainText: title,
});

describe("navigation", () => {
  const pages = [
    page("guides/configuration", "Configuration", { order: 3 }),
    page("", "Home", { order: 1 }),
    page("getting-started", "Getting started", { order: 2 }),
    page("internal", "Internal", { hidden: true }),
  ];

  it("builds folders and excludes hidden pages", () => {
    const tree = buildNavigation(pages);
    expect(tree.map((node) => node.label)).toEqual([
      "Home",
      "Getting started",
      "Guides",
    ]);
    expect(JSON.stringify(tree)).not.toContain("Internal");
  });

  it("uses route groups and meta.json-compatible ordering", () => {
    const grouped = [
      {
        ...page("", "Introduction"),
        id: "(get-started)/index.mdx",
      },
      {
        ...page("getting-started", "Getting started"),
        id: "(get-started)/getting-started.mdx",
      },
      {
        ...page("features/search", "Search"),
        id: "features/search.md",
      },
    ];
    const tree = buildNavigation(grouped, {
      "": { pages: ["(get-started)", "features"] },
      "(get-started)": {
        title: "Get started",
        pages: ["index", "getting-started"],
        defaultOpen: true,
      },
      features: { title: "Features", defaultOpen: false },
    });

    expect(tree).toMatchObject([
      {
        _tag: "Folder",
        label: "Get started",
        defaultOpen: true,
        children: [
          { _tag: "Page", label: "Introduction" },
          { _tag: "Page", label: "Getting started" },
        ],
      },
      { _tag: "Folder", label: "Features", defaultOpen: false },
    ]);
  });

  it("normalizes trailing slashes and returns adjacent pages", () => {
    expect(
      findPageByUrl(pages, "/docs/getting-started/")?.frontmatter.title,
    ).toBe("Getting started");
    expect(adjacentPages(pages, "/docs/getting-started")).toMatchObject({
      previous: { frontmatter: { title: "Home" } },
      next: { frontmatter: { title: "Configuration" } },
    });
  });
});
