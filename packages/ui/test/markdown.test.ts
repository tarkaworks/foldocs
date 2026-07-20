import { Option } from "effect";
import { html } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import { renderMarkdown, type MdxComponents } from "../src/markdown.js";

describe("custom MDX components", () => {
  it("renders registered inline and block components", () => {
    const h = html();
    const components: MdxComponents = {
      inline: {
        Key: (component, content) =>
          h.kbd(
            [h.Class("custom-key"), h.Title(component.attributes.label)],
            content,
          ),
      },
      block: {
        Feature: (component, content) =>
          h.section(
            [
              h.Class("custom-feature"),
              h.DataAttribute("kind", component.attributes.kind),
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
    );

    expect(rendered).not.toBeNull();
    if (rendered === null) return;
    expect(Option.isSome(Scene.find(rendered, ".custom-feature"))).toBe(true);
    expect(Option.isSome(Scene.find(rendered, ".custom-key"))).toBe(true);
    expect(Scene.textContent(rendered)).toContain("Press ⌘K");
  });
});
