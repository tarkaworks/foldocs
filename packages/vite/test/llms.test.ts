import { resolveConfig } from 'foldocs-core'
import { compile } from 'foldocs-mdx'
import { describe, expect, it } from 'vitest'

import { makeLlmsFull, makeLlmsIndex } from '../src/index.js'

const page = async (id: string, url: string, title: string) => {
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
      frontmatter: { ...compiled.frontmatter, title },
      toc: compiled.toc,
      plainText: compiled.plainText,
    },
    compiled,
  }
}

describe('makeLlmsIndex / makeLlmsFull', () => {
  it('stamps a generation date and version when llms.frontmatter is enabled', async () => {
    const guide = await page('guide.mdx', '/docs/guide', 'Guide')
    const pages = [guide]
    const config = resolveConfig({
      site: { title: 'Foldocs' },
      llms: { version: '1.2.3' },
    })

    const index = makeLlmsIndex(config, pages, '1.2.3', 'en')
    const full = makeLlmsFull(config, pages, [], '1.2.3')

    expect(index).toContain('Version 1.2.3.')
    expect(full).toContain('Version 1.2.3.')
    expect(index).toMatch(/Generated \d{4}-\d{2}-\d{2}\./u)
  })

  it('omits the generation stamp when llms.frontmatter is disabled', async () => {
    const guide = await page('guide.mdx', '/docs/guide', 'Guide')
    const pages = [guide]
    const config = resolveConfig({
      site: { title: 'Foldocs' },
      llms: { frontmatter: false, version: '1.2.3' },
    })

    const index = makeLlmsIndex(config, pages, '1.2.3', 'en')

    expect(index).not.toContain('Generated')
    expect(index).not.toContain('Version')
  })
})
