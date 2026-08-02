#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const publicPackageNames = new Set([
  '@foldocs/cli',
  '@foldocs/content',
  '@foldocs/language',
  '@foldocs/search',
  '@foldocs/search-orama',
  '@foldocs/tailwind',
  '@foldocs/twoslash',
  '@foldocs/vite',
  'create-foldocs',
  'foldocs',
  'foldocs-core',
  'foldocs-mdx',
  'foldocs-ui',
])

interface PackageManifest {
  readonly name: string
  readonly private?: boolean
  readonly publishConfig?: {
    readonly access?: string
  }
  readonly dependencies?: Record<string, string>
  readonly optionalDependencies?: Record<string, string>
  readonly peerDependencies?: Record<string, string>
}

const packagesDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../packages',
)
const manifests = new Map<string, PackageManifest>()

for (const entry of await readdir(packagesDirectory, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue

  const manifestPath = path.join(packagesDirectory, entry.name, 'package.json')
  try {
    const manifest = JSON.parse(
      await readFile(manifestPath, 'utf8'),
    ) as PackageManifest
    manifests.set(manifest.name, manifest)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

const errors: string[] = []

for (const name of publicPackageNames) {
  if (!manifests.has(name)) errors.push(`Missing public package: ${name}`)
}

for (const manifest of manifests.values()) {
  const shouldPublish = publicPackageNames.has(manifest.name)

  if (shouldPublish) {
    if (manifest.private === true) {
      errors.push(`${manifest.name} must not be private`)
    }
    if (manifest.publishConfig?.access !== 'public') {
      errors.push(`${manifest.name} must set publishConfig.access to public`)
    }
  } else {
    if (manifest.private !== true) {
      errors.push(`${manifest.name} must be private`)
    }
    if (manifest.publishConfig !== undefined) {
      errors.push(`${manifest.name} must not define publishConfig`)
    }
  }
}

for (const manifest of manifests.values()) {
  if (!publicPackageNames.has(manifest.name)) continue

  for (const kind of [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
  ] as const) {
    for (const dependency of Object.keys(manifest[kind] ?? {})) {
      if (manifests.get(dependency)?.private === true) {
        errors.push(
          `${manifest.name} has a private runtime dependency: ${dependency} (${kind})`,
        )
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.map(error => `- ${error}`).join('\n'))
  process.exitCode = 1
} else {
  console.log(
    `Release boundary valid: ${publicPackageNames.size} public, ${manifests.size - publicPackageNames.size} private`,
  )
}
