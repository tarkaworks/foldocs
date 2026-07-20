import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { syncTrieveSearch } from "../src/index.js";

describe("Trieve ingestion", () => {
  it("uses a server-owned replacement pipeline", async () => {
    const replace = vi.fn(async () => undefined);
    const report = await Effect.runPromise(
      syncTrieveSearch({ replace }, [
        {
          id: "intro",
          url: "/docs/intro",
          title: "Introduction",
          content: "Typed documentation",
        },
      ]),
    );
    expect(replace).toHaveBeenCalledOnce();
    expect(report.provider).toBe("trieve");
  });
});
