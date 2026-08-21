#!/usr/bin/env node

import { generateFiles } from './index.js'

const [input, output, baseUrl] = process.argv.slice(2)
if (input === undefined || output === undefined) {
  process.stderr.write(
    'Usage: foldocs-typescript <entry.ts>[,<entry.ts>...] <output-directory> [public-base-url]\n',
  )
  process.exit(1)
}
const entries = input.split(',').map(entry => entry.trim())

generateFiles({
  input: entries.length === 1 ? entries[0]! : entries,
  output,
  ...(baseUrl === undefined ? {} : { baseUrl }),
}).then(
  files => process.stdout.write(`Generated ${String(files.length)} files.\n`),
  error => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    )
    process.exitCode = 1
  },
)
