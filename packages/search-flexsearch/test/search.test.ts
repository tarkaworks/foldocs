import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createFlexSearchClient } from "../src/index.js";

describe("FlexSearch adapter", () => {
  it("indexes the common Foldocs document contract", async () => {
    const client = createFlexSearchClient([
      {
        id: "layer",
        url: "/docs/layer",
        title: "Layer",
        description: "Dependency injection",
        content: "Construct application services.",
      },
    ]);
    const results = await Effect.runPromise(client.search("dependency"));
    expect(results[0]).toMatchObject({ id: "layer", url: "/docs/layer" });
  });
});
