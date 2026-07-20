import { describe, expect, it, vi } from "vitest";

import { createSanityContentSource } from "../src/index.js";

describe("Sanity content source", () => {
  it("maps a GROQ result to virtual MDX files", async () => {
    const fetch = vi.fn(async () => [
      { slug: "intro", title: "Introduction", body: "Welcome" },
    ]);
    const source = createSanityContentSource({
      client: { fetch },
      query: '*[_type == "docs"]',
      map: (record: { slug: string; title: string; body: string }) => ({
        path: `${record.slug}.mdx`,
        source: `---\ntitle: ${record.title}\n---\n\n${record.body}`,
      }),
    });

    expect(await source.load()).toEqual([
      expect.objectContaining({ path: "intro.mdx" }),
    ]);
    expect(fetch).toHaveBeenCalledWith(
      '*[_type == "docs"]',
      undefined,
      undefined,
    );
  });
});
