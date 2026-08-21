import { buildNavigation, resolveConfig } from 'foldocs-core'
import { compile } from 'foldocs-mdx'
import { describe, expect, it } from 'vitest'

import { makeLlmsIndex } from '../src/index.js'

const page = async (
  id: string,
  url: string,
  title: string,
  extra: Readonly<Record<string, unknown>> = {},
) => {
  const compiled = await compile(
    `---\ntitle: ${title}\n---\n\nBody for ${title}.\n`,
    { highlight: false },
  )
  return {
    moduleId: `/${id}`,
    metadata: {
      id,
      slug: url.replace(/^\//u, ''),
      url,
      file: `content/${id}`,
      locale: 'en',
      frontmatter: { ...compiled.frontmatter, title, ...extra },
      toc: compiled.toc,
      plainText: compiled.plainText,
    },
    compiled,
  }
}

describe('makeLlmsIndex', () => {
  it('groups pages into navigation-ordered sections with .md links', async () => {
    const quickStart = await page('index.mdx', '/docs', 'Quick Start')
    const cliOverview = await page('cli/index.mdx', '/docs/cli', 'CLI')
    const cliInstall = await page(
      'cli/install.mdx',
      '/docs/cli/install',
      'Install',
    )
    const pages = [quickStart, cliOverview, cliInstall]
    const navigation = buildNavigation(pages.map(p => p.metadata))
    const config = resolveConfig({
      site: { title: 'Foldocs', baseUrl: 'https://foldocs.vercel.app' },
    })

    const index = makeLlmsIndex(config, pages, navigation, 'en')

    expect(index.indexOf('## Documentation')).toBeGreaterThanOrEqual(0)
    expect(index.indexOf('## Cli')).toBeGreaterThan(
      index.indexOf('## Documentation'),
    )
    expect(index).toContain('[Quick Start](https://foldocs.vercel.app/docs.md)')
    expect(index).toContain(
      '[Install](https://foldocs.vercel.app/docs/cli/install.md)',
    )
  })

  it('moves pages marked llms: optional into a trailing Optional section', async () => {
    const guide = await page('guide.mdx', '/docs/guide', 'Guide')
    const changelog = await page(
      'changelog.mdx',
      '/docs/changelog',
      'Changelog',
      { llms: 'optional' },
    )
    const pages = [guide, changelog]
    const navigation = buildNavigation(pages.map(p => p.metadata))
    const config = resolveConfig({ site: { title: 'Foldocs' } })

    const index = makeLlmsIndex(config, pages, navigation, 'en')

    expect(index.indexOf('## Optional')).toBeGreaterThan(
      index.indexOf('[Guide]'),
    )
    expect(index.indexOf('[Changelog]')).toBeGreaterThan(
      index.indexOf('## Optional'),
    )
  })
})
