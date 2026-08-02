#!/usr/bin/env node

import { tegami } from 'tegami'
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
  await runCli(paper)
}
