import { Option, Schema as S } from 'effect'
import { inertHtml as h } from 'foldkit/html'
import { Scene } from 'foldkit/test'
import type { Block } from 'foldocs-mdx'
import { describe, expect, it } from 'vitest'

import { islandsFor } from '@foldkit/markdown'

import { type MdxComponents, renderMarkdown } from '../src/markdown.js'

describe('custom MDX components', () => {
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
      '.fd-tab-input',
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
})
