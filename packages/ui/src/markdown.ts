import * as FoldkitMarkdown from "@foldkit/markdown";
import type {
  Block,
  BlockComponent,
  Document as MdxDocument,
  Inline,
  InlineComponent,
  TableRow,
} from "foldocs-mdx";
import { type Html, type HtmlBuilder } from "foldkit/html";

import { icons } from "./icons.js";

export type InlineComponentView = (
  component: InlineComponent,
  content: ReadonlyArray<Html | string>,
) => Html;

export type BlockComponentView = (
  component: BlockComponent,
  content: ReadonlyArray<Html>,
) => Html;

export interface MdxComponents {
  readonly inline?: Readonly<Record<string, InlineComponentView>>;
  readonly block?: Readonly<Record<string, BlockComponentView>>;
}

export type MarkdownIslands = FoldkitMarkdown.Islands;

export interface MarkdownViewOptions<Message> {
  /** Typed directive views produced by @foldkit/markdown `islandsFor`. */
  readonly islands?: MarkdownIslands;
  readonly components?: MdxComponents;
  readonly copiedCode?: string;
  readonly copyCode?: (value: string) => Message;
  readonly copyLabel?: string;
  readonly copiedLabel?: string;
  readonly copyAriaLabel?: string;
  readonly copiedAriaLabel?: string;
}

const externalUrl = (url: string): boolean => /^(?:https?:)?\/\//iu.test(url);

export const renderMarkdown = <Message>(
  document: MdxDocument,
  options: MarkdownViewOptions<Message> = {},
  h: HtmlBuilder<Message>,
): Html => {
  const islandOccurrenceCounts = new Map<string, number>();
  const renderInline = (inline: Inline): Html | string => {
    switch (inline._tag) {
      case "Text":
        return FoldkitMarkdown.defaultViews.Text(inline);
      case "InlineCode":
        return h.code([h.Class("fd-inline-code")], [inline.value]);
      case "HardBreak":
        return FoldkitMarkdown.defaultViews.HardBreak(inline);
      case "Emphasis":
        return FoldkitMarkdown.defaultViews.Emphasis(
          { _tag: "Emphasis", content: [] },
          inline.content.map(renderInline),
        );
      case "Strong":
        return FoldkitMarkdown.defaultViews.Strong(
          { _tag: "Strong", content: [] },
          inline.content.map(renderInline),
        );
      case "Strikethrough":
        return FoldkitMarkdown.defaultViews.Strikethrough(
          { _tag: "Strikethrough", content: [] },
          inline.content.map(renderInline),
        );
      case "Link":
        return h.a(
          [
            h.Href(inline.url),
            h.Class("fd-prose-link"),
            ...(inline.title === undefined ? [] : [h.Title(inline.title)]),
            ...(externalUrl(inline.url)
              ? [h.Target("_blank"), h.Rel("noreferrer noopener")]
              : []),
          ],
          inline.content.map(renderInline),
        );
      case "Image":
        return h.img([
          h.Src(inline.url),
          h.Alt(inline.alt),
          h.Class("fd-prose-image"),
          ...(inline.title === undefined ? [] : [h.Title(inline.title)]),
        ]);
      case "InlineComponent": {
        const content = inline.content.map(renderInline);
        const component = options.components?.inline?.[inline.name];
        if (component !== undefined) return component(inline, content);
        if (inline.name === "Badge") {
          return h.span([h.Class("fd-badge")], content);
        }
        return h.span(
          [
            h.Class("fd-inline-component"),
            h.DataAttribute("component", inline.name),
          ],
          content,
        );
      }
    }
  };

  const renderTableRow = (row: TableRow, header: boolean): Html =>
    h.tr(
      [],
      row.cells.map((cell) =>
        header
          ? h.th([], cell.content.map(renderInline))
          : h.td([], cell.content.map(renderInline)),
      ),
    );

  const renderBlock = (block: Block): Html => {
    switch (block._tag) {
      case "Heading": {
        const attributes = [
          h.Id(block.id),
          h.Class(`fd-heading fd-h${block.level}`),
        ];
        const content = block.content.map(renderInline);
        const anchor =
          block.level === 1
            ? []
            : [
                h.a(
                  [
                    h.Class("fd-heading-anchor"),
                    h.Href(`#${block.id}`),
                    h.AriaLabel("Link to section"),
                  ],
                  [
                    h.span(
                      [
                        h.Class("fd-icon"),
                        h.AriaHidden(true),
                        h.InnerHTML(icons.link),
                      ],
                      [],
                    ),
                  ],
                ),
              ];
        switch (block.level) {
          case 1:
            return h.h1(attributes, content);
          case 2:
            return h.h2(attributes, [...content, ...anchor]);
          case 3:
            return h.h3(attributes, [...content, ...anchor]);
          case 4:
            return h.h4(attributes, [...content, ...anchor]);
          case 5:
            return h.h5(attributes, [...content, ...anchor]);
          default:
            return h.h6(attributes, [...content, ...anchor]);
        }
      }
      case "Paragraph":
        return h.p([h.Class("fd-paragraph")], block.content.map(renderInline));
      case "CodeBlock":
        return h.div(
          [h.Class("fd-code-block")],
          [
            h.div(
              [h.Class("fd-code-toolbar")],
              [
                h.span(
                  [h.Class("fd-code-language")],
                  [block.language ?? "text"],
                ),
                ...(options.copyCode === undefined
                  ? []
                  : [
                      h.button(
                        [
                          h.Class("fd-code-copy"),
                          h.OnClick(options.copyCode(block.value)),
                          h.AriaLabel(
                            options.copiedCode === block.value
                              ? (options.copiedAriaLabel ?? "Code copied")
                              : (options.copyAriaLabel ?? "Copy code"),
                          ),
                        ],
                        [
                          h.span(
                            [
                              h.Class("fd-icon"),
                              h.InnerHTML(
                                options.copiedCode === block.value
                                  ? icons.check
                                  : icons.copy,
                              ),
                            ],
                            [],
                          ),
                          h.span(
                            [],
                            [
                              options.copiedCode === block.value
                                ? (options.copiedLabel ?? "Copied")
                                : (options.copyLabel ?? "Copy"),
                            ],
                          ),
                        ],
                      ),
                    ]),
              ],
            ),
            block.highlightedHtml === undefined
              ? h.pre([], [h.code([], [block.value])])
              : h.div(
                  [h.Class("fd-shiki"), h.InnerHTML(block.highlightedHtml)],
                  [],
                ),
          ],
        );
      case "List": {
        const items = block.items.map((item) =>
          h.li(
            [h.Class(item.checked === undefined ? "" : "fd-task-item")],
            [
              ...(item.checked === undefined
                ? []
                : [
                    h.span(
                      [h.Class("fd-task-marker")],
                      [item.checked ? "✓" : ""],
                    ),
                  ]),
              ...item.blocks.map(renderBlock),
            ],
          ),
        );
        return block.ordered
          ? h.ol(
              [
                h.Class("fd-list fd-list-ordered"),
                ...(block.start ? [h.Start(block.start)] : []),
              ],
              items,
            )
          : h.ul([h.Class("fd-list")], items);
      }
      case "Blockquote":
        return h.blockquote(
          [h.Class("fd-blockquote")],
          block.blocks.map(renderBlock),
        );
      case "ThematicBreak":
        return h.hr([h.Class("fd-rule")]);
      case "Table":
        return h.div(
          [h.Class("fd-table-wrap")],
          [
            h.table(
              [h.Class("fd-table")],
              [
                h.thead([], [renderTableRow(block.header, true)]),
                h.tbody(
                  [],
                  block.rows.map((row) => renderTableRow(row, false)),
                ),
              ],
            ),
          ],
        );
      case "BlockComponent": {
        const content = block.blocks.map(renderBlock);
        const occurrenceIndex = islandOccurrenceCounts.get(block.name) ?? 0;
        islandOccurrenceCounts.set(block.name, occurrenceIndex + 1);
        const island = options.islands?.[block.name];
        if (island !== undefined)
          return island(block.attributes, content, occurrenceIndex);
        const component = options.components?.block?.[block.name];
        if (component !== undefined) return component(block, content);
        if (block.name === "Callout" || block.name === "Note") {
          return h.aside(
            [
              h.Class(
                `fd-callout fd-callout-${block.attributes.type ?? "info"}`,
              ),
              h.DataAttribute("component", block.name),
            ],
            [
              ...(block.attributes.title === undefined
                ? []
                : [
                    h.strong(
                      [h.Class("fd-callout-title")],
                      [
                        h.span(
                          [
                            h.Class("fd-icon"),
                            h.AriaHidden(true),
                            h.InnerHTML(
                              block.attributes.type === "warning"
                                ? icons.warning
                                : icons.information,
                            ),
                          ],
                          [],
                        ),
                        h.span([], [block.attributes.title]),
                      ],
                    ),
                  ]),
              ...content,
            ],
          );
        }
        if (block.name === "Cards") {
          return h.div([h.Class("fd-cards")], content);
        }
        if (block.name === "Card") {
          const href = block.attributes.href;
          const inner = h.div(
            [h.Class("fd-card-inner")],
            [
              ...(block.attributes.title === undefined
                ? []
                : [h.h3([h.Class("fd-card-title")], [block.attributes.title])]),
              ...content,
            ],
          );
          return href === undefined
            ? h.div([h.Class("fd-card")], [inner])
            : h.a([h.Class("fd-card"), h.Href(href)], [inner]);
        }
        if (block.name === "Steps") {
          return h.div([h.Class("fd-steps")], content);
        }
        return h.div(
          [
            h.Class("fd-block-component"),
            h.DataAttribute("component", block.name),
          ],
          content,
        );
      }
    }
  };

  return h.div([h.Class("fd-prose")], document.blocks.map(renderBlock));
};
