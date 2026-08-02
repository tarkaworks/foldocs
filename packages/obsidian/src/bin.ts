#!/usr/bin/env node

import { generateVault } from './index.js'

const [input, output] = process.argv.slice(2)
if (input === undefined || output === undefined) {
  process.stderr.write(
    'Usage: foldocs-obsidian <vault-directory> <output-directory>\n',
  )
  process.exit(1)
}

generateVault({ input, output }).then(
  result =>
    process.stdout.write(
      `Converted ${String(result.pages)} notes and ${String(result.assets)} assets.\n`,
    ),
  error => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    )
    process.exitCode = 1
  },
)
