import { Schema as S } from 'effect'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { compile } from '../src/index.js'

describe('compile', () => {
  it('uses @foldkit/markdown for .md and validates typed islands', async () => {
    const page = await compile(
      `---
title: Official Markdown
---

# Official Markdown

:::Aside{type="tip"}
This island is checked at build time.
:::
`,
      {
        filePath: 'official.md',
        highlight: false,
        markdown: {
          islands: {
            Aside: S.Struct({ type: S.Literals(['tip', 'warning']) }),
          },
        },
      },
    )

    expect(page.frontmatter.title).toBe('Official Markdown')
    expect(page.document.blocks).toContainEqual(
      expect.objectContaining({
        _tag: 'BlockComponent',
        name: 'Aside',
        attributes: { type: 'tip' },
      }),
    )

    await expect(
      compile('# Invalid\n\n::Aside{type="unknown"}', {
        filePath: 'invalid.md',
        highlight: false,
        markdown: {
          islands: {
            Aside: S.Struct({ type: S.Literals(['tip', 'warning']) }),
          },
        },
      }),
    ).rejects.toThrow(/Invalid attributes for island "Aside"/u)
  })

  it('keeps task lists as an explicit Foldocs Markdown extension', async () => {
    const page = await compile('# Tasks\n\n- [x] Ship it\n- [ ] Document it', {
      filePath: 'tasks.md',
      highlight: false,
    })
    const list = page.document.blocks.find(block => block._tag === 'List')
    expect(list?._tag).toBe('List')
    if (list?._tag !== 'List') return
    expect(list.items.map(item => item.checked)).toEqual([true, false])

    await expect(
      compile('# Tasks\n\n- [x] Ship it\n\n::Unknown', {
        filePath: 'invalid-tasks.md',
        highlight: false,
        markdown: { islands: {} },
      }),
    ).rejects.toThrow(/Unknown island "Unknown"/u)
  })

  it('uses the official vocabulary errors for unsupported .md syntax', async () => {
    await expect(
      compile('# Links\n\nRead [the guide][guide].\n\n[guide]: /guide', {
        filePath: 'links.md',
        highlight: false,
      }),
    ).rejects.toThrow(/Reference-style links are not supported/u)
  })

  it('compiles frontmatter, GFM, code and deterministic MDX', async () => {
    const page = await compile(
      `---
title: Effects
description: Typed effects
tags: [core]
---

# Effects

<Callout title="Important">
Use **scopes**.
</Callout>

## Resource safety

| API | Purpose |
| --- | --- |
| Scope | Cleanup |

\`\`\`ts
const program = Effect.succeed(1)
\`\`\`
`,
      { filePath: 'effects.mdx', highlight: false },
    )

    expect(page.frontmatter).toMatchObject({
      title: 'Effects',
      tags: ['core'],
    })
    expect(page.toc).toEqual([
      { id: 'resource-safety', title: 'Resource safety', depth: 2 },
    ])
    expect(page.document.blocks.map(block => block._tag)).toContain(
      'BlockComponent',
    )
    expect(page.document.blocks.map(block => block._tag)).toContain('Table')
    expect(page.plainText).toContain('Typed effects')
  })

  it('derives a title from the first heading', async () => {
    const page = await compile('# Inferred title\n\nContent', {
      highlight: false,
    })
    expect(page.frontmatter.title).toBe('Inferred title')
  })

  it('rejects executable MDX expressions', async () => {
    await expect(
      compile('# Unsafe\n\n<Value count={process.env.SECRET} />', {
        filePath: 'unsafe.mdx',
        highlight: false,
      }),
    ).rejects.toThrow(/JSON literals/iu)
  })

  it('accepts imports for registered components and static JSON expressions', async () => {
    const page = await compile(
      'import { Badge } from "./components"\n\n# Static\n\n<Badge count={3}>{"ready"}</Badge>',
      { filePath: 'static.mdx', highlight: false },
    )
    expect(
      page.document.blocks.some(block => block._tag === 'BlockComponent'),
    ).toBe(true)
    expect(page.plainText).toContain('ready')
  })

  it('rejects unsafe URL schemes', async () => {
    await expect(
      compile('# Unsafe\n\n[click](javascript:alert(1))'),
    ).rejects.toThrow(/Unsafe URL scheme/iu)
  })

  it('decorates highlighted code with accessible visual line numbers', async () => {
    const page = await compile(
      '# Code\n\n```ts\nconst one = 1\nconst two = 2\n```',
      {
        filePath: 'code.mdx',
      },
    )
    const code = page.document.blocks.find(block => block._tag === 'CodeBlock')
    expect(code?._tag).toBe('CodeBlock')
    if (code?._tag !== 'CodeBlock') return
    expect(code.highlightedHtml).toContain('data-line-digits="2"')
    expect(code.highlightedHtml).toContain('data-line="1"')
    expect(code.highlightedHtml).toContain('data-line="2"')
  })

  it('expands one package-install block into highlighted manager commands', async () => {
    const page = await compile(
      '# Install\n\n```package-install\nfoldocs foldkit effect\n```',
      { filePath: 'install.md', highlight: false },
    )
    const install = page.document.blocks.find(
      block => block._tag === 'PackageInstall',
    )
    expect(install?._tag).toBe('PackageInstall')
    if (install?._tag !== 'PackageInstall') return
    expect(install.defaultManager).toBe('npm')
    expect(install.commands).toEqual([
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
    ])
    expect(page.plainText).toContain('npm install foldocs foldkit effect')
    expect(page.plainText).not.toContain('pnpm add foldocs')
  })

  it('compiles math, Mermaid, dynamic code, and inline TOC components', async () => {
    const page = await compile(
      '# Advanced\n\nInline $x^2$.\n\n$$\nx + y\n$$\n\n```mermaid\nflowchart LR\nA --> B\n```\n\n<DynamicCodeBlock lang="ts" code="const value = 1" />\n\n<InlineTOC />',
      { filePath: 'advanced.mdx', highlight: false },
    )

    expect(page.document.blocks.map(block => block._tag)).toEqual(
      expect.arrayContaining(['MathBlock', 'Mermaid', 'CodeBlock']),
    )
    const paragraph = page.document.blocks.find(
      block => block._tag === 'Paragraph',
    )
    expect(
      paragraph?._tag === 'Paragraph'
        ? paragraph.content.some(inline => inline._tag === 'InlineMath')
        : false,
    ).toBe(true)
    expect(page.plainText).toContain('x + y')
  })

  it('converts npm fences line by line and preserves install flags', async () => {
    const page = await compile(
      '# Commands\n\n```npm\nnpm install foldocs -D\nnpx create-foldocs docs\n```',
      { filePath: 'commands.mdx', highlight: false },
    )
    const install = page.document.blocks.find(
      block => block._tag === 'PackageInstall',
    )
    expect(install?._tag).toBe('PackageInstall')
    if (install?._tag !== 'PackageInstall') return
    expect(
      install.commands.find(command => command.manager === 'pnpm')?.value,
    ).toBe('pnpm add foldocs -D\npnpm dlx create-foldocs docs')
    expect(
      install.commands.find(command => command.manager === 'bun')?.value,
    ).toBe('bun add foldocs --dev\nbun x create-foldocs docs')
  })

  it('composes remark plugins and emits structured sections and references', async () => {
    const page = await compile(
      '# Plugin page\n\nBefore plugin.\n\n## Install\n\nRead [the guide](/guide).',
      {
        filePath: 'plugin.mdx',
        highlight: false,
        remarkPlugins: [
          () => (tree: { children?: Array<Record<string, unknown>> }) => {
            for (const node of tree.children ?? []) {
              if (node.type !== 'paragraph' || !Array.isArray(node.children))
                continue
              for (const child of node.children as Array<
                Record<string, unknown>
              >) {
                if (child.type === 'text' && child.value === 'Before plugin.')
                  child.value = 'After plugin.'
              }
            }
          },
        ],
      },
    )

    expect(page.plainText).toContain('After plugin.')
    expect(page.structuredData).toMatchObject([
      { id: '', title: 'Plugin page' },
      { id: 'install', title: 'Install' },
    ])
    expect(page.references).toEqual([{ url: '/guide', label: 'the guide' }])
  })

  it('runs typed document plugins after compilation', async () => {
    const page = await compile('# Original\n\nContent.', {
      filePath: 'plugin.mdx',
      highlight: false,
      documentPlugins: [
        (compiled, context) => ({
          ...compiled,
          frontmatter: {
            ...compiled.frontmatter,
            description: `Transformed ${context.filePath ?? 'unknown'}`,
          },
        }),
      ],
    })

    expect(page.frontmatter.description).toBe('Transformed plugin.mdx')
  })

  it('creates persistent TypeScript and JavaScript tabs from showJs fences', async () => {
    const page = await compile(
      '# Client\n\n```ts showJs title="client.ts"\nconst value: number = 1\n```',
      {
        filePath: 'client.mdx',
        highlight: false,
        transformTypeScript: ({ value }) => value.replace(': number', ''),
      },
    )
    const tabs = page.document.blocks.find(
      block => block._tag === 'BlockComponent' && block.name === 'Tabs',
    )

    expect(tabs).toMatchObject({
      _tag: 'BlockComponent',
      name: 'Tabs',
      attributes: {
        groupId: 'typescript-javascript',
        persist: 'true',
      },
    })
    if (tabs?._tag !== 'BlockComponent') return
    expect(tabs.blocks).toHaveLength(2)
    expect(page.plainText).toContain('const value = 1')
  })

  it('preserves custom frontmatter fields as collection data', async () => {
    const page = await compile(
      '---\ntitle: Reference\ncategory: runtime\nstability: stable\n---\n\n# Reference',
      { filePath: 'reference.mdx', highlight: false },
    )

    expect(page.frontmatter.data).toEqual({
      category: 'runtime',
      stability: 'stable',
    })
  })

  it('includes Markdown sections and code regions from local files', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'foldocs-include-'))
    const pagePath = path.join(directory, 'page.mdx')
    await writeFile(
      path.join(directory, 'shared.mdx'),
      '# Shared\n\n<section id="reused">Included **content**.</section>\n\nNot included.',
    )
    await writeFile(
      path.join(directory, 'example.ts'),
      'const before = true\n//#region demo\nconst included = true\n//#endregion\n',
    )
    const page = await compile(
      '# Includes\n\n<include>./shared.mdx#reused</include>\n\n<include lang="ts" meta=\'title="example.ts"\'>./example.ts#demo</include>',
      { filePath: pagePath, highlight: false },
    )

    expect(page.plainText).toContain('Included content')
    expect(page.plainText).toContain('const included = true')
    expect(page.plainText).not.toContain('Not included')
    expect(page.plainText).not.toContain('const before')
  })

  it('leaves include examples inside fenced code untouched', async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), 'foldocs-include-docs-'),
    )
    const page = await compile(
      '# Includes\n\n```mdx\n<include>./missing.mdx</include>\n```',
      {
        filePath: path.join(directory, 'page.md'),
        highlight: false,
      },
    )

    expect(page.plainText).toContain('<include>./missing.mdx</include>')
  })
})
