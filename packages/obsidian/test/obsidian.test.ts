import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { compile } from "foldocs-mdx";
import { describe, expect, it } from "vitest";

import { convertObsidianMarkdown, generateVault } from "../src/index.js";

describe("Obsidian conversion", () => {
  it("converts wiki links, embeds, comments, and block ids", () => {
    expect(
      convertObsidianMarkdown(
        "See [[Install Guide#Setup|installation]].\n\n![[diagram.png|Flow]]\n\nHidden %%comment%% text ^block",
        {
          resolveLink: () => "./install-guide",
          resolveAsset: () => "./_assets/diagram.png",
        },
      ),
    ).toBe(
      "See [installation](./install-guide#setup).\n\n![Flow](./_assets/diagram.png)\n\nHidden  text\n",
    );
  });

  it("creates compilable managed MDX and copies attachments", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "foldocs-vault-"));
    const vault = path.join(root, "vault");
    const output = path.join(root, "docs");
    await mkdir(vault);
    await writeFile(path.join(vault, "Welcome.md"), "# Welcome\n\n[[Guide]]");
    await writeFile(path.join(vault, "Guide.md"), "# Guide\n\n![[image.png]]");
    await writeFile(path.join(vault, "image.png"), new Uint8Array([1, 2, 3]));
    const result = await generateVault({ input: vault, output });
    expect(result).toMatchObject({ pages: 2, assets: 1 });
    const source = await readFile(path.join(output, "welcome.mdx"), "utf8");
    expect(source).toContain("[Guide](./guide)");
    await expect(
      compile(source, { filePath: "welcome.mdx", highlight: false }),
    ).resolves.toBeDefined();
  });
});
