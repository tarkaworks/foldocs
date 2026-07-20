import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createAlgoliaSearchClient } from "../src/index.js";

describe("Algolia adapter", () => {
  it("maps Algolia hits and forwards filters", async () => {
    const searchForHits = vi.fn(async () => ({
      results: [
        {
          hits: [
            {
              objectID: "effect",
              url: "/docs/effect",
              title: "Effect",
              description: "Typed computations",
            },
          ],
        },
      ],
    }));
    const client = createAlgoliaSearchClient({
      client: { searchForHits },
      indexName: "docs",
    });
    const results = await Effect.runPromise(
      client.search("typed", { locale: "en", tags: ["core"] }),
    );
    expect(results[0]).toMatchObject({ id: "effect", title: "Effect" });
    expect(searchForHits).toHaveBeenCalledWith(
      expect.objectContaining({
        requests: [
          expect.objectContaining({ indexName: "docs", query: "typed" }),
        ],
      }),
    );
  });
});
