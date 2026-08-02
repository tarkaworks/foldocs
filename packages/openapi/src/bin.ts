#!/usr/bin/env node

import { generateFiles } from './index.js'

const usage =
  'Usage: foldocs-openapi <input.yaml|input.json|url> <content-output-directory> [public-base-url]'

const [input, output, baseUrl] = process.argv.slice(2)
if (input === undefined || output === undefined) {
  console.error(usage)
  process.exitCode = 1
} else {
  generateFiles({
    input,
    output,
    ...(baseUrl === undefined ? {} : { baseUrl }),
  }).then(
    files =>
      console.log(
        `Generated ${String(files.length)} OpenAPI documentation files in ${output}.`,
      ),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    },
  )
}
