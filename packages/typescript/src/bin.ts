#!/usr/bin/env node

import { generateFiles } from './index.js'

const [input, output, baseUrl] = process.argv.slice(2)
if (input === undefined || output === undefined) {
  process.stderr.write(
    'Usage: foldocs-typescript <entry.ts> <output-directory> [public-base-url]\n',
  )
  process.exit(1)
}

generateFiles({
  input,
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
