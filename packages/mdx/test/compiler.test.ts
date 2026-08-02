import { Schema as S } from "effect";
import { describe, expect, it } from "vitest";

import { compile } from "../src/index.js";

describe("compile", () => {
  it("uses @foldkit/markdown for .md and validates typed islands", async () => {
    const page = await compile(
      `---
title: Official Markdown
---

# Official Markdown

:::Aside{type="tip"}
This island is checked at build time.
:::
`,
      {
        filePath: "official.md",
        highlight: false,
        markdown: {
          islands: {
            Aside: S.Struct({ type: S.Literals(["tip", "warning"]) }),
          },
        },
      },
    );

    expect(page.frontmatter.title).toBe("Official Markdown");
    expect(page.document.blocks).toContainEqual(
      expect.objectContaining({
        _tag: "BlockComponent",
        name: "Aside",
        attributes: { type: "tip" },
      }),
    );

    await expect(
      compile('# Invalid\n\n::Aside{type="unknown"}', {
        filePath: "invalid.md",
        highlight: false,
        markdown: {
          islands: {
            Aside: S.Struct({ type: S.Literals(["tip", "warning"]) }),
          },
        },
      }),
    ).rejects.toThrow(/Invalid attributes for island "Aside"/u);
  });

  it("keeps task lists as an explicit Foldocs Markdown extension", async () => {
    const page = await compile("# Tasks\n\n- [x] Ship it\n- [ ] Document it", {
      filePath: "tasks.md",
      highlight: false,
    });
    const list = page.document.blocks.find((block) => block._tag === "List");
    expect(list?._tag).toBe("List");
    if (list?._tag !== "List") return;
    expect(list.items.map((item) => item.checked)).toEqual([true, false]);

    await expect(
      compile("# Tasks\n\n- [x] Ship it\n\n::Unknown", {
        filePath: "invalid-tasks.md",
        highlight: false,
        markdown: { islands: {} },
      }),
    ).rejects.toThrow(/Unknown island "Unknown"/u);
  });

  it("uses the official vocabulary errors for unsupported .md syntax", async () => {
    await expect(
      compile("# Links\n\nRead [the guide][guide].\n\n[guide]: /guide", {
        filePath: "links.md",
        highlight: false,
      }),
    ).rejects.toThrow(/Reference-style links are not supported/u);
  });

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
