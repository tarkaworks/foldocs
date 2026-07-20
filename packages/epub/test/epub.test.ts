import { unzipSync, strFromU8 } from "fflate";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createEpub, exportDirectory } from "../src/index.js";

describe("EPUB export", () => {
  it("creates a valid EPUB 3 container with navigation and chapters", () => {
    const bytes = createEpub(
      [
        {
          id: "intro",
          title: "Introduction",
          body: "<p>Typed documentation.</p>",
        },
      ],
      {
        title: "Foldocs",
        identifier: "urn:foldocs:test",
        modified: new Date("2026-01-01T00:00:00Z"),
        assets: [
          {
            path: "diagram.svg",
            mediaType: "image/svg+xml",
            data: new TextEncoder().encode("<svg/>"),
          },
        ],
      },
    );
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(Array.from(bytes.slice(8, 10))).toEqual([0, 0]);
    expect(strFromU8(bytes.slice(30, 38))).toBe("mimetype");
    expect(strFromU8(bytes.slice(38, 58))).toBe("application/epub+zip");
    const archive = unzipSync(bytes);
    expect(strFromU8(archive["mimetype"]!)).toBe("application/epub+zip");
    expect(strFromU8(archive["OEBPS/content.opf"]!)).toContain('version="3.0"');
    expect(strFromU8(archive["OEBPS/nav.xhtml"]!)).toContain("Introduction");
    expect(strFromU8(archive["OEBPS/content.opf"]!)).toContain(
      'href="assets/diagram.svg" media-type="image/svg+xml"',
    );
    expect(strFromU8(archive["OEBPS/assets/diagram.svg"]!)).toBe("<svg/>");
  });

  it("embeds and rewrites local content attachments", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "foldocs-epub-"));
    const content = path.join(root, "content");
    const assets = path.join(content, "_assets");
    const output = path.join(root, "docs.epub");
    await mkdir(assets, { recursive: true });
    await writeFile(
      path.join(content, "index.mdx"),
      "---\ntitle: Portable\n---\n\n# Portable\n\n![Diagram](./_assets/diagram.svg)\n",
    );
    await writeFile(path.join(assets, "diagram.svg"), "<svg/>");
    await exportDirectory({
      input: content,
      output,
      title: "Portable",
      identifier: "urn:portable",
      modified: new Date("2026-01-01T00:00:00Z"),
    });
    const archive = unzipSync(await readFile(output));
    expect(strFromU8(archive["OEBPS/assets/_assets/diagram.svg"]!)).toBe(
      "<svg/>",
    );
    expect(strFromU8(archive["OEBPS/chapters/index.xhtml"]!)).toContain(
      'src="../assets/_assets/diagram.svg"',
    );
  });
});
