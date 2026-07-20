import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { syncOramaCloudSearch } from "../src/index.js";

describe("Orama Cloud ingestion", () => {
  it("replaces and commits the generated corpus in one transaction", async () => {
    const open = vi.fn(async () => undefined);
    const insertDocuments = vi.fn(async () => undefined);
    const commit = vi.fn(async () => undefined);
    const set = vi.fn(() => ({
      transaction: { open, insertDocuments, commit },
    }));

    const report = await Effect.runPromise(
      syncOramaCloudSearch(
        { client: { index: { set } }, indexName: "docs-en" },
        [
          {
            id: "en/intro",
            url: "/en/docs/intro",
            title: "Introduction",
            content: "Typed documentation",
            locale: "en",
          },
        ],
      ),
    );

    expect(set).toHaveBeenCalledWith("docs-en");
    expect(open).toHaveBeenCalledBefore(insertDocuments);
    expect(insertDocuments).toHaveBeenCalledBefore(commit);
    expect(report).toMatchObject({ provider: "orama-cloud", documents: 1 });
  });
});
