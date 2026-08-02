import type { MdxComponents } from "foldocs";
import { inertHtml as h } from "foldkit/html";

/** Project-owned renderers for deterministic MDX elements. */
export const mdxComponents: MdxComponents = {
  inline: {
    Kbd: (component, content) =>
      h.kbd(
        [
          h.Class("fd-inline-code"),
          ...(component.attributes.label === undefined
            ? []
            : [h.AriaLabel(component.attributes.label)]),
        ],
        content,
      ),
  },
  block: {
    Aside: (component, content) =>
      h.aside(
        [
          h.Class(
            `fd-callout fd-callout-${component.attributes.type ?? "info"}`,
          ),
          h.DataAttribute("component", component.name),
        ],
        content,
      ),
  },
};
