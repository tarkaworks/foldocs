import { type Html, type HtmlBuilder } from 'foldkit/html'
import type {
  Block,
  BlockComponent,
  Inline,
  InlineComponent,
  Document as MdxDocument,
  PackageManager,
  TableRow,
} from 'foldocs-mdx'

import * as FoldkitMarkdown from '@foldkit/markdown'
import type { TocItem } from '@foldocs/content'

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

export interface MarkdownGraphLink {
  readonly url: string
  readonly title: string
  readonly direction: 'outgoing' | 'backlink'
}

export interface MarkdownGraph {
  readonly currentTitle: string
  readonly links: ReadonlyArray<MarkdownGraphLink>
}

export interface MarkdownApiRequest {
  readonly id: string
  readonly url: string
  readonly method: string
  readonly body: string
}

export interface MarkdownApiResponse {
  readonly loading: boolean
  readonly status: string
  readonly body: string
  readonly error: string
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
  /** Selected package manager shared by every package-install block. */
  readonly packageManager?: PackageManager
  readonly selectPackageManager?: (manager: PackageManager) => Message
  /** Selected value keyed by a Tabs component's groupId. */
  readonly selectedTabs?: Readonly<Record<string, string>>
  readonly selectTab?: (
    groupId: string,
    value: string,
    persist: boolean,
    updateAnchor: boolean,
  ) => Message
  /** Current page headings used by the built-in InlineTOC component. */
  readonly toc?: ReadonlyArray<TocItem>
  readonly selectToc?: (id: string) => Message
  readonly openImage?: (url: string, alt: string) => Message
  readonly graph?: MarkdownGraph
  readonly apiRequestUrls?: Readonly<Record<string, string>>
  readonly apiRequestBodies?: Readonly<Record<string, string>>
  readonly apiResponses?: Readonly<Record<string, MarkdownApiResponse>>
  readonly updateApiRequestUrl?: (id: string, value: string) => Message
  readonly updateApiRequestBody?: (id: string, value: string) => Message
  readonly sendApiRequest?: (request: MarkdownApiRequest) => Message
}

const externalUrl = (url: string): boolean => /^(?:https?:)?\/\//iu.test(url)

export const renderMarkdown = <Message>(
  document: MdxDocument,
  options: MarkdownViewOptions<Message> = {},
  h: HtmlBuilder<Message>,
): Html => {
  const islandOccurrenceCounts = new Map<string, number>()
  let packageInstallOccurrence = 0
  const renderInline = (inline: Inline): Html | string => {
    switch (inline._tag) {
      case 'Text':
        return FoldkitMarkdown.defaultViews.Text(inline)
      case 'InlineCode':
        return h.code([h.Class('fd-inline-code')], [inline.value])
      case 'InlineMath':
        return h.span(
          [
            h.Class('fd-math fd-math-inline'),
            h.DataAttribute('source', inline.value),
            h.InnerHTML(inline.html),
          ],
          [],
        )
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
        return options.openImage === undefined
          ? h.img([
              h.Src(inline.url),
              h.Alt(inline.alt),
              h.Class('fd-prose-image'),
              h.Attribute('loading', 'lazy'),
              h.Attribute('decoding', 'async'),
              ...(inline.width === undefined
                ? []
                : [h.Attribute('width', String(inline.width))]),
              ...(inline.height === undefined
                ? []
                : [h.Attribute('height', String(inline.height))]),
              ...(inline.title === undefined ? [] : [h.Title(inline.title)]),
            ])
          : h.button(
              [
                h.Type('button'),
                h.Class('fd-image-zoom-trigger'),
                h.OnClick(options.openImage(inline.url, inline.alt)),
                h.AriaLabel(inline.alt || 'Open image preview'),
              ],
              [
                h.img([
                  h.Src(inline.url),
                  h.Alt(inline.alt),
                  h.Class('fd-prose-image'),
                  h.Attribute('loading', 'lazy'),
                  h.Attribute('decoding', 'async'),
                  ...(inline.width === undefined
                    ? []
                    : [h.Attribute('width', String(inline.width))]),
                  ...(inline.height === undefined
                    ? []
                    : [h.Attribute('height', String(inline.height))]),
                  ...(inline.title === undefined
                    ? []
                    : [h.Title(inline.title)]),
                ]),
              ],
            )
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

  const codeCopyButton = (value: string): Html | undefined =>
    options.copyCode === undefined
      ? undefined
      : h.button(
          [
            h.Type('button'),
            h.Class('fd-code-copy'),
            h.OnClick(options.copyCode(value)),
            h.AriaLabel(
              options.copiedCode === value
                ? (options.copiedAriaLabel ?? 'Code copied')
                : (options.copyAriaLabel ?? 'Copy code'),
            ),
          ],
          [
            h.span(
              [
                h.Class('fd-icon'),
                h.InnerHTML(
                  options.copiedCode === value ? icons.check : icons.copy,
                ),
              ],
              [],
            ),
            h.span(
              [],
              [
                options.copiedCode === value
                  ? (options.copiedLabel ?? 'Copied')
                  : (options.copyLabel ?? 'Copy'),
              ],
            ),
          ],
        )

  const codeBody = (value: string, highlightedHtml?: string): Html =>
    highlightedHtml === undefined
      ? h.pre([], [h.code([], [value])])
      : h.div([h.Class('fd-shiki'), h.InnerHTML(highlightedHtml)], [])

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
      case 'CodeBlock': {
        const copyButton = codeCopyButton(block.value)
        const titleIcon =
          block.title === undefined
            ? undefined
            : navigationIconSvg(block.icon ?? 'code', options.icons)
        return h.div(
          [
            h.Class(
              `fd-code-block${block.title === undefined ? '' : ' fd-code-block-titled'}`,
            ),
          ],
          [
            h.div(
              [h.Class('fd-code-toolbar')],
              [
                ...(block.title === undefined
                  ? [
                      h.span(
                        [h.Class('fd-code-language')],
                        [block.language ?? 'text'],
                      ),
                    ]
                  : [
                      h.span(
                        [h.Class('fd-code-title')],
                        [
                          ...(titleIcon === undefined
                            ? []
                            : [
                                h.span(
                                  [
                                    h.Class('fd-icon'),
                                    h.AriaHidden(true),
                                    h.InnerHTML(titleIcon),
                                  ],
                                  [],
                                ),
                              ]),
                          block.title,
                        ],
                      ),
                    ]),
                ...(copyButton === undefined ? [] : [copyButton]),
              ],
            ),
            codeBody(block.value, block.highlightedHtml),
          ],
        )
      }
      case 'MathBlock':
        return h.div(
          [
            h.Class('fd-math fd-math-display'),
            h.DataAttribute('source', block.value),
            h.InnerHTML(block.html),
          ],
          [],
        )
      case 'Mermaid':
        return h.div(
          [
            h.Class('fd-mermaid'),
            h.DataAttribute('source', encodeURIComponent(block.value)),
            h.DataAttribute('rendered', 'false'),
          ],
          [h.pre([h.Class('fd-mermaid-source')], [h.code([], [block.value])])],
        )
      case 'PackageInstall': {
        const selected =
          block.commands.find(
            command => command.manager === options.packageManager,
          ) ??
          block.commands.find(
            command => command.manager === block.defaultManager,
          ) ??
          block.commands[0]
        if (selected === undefined) return h.empty
        const group = `fd-package-install-${String(packageInstallOccurrence++)}`
        const copyButton = codeCopyButton(selected.value)
        return h.div(
          [
            h.Class('fd-code-block fd-package-install'),
            h.DataAttribute('component', 'PackageInstall'),
            h.DataAttribute('package-manager', selected.manager),
          ],
          [
            h.div(
              [h.Class('fd-code-toolbar fd-package-install-toolbar')],
              [
                h.div(
                  [h.Class('fd-package-install-tabs'), h.Role('tablist')],
                  block.commands.map(command => {
                    const active = command.manager === selected.manager
                    const triggerId = `${group}-${command.manager}-trigger`
                    return h.button(
                      [
                        h.Id(triggerId),
                        h.Type('button'),
                        h.Class(
                          `fd-package-install-trigger${active ? ' fd-package-install-trigger-active' : ''}`,
                        ),
                        h.Role('tab'),
                        h.AriaSelected(active),
                        h.AriaControls(`${group}-panel`),
                        ...(options.selectPackageManager === undefined
                          ? []
                          : [
                              h.OnClick(
                                options.selectPackageManager(command.manager),
                              ),
                            ]),
                      ],
                      [command.manager],
                    )
                  }),
                ),
                ...(copyButton === undefined ? [] : [copyButton]),
              ],
            ),
            h.section(
              [
                h.Id(`${group}-panel`),
                h.Class('fd-package-install-panel'),
                h.Role('tabpanel'),
                h.AriaLabelledBy(`${group}-${selected.manager}-trigger`),
              ],
              [codeBody(selected.value, selected.highlightedHtml)],
            ),
          ],
        )
      }
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
        if (block.name === 'MdxModule') return h.empty
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
        if (block.name === 'InlineTOC') {
          const toc = options.toc ?? []
          return h.nav(
            [h.Class('fd-inline-toc'), h.AriaLabel('Table of contents')],
            [
              ...(block.attributes.title === 'false'
                ? []
                : [
                    h.strong(
                      [h.Class('fd-inline-toc-title')],
                      [block.attributes.label ?? 'On this page'],
                    ),
                  ]),
              h.ul(
                [],
                toc.map(item =>
                  h.keyed('li')(
                    item.id,
                    [h.Class(`fd-inline-toc-depth-${String(item.depth)}`)],
                    [
                      h.a(
                        [
                          h.Href(`#${item.id}`),
                          ...(options.selectToc === undefined
                            ? []
                            : [h.OnClick(options.selectToc(item.id))]),
                        ],
                        [item.title],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          )
        }
        if (block.name === 'TypeTable') {
          const rows = block.blocks.flatMap(candidate =>
            candidate._tag === 'BlockComponent' &&
            candidate.name === 'TypeTableItem'
              ? [candidate]
              : [],
          )
          return h.div(
            [h.Class('fd-type-table-wrap')],
            [
              h.table(
                [h.Class('fd-type-table')],
                [
                  h.thead(
                    [],
                    [
                      h.tr(
                        [],
                        ['Property', 'Type', 'Default', 'Description'].map(
                          label => h.th([], [label]),
                        ),
                      ),
                    ],
                  ),
                  h.tbody(
                    [],
                    rows.map((row, index) =>
                      h.tr(
                        [],
                        [
                          h.td(
                            [],
                            [
                              h.code(
                                [h.Class('fd-inline-code')],
                                [
                                  row.attributes.name ??
                                    row.attributes.property ??
                                    `item-${String(index + 1)}`,
                                ],
                              ),
                            ],
                          ),
                          h.td(
                            [],
                            [
                              h.code(
                                [h.Class('fd-type-value')],
                                [row.attributes.type ?? 'unknown'],
                              ),
                            ],
                          ),
                          h.td(
                            [],
                            [
                              h.code(
                                [h.Class('fd-type-default')],
                                [row.attributes.default ?? '—'],
                              ),
                            ],
                          ),
                          h.td(
                            [],
                            [
                              row.attributes.description ??
                                content[index] ??
                                '—',
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          )
        }
        if (block.name === 'TypeTableItem') return h.empty
        if (block.name === 'ApiPlayground') {
          const id = block.attributes.id ?? `api-${String(occurrenceIndex)}`
          const method = (block.attributes.method ?? 'GET').toUpperCase()
          const url = block.attributes.url ?? ''
          let body = ''
          try {
            body = decodeURIComponent(block.attributes.body ?? '')
          } catch {
            body = block.attributes.body ?? ''
          }
          const requestUrl = options.apiRequestUrls?.[id] ?? url
          const requestBody = options.apiRequestBodies?.[id] ?? body
          const response = options.apiResponses?.[id]
          return h.section(
            [
              h.Class('fd-api-playground'),
              h.DataAttribute('component', 'ApiPlayground'),
            ],
            [
              h.div(
                [h.Class('fd-api-playground-request')],
                [
                  h.span(
                    [
                      h.Class(
                        `fd-api-method fd-api-method-${method.toLowerCase()}`,
                      ),
                    ],
                    [method],
                  ),
                  options.updateApiRequestUrl === undefined
                    ? h.code([h.Class('fd-api-url')], [requestUrl])
                    : h.input([
                        h.Class('fd-api-url-input'),
                        h.Type('url'),
                        h.Value(requestUrl),
                        h.AriaLabel('Request URL'),
                        h.OnInput(value =>
                          options.updateApiRequestUrl!(id, value),
                        ),
                      ]),
                  ...(options.sendApiRequest === undefined
                    ? []
                    : [
                        h.button(
                          [
                            h.Type('button'),
                            h.Class(
                              'fd-control fd-control-outline fd-control-sm',
                            ),
                            h.OnClick(
                              options.sendApiRequest({
                                id,
                                url: requestUrl,
                                method,
                                body: requestBody,
                              }),
                            ),
                            h.Disabled(response?.loading === true),
                          ],
                          [response?.loading === true ? 'Sending…' : 'Send'],
                        ),
                      ]),
                ],
              ),
              ...(body.length === 0 &&
              options.apiRequestBodies?.[id] === undefined
                ? []
                : [
                    h.div(
                      [h.Class('fd-api-playground-body')],
                      [
                        h.strong([], ['Request body']),
                        h.textarea(
                          [
                            h.Value(requestBody),
                            h.AriaLabel('Request body'),
                            ...(options.updateApiRequestBody === undefined
                              ? [h.Attribute('readonly', '')]
                              : [
                                  h.OnInput(value =>
                                    options.updateApiRequestBody!(id, value),
                                  ),
                                ]),
                            h.Attribute('rows', '8'),
                          ],
                          [],
                        ),
                      ],
                    ),
                  ]),
              ...(response === undefined
                ? []
                : [
                    h.div(
                      [
                        h.Class('fd-api-playground-response'),
                        h.AriaLive('polite'),
                      ],
                      [
                        h.strong(
                          [],
                          [
                            response.error.length > 0
                              ? 'Request failed'
                              : `Response${response.status.length === 0 ? '' : ` · ${response.status}`}`,
                          ],
                        ),
                        ...(response.error.length > 0
                          ? [h.p([h.Class('fd-api-error')], [response.error])]
                          : response.body.length === 0
                            ? []
                            : [h.pre([], [h.code([], [response.body])])]),
                      ],
                    ),
                  ]),
            ],
          )
        }
        if (block.name === 'AsyncApiPlayground') {
          let payload = ''
          try {
            payload = decodeURIComponent(block.attributes.payload ?? '')
          } catch {
            payload = block.attributes.payload ?? ''
          }
          const copyButton = codeCopyButton(payload)
          return h.section(
            [
              h.Class('fd-api-playground fd-asyncapi-playground'),
              h.DataAttribute('component', 'AsyncApiPlayground'),
            ],
            [
              h.div(
                [h.Class('fd-api-playground-request')],
                [
                  h.span(
                    [h.Class('fd-api-method')],
                    [(block.attributes.action ?? 'send').toUpperCase()],
                  ),
                  h.code(
                    [h.Class('fd-api-url')],
                    [block.attributes.channel ?? 'channel'],
                  ),
                  ...(copyButton === undefined ? [] : [copyButton]),
                ],
              ),
              ...(payload.length === 0
                ? []
                : [h.pre([], [h.code([], [payload])])]),
            ],
          )
        }
        if (block.name === 'Video') {
          const src = block.attributes.src
          if (src === undefined) return h.empty
          return h.video(
            [
              h.Class('fd-media fd-video'),
              h.Src(src),
              h.Attribute('controls', ''),
              h.Attribute('preload', block.attributes.preload ?? 'metadata'),
              ...(block.attributes.poster === undefined
                ? []
                : [h.Attribute('poster', block.attributes.poster)]),
              ...(block.attributes.title === undefined
                ? []
                : [h.Title(block.attributes.title)]),
            ],
            content,
          )
        }
        if (block.name === 'Audio') {
          const src = block.attributes.src
          if (src === undefined) return h.empty
          return h.audio(
            [
              h.Class('fd-media fd-audio'),
              h.Src(src),
              h.Attribute('controls', ''),
              h.Attribute('preload', block.attributes.preload ?? 'metadata'),
            ],
            content,
          )
        }
        if (block.name === 'Embed') {
          const src = block.attributes.src
          if (src === undefined || !/^https:\/\//iu.test(src)) return h.empty
          return h.iframe(
            [
              h.Class('fd-media fd-embed'),
              h.Src(src),
              h.Title(block.attributes.title ?? 'Embedded media'),
              h.Attribute('loading', 'lazy'),
              h.Attribute('allowfullscreen', ''),
              h.Attribute(
                'sandbox',
                block.attributes.sandbox ??
                  'allow-scripts allow-same-origin allow-presentation',
              ),
            ],
            [],
          )
        }
        if (block.name === 'GraphView') {
          const graph = options.graph
          if (graph === undefined) return h.empty
          return h.figure(
            [
              h.Class('fd-graph-view'),
              h.DataAttribute('component', 'GraphView'),
            ],
            [
              h.figcaption([h.Class('fd-graph-title')], [graph.currentTitle]),
              h.ul(
                [h.Class('fd-graph-links')],
                graph.links.map(link =>
                  h.li(
                    [h.Class(`fd-graph-link fd-graph-link-${link.direction}`)],
                    [
                      h.a([h.Href(link.url)], [link.title]),
                      h.span(
                        [h.Class('fd-graph-direction')],
                        [
                          link.direction === 'outgoing'
                            ? 'Referenced page'
                            : 'Links here',
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          )
        }
        if (block.name === 'GithubInfo') {
          const owner = block.attributes.owner
          const repository =
            block.attributes.repo ?? block.attributes.repository
          if (owner === undefined || repository === undefined) return h.empty
          const url = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`
          return h.a(
            [
              h.Class('fd-github-info'),
              h.Href(url),
              h.Target('_blank'),
              h.Rel('noreferrer noopener'),
              h.DataAttribute('component', 'GithubInfo'),
            ],
            [
              h.span(
                [
                  h.Class('fd-icon'),
                  h.AriaHidden(true),
                  h.InnerHTML(icons.github),
                ],
                [],
              ),
              h.span(
                [h.Class('fd-github-repository')],
                [`${owner}/${repository}`],
              ),
              h.img([
                h.Class('fd-github-stars'),
                h.Src(
                  `https://img.shields.io/github/stars/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}?style=flat&label=stars`,
                ),
                h.Alt(`GitHub stars for ${owner}/${repository}`),
                h.Attribute('loading', 'lazy'),
              ]),
            ],
          )
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
                value:
                  candidate.attributes.value ??
                  candidate.attributes.title ??
                  String(index),
                content: content[index] ?? h.empty,
              },
            ]
          })
          if (tabs.length === 0) return h.div([h.Class('fd-tabs')], content)
          const groupId =
            block.attributes.groupId ??
            block.attributes.group ??
            `page-${String(occurrenceIndex)}`
          const group = `fd-tabs-${groupId.replace(/[^a-z0-9_-]+/giu, '-')}-${String(occurrenceIndex)}`
          const defaultIndex = Math.max(
            0,
            Math.min(
              tabs.length - 1,
              Number.parseInt(block.attributes.defaultIndex ?? '0', 10) || 0,
            ),
          )
          const selectedValue =
            options.selectedTabs?.[groupId] ?? tabs[defaultIndex]?.value
          const persist = block.attributes.persist === 'true'
          const updateAnchor = block.attributes.updateAnchor === 'true'
          return h.div(
            [
              h.Class('fd-tabs'),
              h.DataAttribute('component', 'Tabs'),
              h.DataAttribute('group-id', groupId),
            ],
            [
              h.div(
                [h.Class('fd-tabs-list'), h.Role('tablist')],
                tabs.map((tab, index) =>
                  h.button(
                    [
                      h.Id(`${group}-${String(index)}-trigger`),
                      h.Type('button'),
                      h.Class('fd-tab-trigger'),
                      h.Role('tab'),
                      h.AriaControls(`${group}-${String(index)}-panel`),
                      h.AriaSelected(tab.value === selectedValue),
                      h.Tabindex(tab.value === selectedValue ? 0 : -1),
                      ...(options.selectTab === undefined
                        ? []
                        : [
                            h.OnClick(
                              options.selectTab(
                                groupId,
                                tab.value,
                                persist,
                                updateAnchor,
                              ),
                            ),
                          ]),
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
                      ...(tab.value === selectedValue
                        ? []
                        : [h.Attribute('hidden', '')]),
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
        if (block.name === 'Story') {
          const variants = block.blocks.flatMap((candidate, index) => {
            if (
              candidate._tag !== 'BlockComponent' ||
              candidate.name !== 'StoryVariant'
            )
              return []
            const title =
              candidate.attributes.title ??
              candidate.attributes.name ??
              `Variant ${String(index + 1)}`
            return [
              {
                title,
                value: candidate.attributes.value ?? title,
                content: content[index] ?? h.empty,
              },
            ]
          })
          if (variants.length === 0)
            return h.div([h.Class('fd-story')], content)
          const groupId =
            block.attributes.groupId ??
            `story-${block.attributes.id ?? String(occurrenceIndex)}`
          const selected = options.selectedTabs?.[groupId] ?? variants[0]!.value
          return h.section(
            [h.Class('fd-story'), h.DataAttribute('component', 'Story')],
            [
              h.div(
                [h.Class('fd-story-toolbar'), h.Role('tablist')],
                variants.map((variant, index) =>
                  h.button(
                    [
                      h.Type('button'),
                      h.Id(`${groupId}-${String(index)}-trigger`),
                      h.Class('fd-story-variant-trigger'),
                      h.Role('tab'),
                      h.AriaSelected(variant.value === selected),
                      h.AriaControls(`${groupId}-${String(index)}-panel`),
                      ...(options.selectTab === undefined
                        ? []
                        : [
                            h.OnClick(
                              options.selectTab(
                                groupId,
                                variant.value,
                                block.attributes.persist === 'true',
                                false,
                              ),
                            ),
                          ]),
                    ],
                    [variant.title],
                  ),
                ),
              ),
              ...variants.map((variant, index) =>
                h.div(
                  [
                    h.Id(`${groupId}-${String(index)}-panel`),
                    h.Class('fd-story-stage'),
                    h.Role('tabpanel'),
                    h.AriaLabelledBy(`${groupId}-${String(index)}-trigger`),
                    ...(variant.value === selected
                      ? []
                      : [h.Attribute('hidden', '')]),
                  ],
                  [variant.content],
                ),
              ),
            ],
          )
        }
        if (block.name === 'StoryVariant')
          return h.div([h.Class('fd-story-variant')], content)
        if (block.name === 'StoryControl') {
          return h.label(
            [h.Class('fd-story-control')],
            [
              h.span(
                [],
                [block.attributes.label ?? block.attributes.name ?? 'Property'],
              ),
              h.output([], [block.attributes.value ?? '']),
            ],
          )
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
