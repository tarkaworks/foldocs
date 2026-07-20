import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { syncTypesenseSearch } from "../src/index.js";

describe("Typesense ingestion", () => {
  it("clears the prior snapshot and validates the import", async () => {
    const remove = vi.fn(async () => undefined);
    const importDocuments = vi.fn(async () => [{ success: true }]);
    const report = await Effect.runPromise(
      syncTypesenseSearch(
        {
          client: {
            collections: () => ({
              documents: () => ({
                delete: remove,
                import: importDocuments,
              }),
            }),
          },
          collectionName: "docs",
        },
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

    expect(remove).toHaveBeenCalledWith({
      filter_by: "id:!=__foldocs_never__",
    });
    expect(importDocuments).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "en/intro", locale: "en" })],
      { action: "upsert" },
    );
    expect(report.documents).toBe(1);
  });

  it("fails the Effect when Typesense rejects an imported row", async () => {
    const result = await Effect.runPromiseExit(
      syncTypesenseSearch(
        {
          client: {
            collections: () => ({
              documents: () => ({
                delete: async () => undefined,
                import: async () =>
                  '{"success":false,"error":"invalid schema"}',
              }),
            }),
          },
          collectionName: "docs",
        },
        [
          {
            id: "intro",
            url: "/docs/intro",
            title: "Introduction",
            content: "Typed documentation",
          },
        ],
      ),
    );
    expect(result._tag).toBe("Failure");
  });
});
