import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createSearchIndexer, syncSearchDocuments } from "../src/index.js";
import { loadSearchDocuments, syncSearchIndex } from "../src/sync.js";

const documents = [
  {
    id: "en/intro",
    url: "/en/docs/intro",
    title: "Introduction",
    content: "Typed documentation",
    locale: "en",
  },
  {
    id: "es/intro",
    url: "/es/docs/intro",
    title: "Introducción",
    content: "Documentación tipada",
    locale: "es",
  },
] as const;

describe("hosted search synchronization", () => {
  it("validates, orders, and reports a complete corpus", async () => {
    const replace = vi.fn(async () => undefined);
    const report = await Effect.runPromise(
      syncSearchDocuments(createSearchIndexer("test", replace), [
        documents[1],
        documents[0],
      ]),
    );

    expect(replace).toHaveBeenCalledWith(documents);
    expect(report).toEqual({
      provider: "test",
      documents: 2,
      locales: ["en", "es"],
    });
  });

  it("rejects duplicate ids before replacing the provider corpus", async () => {
    const replace = vi.fn(async () => undefined);
    const result = await Effect.runPromiseExit(
      syncSearchDocuments(createSearchIndexer("test", replace), [
        documents[0],
        { ...documents[0], url: "/en/docs/other" },
      ]),
    );

    expect(result._tag).toBe("Failure");
    expect(replace).not.toHaveBeenCalled();
  });

  it("loads and syncs a generated static search index", async () => {
    const directory = await mkdtemp(join(tmpdir(), "foldocs-search-"));
    const path = join(directory, "search-index.json");
    await writeFile(path, JSON.stringify(documents));
    expect(await Effect.runPromise(loadSearchDocuments(path))).toEqual(
      documents,
    );

    const replace = vi.fn(async () => undefined);
    const report = await Effect.runPromise(
      syncSearchIndex(createSearchIndexer("test", replace), { source: path }),
    );
    expect(report.documents).toBe(2);
  });
});
