#!/usr/bin/env node

import { exportDirectory } from './index.js'

const [
  input,
  output,
  title = 'Documentation',
  identifier = 'urn:foldocs:documentation',
] = process.argv.slice(2)
if (input === undefined || output === undefined) {
  process.stderr.write(
    'Usage: foldocs-epub <content-directory> <output.epub> [title] [identifier]\n',
  )
  process.exit(1)
}

exportDirectory({ input, output, title, identifier }).then(
  result =>
    process.stdout.write(
      `Exported ${String(result.pages)} pages to ${result.output}.\n`,
    ),
  error => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    )
    process.exitCode = 1
  },
)
