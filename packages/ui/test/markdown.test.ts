import { islandsFor } from "@foldkit/markdown";
import { Option, Schema as S } from "effect";
import { inertHtml as h } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import { renderMarkdown, type MdxComponents } from "../src/markdown.js";

describe("custom MDX components", () => {
  it("renders typed @foldkit/markdown islands with occurrence indexes", () => {
    const islands = islandsFor(
      { Feature: S.Struct({ kind: S.Literal("primary") }) },
      {
        Feature: (attributes, content, occurrenceIndex) =>
          h.section(
            [
              h.Class("typed-feature"),
              h.DataAttribute("kind", attributes.kind),
              h.DataAttribute("occurrence", String(occurrenceIndex)),
            ],
            content,
          ),
      },
    );
    const rendered = renderMarkdown(
      {
        blocks: [
          {
            _tag: "BlockComponent",
            name: "Feature",
            attributes: { kind: "primary" },
            blocks: [],
          },
          {
            _tag: "BlockComponent",
            name: "Feature",
            attributes: { kind: "primary" },
            blocks: [],
          },
        ],
      },
      { islands },
      h,
    );

    expect(rendered).not.toBeNull();
    if (rendered === null) return;
    expect(Option.isSome(Scene.find(rendered, '[data-occurrence="0"]'))).toBe(
      true,
    );
    expect(Option.isSome(Scene.find(rendered, '[data-occurrence="1"]'))).toBe(
      true,
    );
  });

  it("renders registered inline and block components", () => {
    const components: MdxComponents = {
      inline: {
        Key: (component, content) =>
          h.kbd(
            [h.Class("custom-key"), h.Title(component.attributes.label ?? "")],
            content,
          ),
      },
      block: {
        Feature: (component, content) =>
          h.section(
            [
              h.Class("custom-feature"),
              h.DataAttribute("kind", component.attributes.kind ?? ""),
            ],
            content,
          ),
      },
    };

    const rendered = renderMarkdown(
      {
        blocks: [
          {
            _tag: "BlockComponent",
            name: "Feature",
            attributes: { kind: "primary" },
            blocks: [
              {
                _tag: "Paragraph",
                content: [
                  { _tag: "Text", value: "Press " },
                  {
                    _tag: "InlineComponent",
                    name: "Key",
                    attributes: { label: "Command key" },
                    content: [{ _tag: "Text", value: "⌘K" }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { components },
      h,
    );

    expect(rendered).not.toBeNull();
    if (rendered === null) return;
    expect(Option.isSome(Scene.find(rendered, ".custom-feature"))).toBe(true);
    expect(Option.isSome(Scene.find(rendered, ".custom-key"))).toBe(true);
    expect(Scene.textContent(rendered)).toContain("Press ⌘K");
  });
});
