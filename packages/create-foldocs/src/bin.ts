#!/usr/bin/env node

import { Effect } from 'effect'
import { parseArgs } from 'node:util'

import {
  type DeploymentTarget,
  type PackageManager,
  deploymentTargets,
  scaffold,
} from './index.js'

const help = `create-foldocs

Usage:
  pnpm create foldocs <directory> [options]

Options:
  --no-install              Skip dependency installation
  --package-manager <name>  pnpm, npm, yarn, or bun
  --deployment <target>     none, vercel, or cloudflare (default: none)
  -h, --help                Show this help
`

const args = process.argv.slice(2)
const parsed = (() => {
  try {
    return parseArgs({
      args,
      allowPositionals: true,
      strict: true,
      options: {
        deployment: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
        'no-install': { type: 'boolean' },
        'package-manager': { type: 'string' },
      },
    })
  } catch (error) {
    process.stderr.write(
      `${help}\nError: ${error instanceof Error ? error.message : String(error)}\n`,
    )
    process.exit(1)
  }
})()

if (parsed.values.help === true) {
  process.stdout.write(help)
  process.exit(0)
}

const [directory, ...extraPositionals] = parsed.positionals
if (directory === undefined) {
  process.stderr.write(`${help}\nError: a destination directory is required.\n`)
  process.exit(1)
}
if (extraPositionals.length > 0) {
  process.stderr.write(`Unexpected argument: ${extraPositionals[0]}\n`)
  process.exit(1)
}

const manager = parsed.values['package-manager']
if (
  manager !== undefined &&
  manager !== 'pnpm' &&
  manager !== 'npm' &&
  manager !== 'yarn' &&
  manager !== 'bun'
) {
  process.stderr.write(`Unknown package manager: ${manager}\n`)
  process.exit(1)
}

const deployment = parsed.values.deployment ?? 'none'
if (!deploymentTargets.some(target => target === deployment)) {
  process.stderr.write(`Unknown deployment target: ${deployment}\n`)
  process.exit(1)
}

Effect.runPromise(
  scaffold({
    directory,
    deployment: deployment as DeploymentTarget,
    install: parsed.values['no-install'] !== true,
    ...(manager === undefined
      ? {}
      : { packageManager: manager as PackageManager }),
  }),
).then(
  result => {
    const relative = pathForDisplay(result.directory)
    process.stdout.write(
      `\nCreated Foldocs in ${relative}\n\n  cd ${relative}\n${
        result.installed ? '' : `  ${result.packageManager} install\n`
      }  ${result.packageManager} dev\n\nStart writing in content/docs.\n`,
    )
  },
  error => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    )
    process.exitCode = 1
  },
)

function pathForDisplay(absolute: string): string {
  const relative = absolute.startsWith(`${process.cwd()}/`)
    ? absolute.slice(process.cwd().length + 1)
    : absolute
  return relative.includes(' ') ? `"${relative}"` : relative
}
