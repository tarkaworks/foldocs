import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { check } from "../src/index.js";

describe("effectdocs check", () => {
  it("reports broken local documentation links", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "effectdocs-check-"));
    const content = path.join(root, "content/docs");
    await fs.mkdir(content, { recursive: true });
    await fs.writeFile(
      path.join(content, "index.md"),
      "# Home\n\n[Missing](/docs/missing)",
    );

    const result = await Effect.runPromise(check({ root }));
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toMatch(/Broken documentation link/iu);
  });

  it("accepts valid page and heading links", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "effectdocs-check-"));
    const content = path.join(root, "content/docs");
    await fs.mkdir(content, { recursive: true });
    await fs.writeFile(
      path.join(content, "index.md"),
      "# Home\n\n[Guide](./guide#details)",
    );
    await fs.writeFile(
      path.join(content, "guide.md"),
      "# Guide\n\n## Details\n\nSafe.",
    );

    const result = await Effect.runPromise(check({ root }));
    expect(result).toMatchObject({ pages: 2, valid: true, issues: [] });
  });
});
