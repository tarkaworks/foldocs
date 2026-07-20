import { describe, expect, it } from "vitest";

import { resolveConfig } from "../src/config.js";

describe("landing configuration", () => {
  it("resolves an author-selected landing composition", () => {
    const config = resolveConfig({
      site: { title: "Docs" },
      landing: {
        sections: ["hero", "features", "cta"],
        headline: "Own your documentation.",
        command: "pnpm create foldocs@latest docs",
      },
    });
    expect(config.landing).toMatchObject({
      sections: ["hero", "features", "cta"],
      headline: "Own your documentation.",
      command: "pnpm create foldocs@latest docs",
    });
  });

  it("requires one unique hero section", () => {
    expect(() =>
      resolveConfig({
        site: { title: "Docs" },
        landing: { sections: ["features"] },
      }),
    ).toThrow(/must include hero/u);
    expect(() =>
      resolveConfig({
        site: { title: "Docs" },
        landing: { sections: ["hero", "hero"] },
      }),
    ).toThrow(/must not contain duplicates/u);
  });
});
