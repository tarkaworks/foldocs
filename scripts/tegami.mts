#!/usr/bin/env node

import { type PublishPlan, tegami } from 'tegami'
import { runCli } from 'tegami/cli'
import { github } from 'tegami/plugins/github'

export const paper = tegami({
  plugins: [
    github({
      repo: 'tarkaworks/foldocs',
      versionPr: {
        base: 'main',
      },
    }),
  ],
  npm: {
    client: 'pnpm',
    updateLockFile: true,
    bumpDep: ({ dependent, kind }) => {
      if (dependent.manifest.private === true || kind === 'devDependencies') {
        return false
      }
      return kind === 'peerDependencies' ? 'major' : 'patch'
    },
    trustedPublish: {
      provider: 'github',
      workflow: 'publish.yml',
    },
  },
  ignore: [
    'foldocs-monorepo',
    'foldocs-docs',
    '@foldocs/asyncapi',
    '@foldocs/basehub',
    '@foldocs/epub',
    '@foldocs/mdx-remote',
    '@foldocs/obsidian',
    '@foldocs/openapi',
    '@foldocs/python',
    '@foldocs/sanity',
    '@foldocs/search-algolia',
    '@foldocs/search-flexsearch',
    '@foldocs/search-mixedbread',
    '@foldocs/search-orama-cloud',
    '@foldocs/search-trieve',
    '@foldocs/search-typesense',
    '@foldocs/typescript',
  ],
  groups: {
    foldocs: {
      syncBump: true,
      syncGitTag: true,
    },
    cli: {
      syncBump: true,
      syncGitTag: true,
    },
  },
  packages: {
    foldocs: { group: 'foldocs' },
    'foldocs-core': { group: 'foldocs' },
    'foldocs-ui': { group: 'foldocs' },
    '@foldocs/cli': { group: 'cli' },
    'create-foldocs': { group: 'cli' },
  },
})

if (import.meta.main) {
  const publishWithDiagnostics = async () => {
    try {
      return (await paper.publish()) as PublishPlan
    } catch (error) {
      const failures = error instanceof AggregateError ? error.errors : [error]

      console.error(
        failures
          .map((failure, index) => {
            const message =
              failure instanceof Error ? failure.message : String(failure)
            return `Publish failure ${index + 1}:\n${message}`
          })
          .join('\n\n'),
      )
      throw error
    }
  }

  const shouldPublish =
    process.argv[2] === 'ci' ||
    (process.argv[2] === 'publish' && !process.argv.includes('--dry-run'))

  await runCli(paper, shouldPublish ? { publish: publishWithDiagnostics } : {})
}
