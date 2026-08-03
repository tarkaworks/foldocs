import { describe, expect, it } from 'vitest'

import { defineCollection, parseCollectionFrontmatter } from '../src/index.js'

describe('typed content collections', () => {
  it('parses custom frontmatter through the collection definition', () => {
    const examples = defineCollection({
      name: 'examples',
      directory: 'content/examples',
      parse: value => ({
        category: String(value.category),
        featured: value.featured === true,
      }),
    })

    expect(
      parseCollectionFrontmatter(examples, {
        title: 'Resource safety',
        data: { category: 'guides', featured: true },
      }),
    ).toEqual({ category: 'guides', featured: true })
  })
})
