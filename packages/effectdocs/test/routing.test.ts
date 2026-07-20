import type { PageManifest } from "effectdocs-core";
import type { CompiledPage } from "effectdocs-mdx";
import { Option } from "effect";
import { fromString } from "foldkit/url";
import { describe, expect, it } from "vitest";

import { createDocsProgram } from "../src/index.js";

const url = (value: string) => Option.getOrThrow(fromString(value));

const manifestEntry = (
  pathname: string,
  slug: string,
): PageManifest<CompiledPage>[number] => ({
  id: slug || "index",
  slug,
  url: pathname,
  file: "index.mdx",
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
});
