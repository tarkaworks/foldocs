import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { compile } from "foldocs-mdx";
import { describe, expect, it } from "vitest";

import { generateFilesOnly } from "../src/index.js";

describe("Python API generator", () => {
  it("extracts signatures and docstrings without importing the module", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "foldocs-py-"));
    const input = path.join(directory, "api.py");
    await writeFile(
      input,
      `def greet(name: str, loud: bool = False) -> str:
    """Create a greeting."""
    raise RuntimeError("must not execute")

class Client:
    """Documentation client."""

    def search(self, query: str) -> list[str]:
        """Search documents."""
        return []
`,
    );
    const files = await generateFilesOnly({
      input,
      output: path.join(directory, "docs"),
      baseUrl: "/en/docs/python",
    });
    expect(files.map((file) => file.path)).toEqual([
      "index.mdx",
      "meta.json",
      "greet.mdx",
      "client.mdx",
    ]);
    expect(files.find((file) => file.path === "client.mdx")?.content).toContain(
      "def search(self, query: str) -> list[str]: ...",
    );
    for (const file of files.filter((file) => file.path.endsWith(".mdx")))
      await expect(
        compile(file.content, { filePath: file.path, highlight: false }),
      ).resolves.toBeDefined();
  });
});
