import { type Html, type HtmlBuilder } from 'foldkit/html'
import type {
  Block,
  BlockComponent,
  Inline,
  InlineComponent,
  Document as MdxDocument,
  TableRow,
} from 'foldocs-mdx'

import * as FoldkitMarkdown from '@foldkit/markdown'

import { icons, navigationIconSvg } from './icons.js'

export type InlineComponentView = (
  component: InlineComponent,
  content: ReadonlyArray<Html | string>,
) => Html

export type BlockComponentView = (
  component: BlockComponent,
  content: ReadonlyArray<Html>,
) => Html

export interface MdxComponents {
  readonly inline?: Readonly<Record<string, InlineComponentView>>
  readonly block?: Readonly<Record<string, BlockComponentView>>
}

export type MarkdownIslands = FoldkitMarkdown.Islands

export interface MarkdownViewOptions<Message> {
  /** Typed directive views produced by @foldkit/markdown `islandsFor`. */
  readonly islands?: MarkdownIslands
  readonly components?: MdxComponents
  /** Project SVG overrides used by default components such as Card. */
  readonly icons?: Readonly<Record<string, string>>
  readonly copiedCode?: string
  readonly copyCode?: (value: string) => Message
  readonly copyLabel?: string
  readonly copiedLabel?: string
  readonly copyAriaLabel?: string
  readonly copiedAriaLabel?: string
}

const externalUrl = (url: string): boolean => /^(?:https?:)?\/\//iu.test(url)

export const renderMarkdown = <Message>(
  document: MdxDocument,
  options: MarkdownViewOptions<Message> = {},
  h: HtmlBuilder<Message>,
): Html => {
  const islandOccurrenceCounts = new Map<string, number>()
  const renderInline = (inline: Inline): Html | string => {
    switch (inline._tag) {
      case 'Text':
        return FoldkitMarkdown.defaultViews.Text(inline)
      case 'InlineCode':
        return h.code([h.Class('fd-inline-code')], [inline.value])
      case 'HardBreak':
        return FoldkitMarkdown.defaultViews.HardBreak(inline)
      case 'Emphasis':
        return FoldkitMarkdown.defaultViews.Emphasis(
          { _tag: 'Emphasis', content: [] },
          inline.content.map(renderInline),
        )
      case 'Strong':
        return FoldkitMarkdown.defaultViews.Strong(
          { _tag: 'Strong', content: [] },
          inline.content.map(renderInline),
        )
      case 'Strikethrough':
        return FoldkitMarkdown.defaultViews.Strikethrough(
          { _tag: 'Strikethrough', content: [] },
          inline.content.map(renderInline),
        )
      case 'Link':
        return h.a(
          [
            h.Href(inline.url),
            h.Class('fd-prose-link'),
            ...(inline.title === undefined ? [] : [h.Title(inline.title)]),
            ...(externalUrl(inline.url)
              ? [h.Target('_blank'), h.Rel('noreferrer noopener')]
              : []),
          ],
          inline.content.map(renderInline),
        )
      case 'Image':
        return h.img([
          h.Src(inline.url),
          h.Alt(inline.alt),
          h.Class('fd-prose-image'),
          ...(inline.title === undefined ? [] : [h.Title(inline.title)]),
        ])
      case 'InlineComponent': {
        const content = inline.content.map(renderInline)
        const component = options.components?.inline?.[inline.name]
        if (component !== undefined) return component(inline, content)
        if (inline.name === 'Badge') {
          return h.span([h.Class('fd-badge')], content)
        }
        return h.span(
          [
            h.Class('fd-inline-component'),
            h.DataAttribute('component', inline.name),
          ],
          content,
        )
      }
    }
  }

  const renderTableRow = (row: TableRow, header: boolean): Html =>
    h.tr(
      [],
      row.cells.map(cell =>
        header
          ? h.th([], cell.content.map(renderInline))
          : h.td([], cell.content.map(renderInline)),
      ),
    )

  const renderBlock = (block: Block): Html => {
    switch (block._tag) {
      case 'Heading': {
        const attributes = [
          h.Id(block.id),
          h.Class(`fd-heading fd-h${block.level}`),
        ]
        const content = block.content.map(renderInline)
        const anchor =
          block.level === 1
            ? []
            : [
                h.a(
                  [
                    h.Class('fd-heading-anchor'),
                    h.Href(`#${block.id}`),
                    h.AriaLabel('Link to section'),
                  ],
                  [
                    h.span(
                      [
                        h.Class('fd-icon'),
                        h.AriaHidden(true),
                        h.InnerHTML(icons.link),
                      ],
                      [],
                    ),
                  ],
                ),
              ]
        switch (block.level) {
          case 1:
            return h.h1(attributes, content)
          case 2:
            return h.h2(attributes, [...content, ...anchor])
          case 3:
            return h.h3(attributes, [...content, ...anchor])
          case 4:
            return h.h4(attributes, [...content, ...anchor])
          case 5:
            return h.h5(attributes, [...content, ...anchor])
          default:
            return h.h6(attributes, [...content, ...anchor])
        }
      }
      case 'Paragraph':
        return h.p([h.Class('fd-paragraph')], block.content.map(renderInline))
      case 'CodeBlock':
        return h.div(
          [h.Class('fd-code-block')],
          [
            h.div(
              [h.Class('fd-code-toolbar')],
              [
                h.span(
                  [h.Class('fd-code-language')],
                  [block.language ?? 'text'],
                ),
                ...(options.copyCode === undefined
                  ? []
                  : [
                      h.button(
                        [
                          h.Class('fd-code-copy'),
                          h.OnClick(options.copyCode(block.value)),
                          h.AriaLabel(
                            options.copiedCode === block.value
                              ? (options.copiedAriaLabel ?? 'Code copied')
                              : (options.copyAriaLabel ?? 'Copy code'),
                          ),
                        ],
                        [
                          h.span(
                            [
                              h.Class('fd-icon'),
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
                                ? (options.copiedLabel ?? 'Copied')
                                : (options.copyLabel ?? 'Copy'),
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
                  [h.Class('fd-shiki'), h.InnerHTML(block.highlightedHtml)],
                  [],
                ),
          ],
        )
      case 'List': {
        const items = block.items.map(item =>
          h.li(
            [h.Class(item.checked === undefined ? '' : 'fd-task-item')],
            [
              ...(item.checked === undefined
                ? []
                : [
                    h.span(
                      [h.Class('fd-task-marker')],
                      [item.checked ? '✓' : ''],
                    ),
                  ]),
              ...item.blocks.map(renderBlock),
            ],
          ),
        )
        return block.ordered
          ? h.ol(
              [
                h.Class('fd-list fd-list-ordered'),
                ...(block.start ? [h.Start(block.start)] : []),
              ],
              items,
            )
          : h.ul([h.Class('fd-list')], items)
      }
      case 'Blockquote':
        return h.blockquote(
          [h.Class('fd-blockquote')],
          block.blocks.map(renderBlock),
        )
      case 'ThematicBreak':
        return h.hr([h.Class('fd-rule')])
      case 'Table':
        return h.div(
          [h.Class('fd-table-wrap')],
          [
            h.table(
              [h.Class('fd-table')],
              [
                h.thead([], [renderTableRow(block.header, true)]),
                h.tbody(
                  [],
                  block.rows.map(row => renderTableRow(row, false)),
                ),
              ],
            ),
          ],
        )
      case 'BlockComponent': {
        const content = block.blocks.map(renderBlock)
        const occurrenceIndex = islandOccurrenceCounts.get(block.name) ?? 0
        islandOccurrenceCounts.set(block.name, occurrenceIndex + 1)
        const island = options.islands?.[block.name]
        if (island !== undefined)
          return island(block.attributes, content, occurrenceIndex)
        const component = options.components?.block?.[block.name]
        if (component !== undefined) return component(block, content)
        if (block.name === 'Callout' || block.name === 'Note') {
          const inputType = block.attributes.type ?? 'info'
          const type =
            inputType === 'warn'
              ? 'warning'
              : inputType === 'tip'
                ? 'info'
                : inputType
          const calloutIcon =
            type === 'warning'
              ? icons.warning
              : type === 'error'
                ? icons.error
                : type === 'success'
                  ? icons.success
                  : type === 'idea'
                    ? icons.idea
                    : icons.information
          return h.aside(
            [
              h.Class(`fd-callout fd-callout-${type}`),
              h.DataAttribute('component', block.name),
            ],
            [
              h.span([h.Class('fd-callout-strand'), h.AriaHidden(true)], []),
              h.span(
                [
                  h.Class('fd-callout-icon fd-icon'),
                  h.AriaHidden(true),
                  h.InnerHTML(calloutIcon),
                ],
                [],
              ),
              h.div(
                [h.Class('fd-callout-content')],
                [
                  ...(block.attributes.title === undefined
                    ? []
                    : [
                        h.strong(
                          [h.Class('fd-callout-title')],
                          [block.attributes.title],
                        ),
                      ]),
                  ...content,
                ],
              ),
            ],
          )
        }
        if (block.name === 'Cards') {
          return h.div([h.Class('fd-cards')], content)
        }
        if (block.name === 'Card') {
          const href = block.attributes.href
          const cardIcon =
            block.attributes.icon === undefined
              ? undefined
              : navigationIconSvg(block.attributes.icon, options.icons)
          const inner = h.div(
            [h.Class('fd-card-inner')],
            [
              ...(cardIcon === undefined
                ? []
                : [
                    h.span(
                      [
                        h.Class('fd-card-icon fd-icon'),
                        h.AriaHidden(true),
                        h.InnerHTML(cardIcon),
                      ],
                      [],
                    ),
                  ]),
              ...(block.attributes.title === undefined
                ? []
                : [h.h3([h.Class('fd-card-title')], [block.attributes.title])]),
              ...(block.attributes.description === undefined
                ? []
                : [
                    h.p(
                      [h.Class('fd-card-description')],
                      [block.attributes.description],
                    ),
                  ]),
              ...content,
            ],
          )
          return href === undefined
            ? h.div([h.Class('fd-card')], [inner])
            : h.a([h.Class('fd-card'), h.Href(href)], [inner])
        }
        if (block.name === 'Steps') {
          return h.div([h.Class('fd-steps')], content)
        }
        if (block.name === 'Step') {
          return h.div([h.Class('fd-step')], content)
        }
        if (block.name === 'Tabs') {
          const tabs = block.blocks.flatMap((candidate, index) => {
            if (candidate._tag !== 'BlockComponent' || candidate.name !== 'Tab')
              return []
            return [
              {
                title:
                  candidate.attributes.title ??
                  candidate.attributes.value ??
                  `Tab ${String(index + 1)}`,
                content: content[index] ?? h.empty,
              },
            ]
          })
          if (tabs.length === 0) return h.div([h.Class('fd-tabs')], content)
          const group = `fd-tabs-${String(occurrenceIndex)}`
          return h.div(
            [h.Class('fd-tabs'), h.DataAttribute('component', 'Tabs')],
            [
              ...tabs.map((_, index) =>
                h.input([
                  h.Id(`${group}-${String(index)}`),
                  h.Class('fd-tab-input'),
                  h.Type('radio'),
                  h.Attribute('name', group),
                  h.Value(String(index)),
                  ...(index === 0 ? [h.Attribute('checked', '')] : []),
                ]),
              ),
              h.div(
                [h.Class('fd-tabs-list'), h.Role('tablist')],
                tabs.map((tab, index) =>
                  h.label(
                    [
                      h.Id(`${group}-${String(index)}-trigger`),
                      h.Class('fd-tab-trigger'),
                      h.Attribute('for', `${group}-${String(index)}`),
                      h.Role('tab'),
                      h.AriaControls(`${group}-${String(index)}-panel`),
                    ],
                    [tab.title],
                  ),
                ),
              ),
              h.div(
                [h.Class('fd-tabs-panels')],
                tabs.map((tab, index) =>
                  h.section(
                    [
                      h.Id(`${group}-${String(index)}-panel`),
                      h.Class('fd-tab-panel'),
                      h.Role('tabpanel'),
                      h.AriaLabelledBy(`${group}-${String(index)}-trigger`),
                    ],
                    [tab.content],
                  ),
                ),
              ),
            ],
          )
        }
        if (block.name === 'Tab') {
          return h.div([h.Class('fd-tab-content')], content)
        }
        if (block.name === 'Accordions') {
          return h.div([h.Class('fd-accordions')], content)
        }
        if (block.name === 'Accordion') {
          const title = block.attributes.title ?? 'Details'
          return h.details(
            [
              h.Class('fd-accordion'),
              ...(block.attributes.id === undefined
                ? []
                : [h.Id(block.attributes.id)]),
              h.Open(block.attributes.defaultOpen === 'true'),
            ],
            [
              h.summary(
                [h.Class('fd-accordion-trigger')],
                [
                  h.span([], [title]),
                  h.span(
                    [
                      h.Class('fd-accordion-chevron fd-icon'),
                      h.AriaHidden(true),
                      h.InnerHTML(icons.chevron),
                    ],
                    [],
                  ),
                ],
              ),
              h.div([h.Class('fd-accordion-content')], content),
            ],
          )
        }
        if (block.name === 'Files') {
          return h.div([h.Class('fd-files')], content)
        }
        if (block.name === 'File') {
          return h.div(
            [h.Class('fd-file')],
            [
              h.span(
                [
                  h.Class('fd-file-icon fd-icon'),
                  h.AriaHidden(true),
                  h.InnerHTML(
                    navigationIconSvg(
                      block.attributes.icon ?? 'file-text',
                      options.icons,
                    ) ?? icons.markdown,
                  ),
                ],
                [],
              ),
              h.span([], [block.attributes.name ?? 'File']),
              ...content,
            ],
          )
        }
        if (block.name === 'Folder') {
          return h.details(
            [
              h.Class('fd-file-folder'),
              h.Open(block.attributes.defaultOpen === 'true'),
            ],
            [
              h.summary(
                [h.Class('fd-file')],
                [
                  h.span(
                    [h.Class('fd-file-folder-icons'), h.AriaHidden(true)],
                    [
                      h.span(
                        [
                          h.Class('fd-file-folder-closed fd-icon'),
                          h.InnerHTML(
                            navigationIconSvg('folder', options.icons) ??
                              icons.markdown,
                          ),
                        ],
                        [],
                      ),
                      h.span(
                        [
                          h.Class('fd-file-folder-open fd-icon'),
                          h.InnerHTML(
                            navigationIconSvg('folder-open', options.icons) ??
                              icons.markdown,
                          ),
                        ],
                        [],
                      ),
                    ],
                  ),
                  h.span([], [block.attributes.name ?? 'Folder']),
                ],
              ),
              h.div([h.Class('fd-file-folder-content')], content),
            ],
          )
        }
        return h.div(
          [
            h.Class('fd-block-component'),
            h.DataAttribute('component', block.name),
          ],
          content,
        )
      }
    }
  }

  return h.div([h.Class('fd-prose')], document.blocks.map(renderBlock))
}
