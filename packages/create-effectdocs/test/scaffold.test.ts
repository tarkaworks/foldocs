import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { scaffold } from "../src/index.js";

describe("create-effectdocs", () => {
  it("creates a complete, renamed application without prompts", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "create-effectdocs-"));
    const result = await Effect.runPromise(
      scaffold({
        directory: "My Docs",
        cwd,
        install: false,
        packageManager: "pnpm",
      }),
    );
    const packageJson = JSON.parse(
      await fs.readFile(path.join(result.directory, "package.json"), "utf8"),
    ) as { name: string };
    expect(packageJson.name).toBe("my-docs");
    await expect(
      fs.stat(path.join(result.directory, ".gitignore")),
    ).resolves.toBeDefined();
    await expect(
      fs.stat(path.join(result.directory, "content/docs/index.mdx")),
    ).resolves.toBeDefined();
    await expect(
      fs.stat(path.join(result.directory, "src/entry.ts")),
    ).resolves.toBeDefined();
  });
});
