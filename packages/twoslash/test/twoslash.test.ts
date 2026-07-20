import { compile } from "foldocs-mdx";
import { describe, expect, it } from "vitest";

import { createTwoslashHighlighter } from "../src/index.js";

describe("Twoslash highlighter", () => {
  it("adds compiler-powered hover markup only to explicit blocks", async () => {
    const page = await compile(
      `---
title: Types
---

\`\`\`ts twoslash
const greeting = "hello" as const
greeting
\`\`\`
`,
      { highlightCode: createTwoslashHighlighter() },
    );
    const block = page.document.blocks.find(
      (candidate) => candidate._tag === "CodeBlock",
    );
    expect(block?._tag).toBe("CodeBlock");
    if (block?._tag === "CodeBlock") {
      expect(block.highlightedHtml).toContain("twoslash");
      expect(block.highlightedHtml).toContain("hello");
    }
  });
});
