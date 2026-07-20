import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { check, customize } from "../src/index.js";

describe("foldocs check", () => {
  it("reports broken local documentation links", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "foldocs-check-"));
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
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "foldocs-check-"));
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

  it("validates locale routes, route groups, and fallback documents", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "foldocs-check-"));
    const content = path.join(root, "content/docs");
    await fs.mkdir(path.join(content, "en/(get-started)"), {
      recursive: true,
    });
    await fs.mkdir(path.join(content, "es/(get-started)"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(content, "en/(get-started)/index.md"),
      "# Home\n\n[Guide](/en/docs/guide#details)",
    );
    await fs.writeFile(
      path.join(content, "es/(get-started)/index.md"),
      "# Inicio\n\n[Guía](/es/docs/guide#details)",
    );
    await fs.writeFile(
      path.join(content, "en/guide.md"),
      "# Guide\n\n## Details\n\nFallback content.",
    );

    const result = await Effect.runPromise(
      check({
        root,
        locales: ["en", "es"],
        fallbackLocale: "en",
      }),
    );

    expect(result).toMatchObject({ pages: 3, valid: true, issues: [] });
  });
});

describe("foldocs customize", () => {
  it("copies project-owned UI sources and wires CSS imports", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "foldocs-customize-"));
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(
      path.join(root, "src/styles.css"),
      '@import "base.css";\n',
    );

    const result = await Effect.runPromise(
      customize({
        root,
        components: ["theme", "layout", "mdx-components"],
      }),
    );

    expect(result.files).toEqual([
      "src/foldocs/theme.css",
      "src/foldocs/layout.css",
      "src/foldocs/mdx-components.ts",
    ]);
    const styles = await fs.readFile(path.join(root, "src/styles.css"), "utf8");
    expect(styles).toContain('@import "./foldocs/theme.css";');
    expect(styles).toContain('@import "./foldocs/layout.css";');
  });
});
