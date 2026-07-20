import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { compile } from "foldocs-mdx";

import { generateFilesOnly } from "../src/index.js";

describe("TypeScript API generator", () => {
  it("emits documented, compilable pages from declarations", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "foldocs-ts-"));
    const input = path.join(directory, "api.ts");
    await writeFile(
      input,
      `/** Create a greeting. */
export function greet(name: string): string { return \`Hello \${name}\`; }

/** Runtime options. */
export interface Options { readonly loud?: boolean }
`,
    );
    const files = await generateFilesOnly({
      input,
      output: path.join(directory, "docs"),
      baseUrl: "/en/docs/typescript",
    });
    expect(files.map((file) => file.path)).toEqual([
      "index.mdx",
      "meta.json",
      "greet.mdx",
      "options.mdx",
    ]);
    expect(files.find((file) => file.path === "greet.mdx")?.content).toContain(
      "Create a greeting.",
    );
    for (const file of files.filter((file) => file.path.endsWith(".mdx")))
      await expect(
        compile(file.content, { filePath: file.path, highlight: false }),
      ).resolves.toBeDefined();
  });
});
