#!/usr/bin/env node

import { Effect } from 'effect'

import { type PackageManager, scaffold } from './index.js'

const help = `create-foldocs

Usage:
  pnpm create foldocs <directory> [options]

Options:
  --no-install              Skip dependency installation
  --package-manager <name>  pnpm, npm, yarn, or bun
  -h, --help                Show this help
`

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(help)
  process.exit(0)
}

const directory = args.find(argument => !argument.startsWith('-'))
if (directory === undefined) {
  process.stderr.write(`${help}\nError: a destination directory is required.\n`)
  process.exit(1)
}

const managerIndex = args.indexOf('--package-manager')
const manager = managerIndex === -1 ? undefined : args[managerIndex + 1]
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

Effect.runPromise(
  scaffold({
    directory,
    install: !args.includes('--no-install'),
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
