import { describe, expect, it } from 'vitest'

import { compile, documentToMarkdown } from '../src/index.js'

describe('documentToMarkdown', () => {
  it('serializes deterministic MDX into portable Markdown', async () => {
    const page = await compile(
      `# Effects

<Callout type="tip" title="Typed">
Use **scopes** and [the guide](/docs/guide).
</Callout>

| API | Purpose |
| :-- | --: |
| Scope | Cleanup |

\`\`\`ts
const program = Effect.succeed(1)
\`\`\`
`,
      { highlight: false },
    )

    expect(
      documentToMarkdown(page.document, { baseUrl: 'https://example.com' }),
    ).toBe(`# Effects

> [!TIP] Typed
> Use **scopes** and [the guide](https://example.com/docs/guide).

| API | Purpose |
| :--- | ---: |
| Scope | Cleanup |

\`\`\`ts
const program = Effect.succeed(1)
\`\`\`
`)
  })

  it('serializes the authored package-install block instead of generated variants', async () => {
    const page = await compile(
      '# Install\n\n```package-install\nfoldocs foldkit effect\n```',
      { highlight: false },
    )

    expect(documentToMarkdown(page.document)).toBe(`# Install

\`\`\`package-install
foldocs foldkit effect
\`\`\`
`)
  })
})
