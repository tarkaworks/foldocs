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
