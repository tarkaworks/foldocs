import { compile } from 'foldocs-mdx'
import { describe, expect, it } from 'vitest'

import {
  isMarkdownPreferred,
  makeLandingMarkdown,
  makePageMarkdown,
  markdownAssetPath,
  pageUrlFromMarkdownPath,
} from '../src/markdown.js'

describe('Markdown routes', () => {
  it("uses Foldkit's appended .md path convention", () => {
    expect(markdownAssetPath('/')).toBe('index.md')
    expect(markdownAssetPath('/docs')).toBe('docs.md')
    expect(markdownAssetPath('/docs/getting-started')).toBe(
      'docs/getting-started.md',
    )
    expect(pageUrlFromMarkdownPath('/index.md')).toBe('/')
    expect(pageUrlFromMarkdownPath('/docs/getting-started.md')).toBe(
      '/docs/getting-started',
    )
  })

  it('recognizes Fumadocs-compatible Markdown Accept headers', () => {
    expect(isMarkdownPreferred('text/markdown, text/html;q=0.9')).toBe(true)
    expect(isMarkdownPreferred('text/plain')).toBe(true)
    expect(isMarkdownPreferred('text/html, */*;q=0.8')).toBe(false)
    expect(isMarkdownPreferred('text/markdown;q=0')).toBe(false)
  })

  it('emits processed content without frontmatter or a duplicate heading', async () => {
    const compiled = await compile(
      `---
title: Getting started
description: Build your first site.
---

# Getting started

Read [configuration](/docs/configuration).
`,
      { highlight: false },
    )

    expect(
      makePageMarkdown(
        { title: 'Foldocs', baseUrl: 'https://foldocs.vercel.app' },
        {
          metadata: {
            id: 'getting-started.mdx',
            slug: 'getting-started',
            url: '/docs/getting-started',
            file: 'content/docs/getting-started.mdx',
            frontmatter: compiled.frontmatter,
            toc: compiled.toc,
            plainText: compiled.plainText,
          },
          compiled,
        },
      ),
    ).toBe(`# Getting started

Build your first site.

Read [configuration](https://foldocs.vercel.app/docs/configuration).
`)
  })

  it('emits provenance frontmatter when requested', async () => {
    const compiled = await compile(
      `---
title: Getting started
description: Build your first site.
---

# Getting started
`,
      { highlight: false },
    )

    const markdown = makePageMarkdown(
      { title: 'Foldocs', baseUrl: 'https://foldocs.vercel.app' },
      {
        metadata: {
          id: 'getting-started.mdx',
          slug: 'getting-started',
          url: '/docs/getting-started',
          file: 'content/docs/getting-started.mdx',
          locale: 'en',
          lastModified: '2026-08-03',
          frontmatter: compiled.frontmatter,
          toc: compiled.toc,
          plainText: compiled.plainText,
        },
        compiled,
      },
      {
        frontmatter: true,
        breadcrumbs: ['Framework'],
        version: '0.5.1',
      },
    )

    expect(markdown).toMatch(/^---\n/u)
    expect(markdown).toContain(
      'url: "https://foldocs.vercel.app/docs/getting-started"',
    )
    expect(markdown).toContain('locale: "en"')
    expect(markdown).toContain('breadcrumbs: ["Framework"]')
    expect(markdown).toContain('lastModified: "2026-08-03"')
    expect(markdown).toContain('version: "0.5.1"')
    expect(markdown).toContain('# Getting started')
  })

  it('represents the generated root landing at index.md', () => {
    expect(
      makeLandingMarkdown(
        {
          title: 'Foldocs',
          tagline: 'Docs powered by Effect.',
          baseUrl: 'https://foldocs.vercel.app',
        },
        '/docs',
      ),
    ).toContain('[Read the documentation](https://foldocs.vercel.app/docs)')
  })
})
