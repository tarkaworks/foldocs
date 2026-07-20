import { describe, expect, it } from "vitest";

import { compile } from "../src/index.js";

describe("compile", () => {
  it("compiles frontmatter, GFM, code and deterministic MDX", async () => {
    const page = await compile(
      `---
title: Effects
description: Typed effects
tags: [core]
---

# Effects

<Callout title="Important">
Use **scopes**.
</Callout>

## Resource safety

| API | Purpose |
| --- | --- |
| Scope | Cleanup |

\`\`\`ts
const program = Effect.succeed(1)
\`\`\`
`,
      { filePath: "effects.mdx", highlight: false },
    );

    expect(page.frontmatter).toMatchObject({
      title: "Effects",
      tags: ["core"],
    });
    expect(page.toc).toEqual([
      { id: "resource-safety", title: "Resource safety", depth: 2 },
    ]);
    expect(page.document.blocks.map((block) => block._tag)).toContain(
      "BlockComponent",
    );
    expect(page.document.blocks.map((block) => block._tag)).toContain("Table");
    expect(page.plainText).toContain("Typed effects");
  });

  it("derives a title from the first heading", async () => {
    const page = await compile("# Inferred title\n\nContent", {
      highlight: false,
    });
    expect(page.frontmatter.title).toBe("Inferred title");
  });

  it("rejects executable MDX expressions", async () => {
    await expect(
      compile("# Unsafe\n\n<Value count={process.env.SECRET} />", {
        filePath: "unsafe.mdx",
        highlight: false,
      }),
    ).rejects.toThrow(/literal string attribute/iu);
  });

  it("rejects unsafe URL schemes", async () => {
    await expect(
      compile("# Unsafe\n\n[click](javascript:alert(1))"),
    ).rejects.toThrow(/Unsafe URL scheme/iu);
  });

  it("decorates highlighted code with accessible visual line numbers", async () => {
    const page = await compile(
      "# Code\n\n```ts\nconst one = 1\nconst two = 2\n```",
      {
        filePath: "code.mdx",
      },
    );
    const code = page.document.blocks.find(
      (block) => block._tag === "CodeBlock",
    );
    expect(code?._tag).toBe("CodeBlock");
    if (code?._tag !== "CodeBlock") return;
    expect(code.highlightedHtml).toContain('data-line-digits="2"');
    expect(code.highlightedHtml).toContain('data-line="1"');
    expect(code.highlightedHtml).toContain('data-line="2"');
  });
});
