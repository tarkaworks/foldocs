import type { MdxComponents } from "foldocs";
import { html } from "foldkit/html";

const h = html();

/** Add project-owned renderers here, then use their names from Markdown or MDX. */
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
