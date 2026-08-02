import { describe, expect, it } from "vitest";

import {
  adjacentPages,
  buildNavigation,
  findPageByUrl,
  flattenNavigation,
  navigationForUrl,
  navigationTabsForUrl,
  type PageManifestEntry,
} from "../src/index.js";

const page = (
  slug: string,
  title: string,
  options: {
    order?: number;
    hidden?: boolean;
    icon?: string;
    index?: boolean;
  } = {},
): PageManifestEntry<undefined> => ({
  id: `${slug || "index"}.mdx`,
  slug,
  url: `/docs${slug.length === 0 ? "" : `/${slug}`}`,
  file: `content/docs/${slug || "index"}.mdx`,
  frontmatter: { title, ...options },
  toc: [],
  plainText: title,
  load: async () => ({ default: undefined }),
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
        ...page("getting-started", "Getting started", { icon: "rocket" }),
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
        icon: "book-open",
        pages: ["index", "getting-started"],
        defaultOpen: true,
      },
      features: { title: "Features", defaultOpen: false },
    });

    expect(tree).toMatchObject([
      {
        _tag: "Folder",
        label: "Get started",
        icon: "book-open",
        defaultOpen: true,
        children: [
          { _tag: "Page", label: "Introduction" },
          { _tag: "Page", label: "Getting started", icon: "rocket" },
        ],
      },
      { _tag: "Folder", label: "Features", defaultOpen: false },
    ]);
  });

  it("renders static separators separately from collapsible folders", () => {
    const grouped = [
      page("", "Overview"),
      {
        ...page("manual-installation", "Manual installation", { index: true }),
        navigationPath: "manual-installation/index.md",
      },
      page("manual-installation/pnpm", "pnpm"),
      page("configuration", "Configuration"),
    ];
    const tree = buildNavigation(grouped, {
      "": {
        pages: [
          "---Introduction---",
          "index",
          "manual-installation",
          "---Writing---",
          "configuration",
        ],
      },
      "manual-installation": {
        title: "Manual installation",
        defaultOpen: false,
        pages: ["index", "pnpm"],
      },
    });

    expect(tree).toMatchObject([
      { _tag: "Separator", label: "Introduction" },
      { _tag: "Page", label: "Overview" },
      {
        _tag: "Folder",
        label: "Manual installation",
        defaultOpen: false,
        index: { _tag: "Page", label: "Manual installation" },
        children: [{ _tag: "Page", label: "pnpm" }],
      },
      { _tag: "Separator", label: "Writing" },
      { _tag: "Page", label: "Configuration" },
    ]);
    expect(flattenNavigation(tree).map((entry) => entry.label)).toEqual([
      "Overview",
      "Manual installation",
      "pnpm",
      "Configuration",
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

  it("scopes navigation and pagination to active root folders", () => {
    const versioned = [
      { ...page("v1", "Version 1"), id: "v1/index.mdx" },
      page("v1/configuration", "V1 configuration"),
      { ...page("v2", "Version 2"), id: "v2/index.mdx" },
      page("v2/configuration", "V2 configuration"),
    ];
    const tree = buildNavigation(versioned, {
      v1: {
        title: "v1",
        description: "Legacy",
        root: true,
        pages: ["index", "configuration"],
      },
      v2: {
        title: "v2",
        description: "Latest",
        root: true,
        pages: ["index", "configuration"],
      },
    });
    const scoped = navigationForUrl(tree, "/docs/v2");

    expect(scoped.map((node) => node.label)).toEqual([
      "Version 2",
      "V2 configuration",
    ]);
    expect(navigationTabsForUrl(tree, "/docs/v2")).toEqual([
      {
        title: "v1",
        description: "Legacy",
        url: "/docs/v1",
        current: false,
      },
      {
        title: "v2",
        description: "Latest",
        url: "/docs/v2",
        current: true,
      },
    ]);
    expect(adjacentPages(versioned, "/docs/v2", scoped)).toMatchObject({
      next: { frontmatter: { title: "V2 configuration" } },
    });
    expect(adjacentPages(versioned, "/docs/v2", scoped).previous).toBe(
      undefined,
    );
  });
});
