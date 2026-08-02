#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

interface PackageManifest {
  readonly name: string
  readonly version: string
  readonly private?: boolean
  readonly publishConfig?: {
    readonly access?: string
    readonly registry?: string
  }
}

interface PublishedPackage {
  readonly name: string
  readonly version: string
  readonly registry: string
}

const verifyPublishedPackages = async () => {
  const packagesDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../packages',
  )
  const publishedPackages: PublishedPackage[] = []

  for (const entry of await readdir(packagesDirectory, {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue

    const manifestPath = path.join(
      packagesDirectory,
      entry.name,
      'package.json',
    )
    try {
      const manifest = JSON.parse(
        await readFile(manifestPath, 'utf8'),
      ) as PackageManifest

      if (
        manifest.private !== true &&
        manifest.publishConfig?.access === 'public'
      ) {
        publishedPackages.push({
          name: manifest.name,
          version: manifest.version,
          registry:
            manifest.publishConfig.registry ?? 'https://registry.npmjs.org',
        })
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  if (publishedPackages.length === 0) {
    console.error('No public packages were found to verify')
    process.exit(1)
  }

  const delays = [1_000, 2_000, 4_000, 8_000, 8_000]
  let missing = publishedPackages

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    missing = (
      await Promise.all(
        missing.map(async packageInfo => {
          const url = `${packageInfo.registry.replace(/\/$/, '')}/${encodeURIComponent(packageInfo.name)}/${encodeURIComponent(packageInfo.version)}`

          try {
            const response = await fetch(url, {
              headers: { accept: 'application/json' },
            })
            if (!response.ok) return packageInfo

            const manifest = (await response.json()) as PackageManifest
            return manifest.name === packageInfo.name &&
              manifest.version === packageInfo.version
              ? undefined
              : packageInfo
          } catch {
            return packageInfo
          }
        }),
      )
    ).filter(
      (packageInfo): packageInfo is PublishedPackage =>
        packageInfo !== undefined,
    )

    if (missing.length === 0) break
    if (attempt < delays.length) {
      console.log(
        `Waiting for ${missing.length} package${missing.length === 1 ? '' : 's'} to appear on npm...`,
      )
      await new Promise(resolve => setTimeout(resolve, delays[attempt]))
    }
  }

  if (missing.length > 0) {
    console.error(
      `The following packages were not published:\n${missing
        .map(packageInfo => `- ${packageInfo.name}@${packageInfo.version}`)
        .join('\n')}`,
    )
    process.exit(1)
  }

  console.log(
    `Verified ${publishedPackages.length} published packages on npm:\n${publishedPackages
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(packageInfo => `- ${packageInfo.name}@${packageInfo.version}`)
      .join('\n')}`,
  )
}

await verifyPublishedPackages()
