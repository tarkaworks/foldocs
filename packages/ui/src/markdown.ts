import type {
  Block,
  BlockComponent,
  Document as MdxDocument,
  Inline,
  InlineComponent,
  TableRow,
} from "effectdocs-mdx";
import { type Html, html } from "foldkit/html";

export type InlineComponentView<Message> = (
  component: InlineComponent,
  content: ReadonlyArray<Html | string>,
) => Html;

export type BlockComponentView<Message> = (
  component: BlockComponent,
  content: ReadonlyArray<Html>,
) => Html;

export interface MdxComponents<Message> {
  readonly inline?: Readonly<Record<string, InlineComponentView<Message>>>;
  readonly block?: Readonly<Record<string, BlockComponentView<Message>>>;
}

export interface MarkdownViewOptions<Message> {
  readonly components?: MdxComponents<Message>;
  readonly copiedCode?: string;
  readonly copyCode?: (value: string) => Message;
}

const copyIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg>';
const copiedIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>';

const externalUrl = (url: string): boolean => /^(?:https?:)?\/\//iu.test(url);

export const renderMarkdown = <Message>(
  document: MdxDocument,
  options: MarkdownViewOptions<Message> = {},
): Html => {
  const h = html<Message>();

  const renderInline = (inline: Inline): Html | string => {
    switch (inline._tag) {
      case "Text":
        return inline.value;
      case "InlineCode":
        return h.code([h.Class("ed-inline-code")], [inline.value]);
      case "HardBreak":
        return h.br([]);
      case "Emphasis":
        return h.em([], inline.content.map(renderInline));
      case "Strong":
        return h.strong([], inline.content.map(renderInline));
      case "Strikethrough":
        return h.del([], inline.content.map(renderInline));
      case "Link":
        return h.a(
          [
            h.Href(inline.url),
            h.Class("ed-prose-link"),
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
          h.Class("ed-prose-image"),
          ...(inline.title === undefined ? [] : [h.Title(inline.title)]),
        ]);
      case "InlineComponent": {
        const content = inline.content.map(renderInline);
        const component = options.components?.inline?.[inline.name];
        if (component !== undefined) return component(inline, content);
        if (inline.name === "Badge") {
          return h.span([h.Class("ed-badge")], content);
        }
        return h.span(
          [
            h.Class("ed-inline-component"),
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
          h.Class(`ed-heading ed-h${block.level}`),
        ];
        const content = block.content.map(renderInline);
        switch (block.level) {
          case 1:
            return h.h1(attributes, content);
          case 2:
            return h.h2(attributes, content);
          case 3:
            return h.h3(attributes, content);
          case 4:
            return h.h4(attributes, content);
          case 5:
            return h.h5(attributes, content);
          default:
            return h.h6(attributes, content);
        }
      }
      case "Paragraph":
        return h.p([h.Class("ed-paragraph")], block.content.map(renderInline));
      case "CodeBlock":
        return h.div(
          [h.Class("ed-code-block")],
          [
            h.div(
              [h.Class("ed-code-toolbar")],
              [
                h.span(
                  [h.Class("ed-code-language")],
                  [block.language ?? "text"],
                ),
                ...(options.copyCode === undefined
                  ? []
                  : [
                      h.button(
                        [
                          h.Class("ed-code-copy"),
                          h.OnClick(options.copyCode(block.value)),
                          h.AriaLabel(
                            options.copiedCode === block.value
                              ? "Code copied"
                              : "Copy code",
                          ),
                        ],
                        [
                          h.span(
                            [
                              h.Class("ed-icon"),
                              h.InnerHTML(
                                options.copiedCode === block.value
                                  ? copiedIcon
                                  : copyIcon,
                              ),
                            ],
                            [],
                          ),
                          h.span(
                            [],
                            [
                              options.copiedCode === block.value
                                ? "Copied"
                                : "Copy",
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
                  [h.Class("ed-shiki"), h.InnerHTML(block.highlightedHtml)],
                  [],
                ),
          ],
        );
      case "List": {
        const items = block.items.map((item) =>
          h.li(
            [h.Class(item.checked === undefined ? "" : "ed-task-item")],
            [
              ...(item.checked === undefined
                ? []
                : [
                    h.span(
                      [h.Class("ed-task-marker")],
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
                h.Class("ed-list ed-list-ordered"),
                ...(block.start ? [h.Start(block.start)] : []),
              ],
              items,
            )
          : h.ul([h.Class("ed-list")], items);
      }
      case "Blockquote":
        return h.blockquote(
          [h.Class("ed-blockquote")],
          block.blocks.map(renderBlock),
        );
      case "ThematicBreak":
        return h.hr([h.Class("ed-rule")]);
      case "Table":
        return h.div(
          [h.Class("ed-table-wrap")],
          [
            h.table(
              [h.Class("ed-table")],
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
        const component = options.components?.block?.[block.name];
        if (component !== undefined) return component(block, content);
        if (block.name === "Callout" || block.name === "Note") {
          return h.aside(
            [
              h.Class(
                `ed-callout ed-callout-${block.attributes.type ?? "info"}`,
              ),
              h.DataAttribute("component", block.name),
            ],
            [
              ...(block.attributes.title === undefined
                ? []
                : [
                    h.strong(
                      [h.Class("ed-callout-title")],
                      [block.attributes.title],
                    ),
                  ]),
              ...content,
            ],
          );
        }
        if (block.name === "Cards") {
          return h.div([h.Class("ed-cards")], content);
        }
        if (block.name === "Card") {
          const href = block.attributes.href;
          const inner = h.div(
            [h.Class("ed-card-inner")],
            [
              ...(block.attributes.title === undefined
                ? []
                : [h.h3([h.Class("ed-card-title")], [block.attributes.title])]),
              ...content,
            ],
          );
          return href === undefined
            ? h.div([h.Class("ed-card")], [inner])
            : h.a([h.Class("ed-card"), h.Href(href)], [inner]);
        }
        if (block.name === "Steps") {
          return h.div([h.Class("ed-steps")], content);
        }
        return h.div(
          [
            h.Class("ed-block-component"),
            h.DataAttribute("component", block.name),
          ],
          content,
        );
      }
    }
  };

  return h.div([h.Class("ed-prose")], document.blocks.map(renderBlock));
};
