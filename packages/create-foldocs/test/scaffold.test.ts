import { Effect } from 'effect'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { scaffold } from '../src/index.js'

describe('create-foldocs', () => {
  it('creates a complete, renamed application without prompts', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'create-foldocs-'))
    const result = await Effect.runPromise(
      scaffold({
        directory: 'My Docs',
        cwd,
        install: false,
        packageManager: 'pnpm',
      }),
    )
    const packageJson = JSON.parse(
      await fs.readFile(path.join(result.directory, 'package.json'), 'utf8'),
    ) as {
      name: string
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
      scripts: Record<string, string>
    }
    expect(packageJson.name).toBe('my-docs')
    expect(packageJson.dependencies.foldocs).toBe('latest')
    expect(packageJson.devDependencies['@foldocs/vite']).toBe('latest')
    expect(packageJson.devDependencies['@foldocs/language']).toBe('latest')
    for (const privatePackage of [
      '@foldocs/asyncapi',
      '@foldocs/epub',
      '@foldocs/obsidian',
      '@foldocs/openapi',
    ]) {
      expect(packageJson.devDependencies[privatePackage]).toBeUndefined()
    }
    expect(packageJson.devDependencies.alchemy).toBe('0.93.12')
    expect(packageJson.scripts.deploy).toBe('alchemy deploy')
    await expect(
      fs.stat(path.join(result.directory, '.gitignore')),
    ).resolves.toBeDefined()
    await expect(
      fs.stat(path.join(result.directory, '.env.example')),
    ).resolves.toBeDefined()
    await expect(
      fs.stat(path.join(result.directory, '.oxlintrc.json')),
    ).resolves.toBeDefined()
    await expect(
      fs.stat(path.join(result.directory, '.prettierrc')),
    ).resolves.toBeDefined()
    await expect(
      fs.stat(path.join(result.directory, '.prettierignore')),
    ).resolves.toBeDefined()
    expect(packageJson.scripts.format).toBe('prettier --write .')
    expect(packageJson.scripts['format:check']).toBe('prettier --check .')
    expect(packageJson.scripts.lint).toBe('oxlint --disable-nested-config')
    expect(packageJson.scripts.check).toContain('prettier --check .')
    expect(packageJson.scripts.check).toContain('foldocs check')
    await expect(
      fs.stat(path.join(result.directory, 'content/docs/en/index.mdx')),
    ).resolves.toBeDefined()
    await expect(
      fs.stat(path.join(result.directory, 'content/docs/en/meta.json')),
    ).resolves.toBeDefined()
    await expect(
      fs.stat(path.join(result.directory, 'content/docs/es/meta.json')),
    ).resolves.toBeDefined()
    await expect(
      fs.stat(path.join(result.directory, 'src/entry.ts')),
    ).resolves.toBeDefined()
    await expect(
      fs.stat(path.join(result.directory, 'src/mdx-components.ts')),
    ).resolves.toBeDefined()
    await expect(
      fs.stat(path.join(result.directory, 'src/markdown-islands.ts')),
    ).resolves.toBeDefined()
    await expect(
      fs.readFile(path.join(result.directory, 'vite.config.ts'), 'utf8'),
    ).resolves.toContain(
      'markdownOptions: { islands: markdownIslandDefinitions }',
    )
    await expect(
      fs.stat(path.join(result.directory, 'foldocs.config.ts')),
    ).resolves.toBeDefined()
    await expect(
      fs.readFile(path.join(result.directory, 'src/entry.ts'), 'utf8'),
    ).resolves.toContain('navigation')
    await expect(
      fs.readFile(path.join(result.directory, 'src/entry.ts'), 'utf8'),
    ).resolves.toContain('preloadDocsPage')
    await expect(
      fs.readFile(
        path.join(result.directory, 'content/docs/en/meta.json'),
        'utf8',
      ),
    ).resolves.toContain('---Introduction---')
    await expect(
      fs.readFile(
        path.join(result.directory, 'content/docs/en/meta.json'),
        'utf8',
      ),
    ).resolves.toContain('---Writing---')
    await expect(
      fs.readFile(
        path.join(
          result.directory,
          'content/docs/en/manual-installation/meta.json',
        ),
        'utf8',
      ),
    ).resolves.toContain('"defaultOpen": false')
    await expect(
      fs.readFile(
        path.join(
          result.directory,
          'content/docs/en/manual-installation/index.md',
        ),
        'utf8',
      ),
    ).resolves.toContain('index: true')
    await expect(
      fs.stat(path.join(result.directory, 'public/theme-init.js')),
    ).resolves.toBeDefined()
    await expect(
      fs.stat(path.join(result.directory, 'public/favicon.svg')),
    ).resolves.toBeDefined()
    await expect(
      fs.readFile(path.join(result.directory, 'public/favicon.svg'), 'utf8'),
    ).resolves.toContain('M148.656 50.395')
    await expect(
      fs.stat(path.join(result.directory, 'public/fonts')),
    ).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(
      fs.readFile(path.join(result.directory, 'alchemy.run.ts'), 'utf8'),
    ).resolves.toContain("'my-docs',")
    await expect(
      fs.stat(path.join(result.directory, 'openapi.yaml')),
    ).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(
      fs.stat(path.join(result.directory, 'asyncapi.yaml')),
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
