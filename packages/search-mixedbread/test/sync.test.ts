import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { syncMixedbreadSearch } from "../src/index.js";

describe("Mixedbread ingestion", () => {
  it("uses a private store replacement pipeline", async () => {
    const replace = vi.fn(async () => undefined);
    const report = await Effect.runPromise(
      syncMixedbreadSearch({ replace }, [
        {
          id: "intro",
          url: "/docs/intro",
          title: "Introduction",
          content: "Typed documentation",
        },
      ]),
    );
    expect(replace).toHaveBeenCalledOnce();
    expect(report.provider).toBe("mixedbread");
  });
});
