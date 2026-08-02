import { islandsFor } from "@foldkit/markdown";
import { Schema as S } from "effect";
import { inertHtml as h } from "foldkit/html";

export const markdownIslandDefinitions = {
  Aside: S.Struct({
    type: S.optionalKey(S.Literals(["info", "tip", "warning"])),
  }),
};

export const markdownIslands = islandsFor(markdownIslandDefinitions, {
  Aside: (attributes, content) =>
    h.aside(
      [h.Class(`fd-callout fd-callout-${attributes.type ?? "info"}`)],
      content,
    ),
});
