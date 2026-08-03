import { Option, Schema as S } from 'effect'
import { type HtmlBuilder, inertHtml as h } from 'foldkit/html'
import { Scene } from 'foldkit/test'
import type { Block } from 'foldocs-mdx'
import { describe, expect, it } from 'vitest'

import { islandsFor } from '@foldkit/markdown'

import { type MdxComponents, renderMarkdown } from '../src/markdown.js'

describe('custom MDX components', () => {
  it('renders package-install commands with a shared selected manager', () => {
    const rendered = renderMarkdown(
      {
        blocks: [
          {
            _tag: 'PackageInstall',
            source: 'foldocs foldkit effect',
            sourceLanguage: 'package-install',
            defaultManager: 'npm',
            commands: [
              {
                manager: 'npm',
                value: 'npm install foldocs foldkit effect',
              },
              {
                manager: 'pnpm',
                value: 'pnpm add foldocs foldkit effect',
              },
              {
                manager: 'yarn',
                value: 'yarn add foldocs foldkit effect',
              },
              {
                manager: 'bun',
                value: 'bun add foldocs foldkit effect',
              },
            ],
          },
        ],
      },
      {
        packageManager: 'pnpm',
      },
      h,
    )

    expect(rendered).not.toBeNull()
    if (rendered === null) return
    expect(Option.isSome(Scene.find(rendered, '.fd-package-install'))).toBe(
      true,
    )
    const active = Scene.find(rendered, '.fd-package-install-trigger-active')
    expect(Option.isSome(active)).toBe(true)
    if (Option.isSome(active))
      expect(Scene.textContent(active.value)).toBe('pnpm')
    expect(Scene.textContent(rendered)).toContain(
      'pnpm add foldocs foldkit effect',
    )
    expect(Scene.textContent(rendered)).not.toContain(
      'npm install foldocs foldkit effect',
    )
  })

  it('renders the Fumadocs-compatible default component set', () => {
    const paragraph = (value: string): Block => ({
      _tag: 'Paragraph' as const,
      content: [{ _tag: 'Text' as const, value }],
    })
    const component = (
      name: string,
      attributes: Readonly<Record<string, string>>,
      blocks: ReadonlyArray<Block>,
    ): Block => ({
      _tag: 'BlockComponent' as const,
      name,
      attributes,
      blocks,
    })
    const rendered = renderMarkdown(
      {
        blocks: [
          component('Callout', { type: 'success', title: 'Ready' }, [
            paragraph('The build passed.'),
          ]),
          component('Cards', {}, [
            component(
              'Card',
              {
                title: 'UI',
                description: 'Default components',
                icon: 'blocks',
                href: '/docs/ui',
              },
              [],
            ),
          ]),
          component('Steps', {}, [
            component('Step', {}, [paragraph('Create the project.')]),
          ]),
          component('Tabs', {}, [
            component('Tab', { title: 'pnpm' }, [paragraph('pnpm add')]),
            component('Tab', { title: 'npm' }, [paragraph('npm install')]),
          ]),
          component('Accordions', {}, [
            component('Accordion', { title: 'Details' }, [
              paragraph('More information.'),
            ]),
          ]),
          component('Files', {}, [
            component('Folder', { name: 'content', defaultOpen: 'true' }, [
              component('File', { name: 'index.mdx' }, []),
            ]),
          ]),
        ],
      },
      {},
      h,
    )

    expect(rendered).not.toBeNull()
    if (rendered === null) return
    for (const selector of [
      '.fd-callout-strand',
      '.fd-card-icon',
      '.fd-step',
      '.fd-tab-trigger',
      '.fd-accordion',
      '.fd-file-folder',
    ]) {
      expect(Option.isSome(Scene.find(rendered, selector))).toBe(true)
    }
    expect(Scene.textContent(rendered)).toContain('The build passed.')
    expect(Scene.textContent(rendered)).toContain('pnpm add')
    expect(Scene.textContent(rendered)).toContain('index.mdx')
  })

  it('renders typed @foldkit/markdown islands with occurrence indexes', () => {
    const islands = islandsFor(
      { Feature: S.Struct({ kind: S.Literal('primary') }) },
      {
        Feature: (attributes, content, occurrenceIndex) =>
          h.section(
            [
              h.Class('typed-feature'),
              h.DataAttribute('kind', attributes.kind),
              h.DataAttribute('occurrence', String(occurrenceIndex)),
            ],
            content,
          ),
      },
    )
    const rendered = renderMarkdown(
      {
        blocks: [
          {
            _tag: 'BlockComponent',
            name: 'Feature',
            attributes: { kind: 'primary' },
            blocks: [],
          },
          {
            _tag: 'BlockComponent',
            name: 'Feature',
            attributes: { kind: 'primary' },
            blocks: [],
          },
        ],
      },
      { islands },
      h,
    )

    expect(rendered).not.toBeNull()
    if (rendered === null) return
    expect(Option.isSome(Scene.find(rendered, '[data-occurrence="0"]'))).toBe(
      true,
    )
    expect(Option.isSome(Scene.find(rendered, '[data-occurrence="1"]'))).toBe(
      true,
    )
  })

  it('renders math, Mermaid, inline TOC, and type tables', () => {
    const rendered = renderMarkdown(
      {
        blocks: [
          { _tag: 'MathBlock', value: 'x^2', html: '<span>x²</span>' },
          { _tag: 'Mermaid', value: 'flowchart LR\nA --> B' },
          {
            _tag: 'BlockComponent',
            name: 'InlineTOC',
            attributes: {},
            blocks: [],
          },
          {
            _tag: 'BlockComponent',
            name: 'TypeTable',
            attributes: {},
            blocks: [
              {
                _tag: 'BlockComponent',
                name: 'TypeTableItem',
                attributes: {
                  name: 'title',
                  type: 'string',
                  description: 'Page title',
                },
                blocks: [],
              },
            ],
          },
        ],
      },
      { toc: [{ id: 'usage', title: 'Usage', depth: 2 }] },
      h,
    )

    expect(rendered).not.toBeNull()
    if (rendered === null) return
    for (const selector of [
      '.fd-math-display',
      '.fd-mermaid',
      '.fd-inline-toc',
      '.fd-type-table',
    ])
      expect(Option.isSome(Scene.find(rendered, selector))).toBe(true)
    expect(Scene.textContent(rendered)).toContain('Usage')
    expect(Scene.textContent(rendered)).toContain('Page title')
  })

  it('renders registered inline and block components', () => {
    const components: MdxComponents = {
      inline: {
        Key: (component, content) =>
          h.kbd(
            [h.Class('custom-key'), h.Title(component.attributes.label ?? '')],
            content,
          ),
      },
      block: {
        Feature: (component, content) =>
          h.section(
            [
              h.Class('custom-feature'),
              h.DataAttribute('kind', component.attributes.kind ?? ''),
            ],
            content,
          ),
      },
    }

    const rendered = renderMarkdown(
      {
        blocks: [
          {
            _tag: 'BlockComponent',
            name: 'Feature',
            attributes: { kind: 'primary' },
            blocks: [
              {
                _tag: 'Paragraph',
                content: [
                  { _tag: 'Text', value: 'Press ' },
                  {
                    _tag: 'InlineComponent',
                    name: 'Key',
                    attributes: { label: 'Command key' },
                    content: [{ _tag: 'Text', value: '⌘K' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { components },
      h,
    )

    expect(rendered).not.toBeNull()
    if (rendered === null) return
    expect(Option.isSome(Scene.find(rendered, '.custom-feature'))).toBe(true)
    expect(Option.isSome(Scene.find(rendered, '.custom-key'))).toBe(true)
    expect(Scene.textContent(rendered)).toContain('Press ⌘K')
  })

  it('renders API playground responses and safe media components', () => {
    const interactiveHtml = h as unknown as HtmlBuilder<string>
    const rendered = renderMarkdown(
      {
        blocks: [
          {
            _tag: 'BlockComponent',
            name: 'ApiPlayground',
            attributes: {
              id: 'create-user',
              method: 'POST',
              url: 'https://api.example.com/users',
              body: encodeURIComponent('{"name":"Ada"}'),
            },
            blocks: [],
          },
          {
            _tag: 'BlockComponent',
            name: 'AsyncApiPlayground',
            attributes: {
              action: 'send',
              channel: 'users/created',
              payload: encodeURIComponent('{"id":"user-1"}'),
            },
            blocks: [],
          },
          {
            _tag: 'BlockComponent',
            name: 'Video',
            attributes: { src: '/demo.mp4', title: 'Demo' },
            blocks: [],
          },
          {
            _tag: 'BlockComponent',
            name: 'Audio',
            attributes: { src: '/demo.mp3', title: 'Narration' },
            blocks: [],
          },
          {
            _tag: 'BlockComponent',
            name: 'Embed',
            attributes: {
              src: 'https://example.com/embed',
              title: 'Example embed',
            },
            blocks: [],
          },
        ],
      },
      {
        apiRequestUrls: {
          'create-user': 'https://api.example.com/users/preview',
        },
        apiRequestBodies: { 'create-user': '{"name":"Grace"}' },
        updateApiRequestUrl: (id, value) => `${id}:${value}`,
        updateApiRequestBody: (id, value) => `${id}:${value}`,
        sendApiRequest: request => request.id,
        apiResponses: {
          'create-user': {
            loading: false,
            status: '201 Created',
            body: '{"id":"user-1"}',
            error: '',
          },
        },
      },
      interactiveHtml,
    )

    expect(rendered).not.toBeNull()
    if (rendered === null) return
    for (const selector of [
      '[data-component="ApiPlayground"]',
      '[data-component="AsyncApiPlayground"]',
      '.fd-video',
      '.fd-audio',
      '.fd-embed',
    ])
      expect(Option.isSome(Scene.find(rendered, selector))).toBe(true)
    expect(Scene.textContent(rendered)).toContain('201 Created')
    expect(Scene.textContent(rendered)).toContain('users/created')
    expect(Option.isSome(Scene.find(rendered, '.fd-api-url-input'))).toBe(true)
  })
})
