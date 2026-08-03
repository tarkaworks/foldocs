#!/usr/bin/env node

import { Effect } from 'effect'

import {
  type Customization,
  type RegistryComponent,
  addComponents,
  check,
  customize,
  generateTree,
  preview,
} from './index.js'

const help = `foldocs

Usage:
  foldocs check [root] [--content <directory>] [--base-path <path>]
                   [--locales <en,es>] [--fallback-locale <locale>]
  foldocs customize [theme|layout|mdx-components|all] [root]
                    [--output <directory>] [--force]
  foldocs add <callout|cards|files|tabs|accordion|steps|type-table|graph|story>...
              [--output <file>] [--force]
  foldocs tree <directory> [output.mdx|output.tsx] [--hidden]
  foldocs preview [directory|file] [--host <host>] [--port <port>]

Commands:
  check  Compile every page and report duplicate routes and broken local links
  customize  Copy project-owned theme, layout, or MDX component source
  add  Install editable Foldkit component views into your project
  tree  Generate a Files component from a directory
  preview  Serve Markdown and deterministic MDX with live reload-on-refresh
`

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  process.stdout.write(help)
  process.exit(0)
}

if (
  args[0] !== 'check' &&
  args[0] !== 'customize' &&
  args[0] !== 'add' &&
  args[0] !== 'tree' &&
  args[0] !== 'preview'
) {
  process.stderr.write(`${help}\nUnknown command: ${args[0] ?? ''}\n`)
  process.exit(1)
}

const valueAfter = (flag: string): string | undefined => {
  const index = args.indexOf(flag)
  return index === -1 ? undefined : args[index + 1]
}

if (args[0] === 'tree') {
  const input = args[1]
  if (input === undefined || input.startsWith('-')) {
    process.stderr.write('tree requires an input directory.\n')
    process.exit(1)
  }
  const output = args[2]?.startsWith('-') ? undefined : args[2]
  try {
    const result = await Effect.runPromise(
      generateTree({
        input,
        ...(output === undefined ? {} : { output }),
        includeHidden: args.includes('--hidden'),
      }),
    )
    if (result.output === undefined) process.stdout.write(result.source)
    else process.stdout.write(`✓ ${result.output}\n`)
    process.exit(0)
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    )
    process.exit(1)
  }
}

if (args[0] === 'add') {
  const allowed: ReadonlyArray<RegistryComponent> = [
    'callout',
    'cards',
    'files',
    'tabs',
    'accordion',
    'steps',
    'type-table',
    'graph',
    'story',
  ]
  const components = args.slice(1).filter((value, index, list) => {
    if (value.startsWith('-')) return false
    return list[index - 1] !== '--output'
  })
  const invalid = components.find(
    component => !allowed.includes(component as RegistryComponent),
  )
  if (invalid !== undefined || components.length === 0) {
    process.stderr.write(
      invalid === undefined
        ? `Choose one of: ${allowed.join(', ')}.\n`
        : `Unknown component: ${invalid}.\n`,
    )
    process.exit(1)
  }
  try {
    const result = await Effect.runPromise(
      addComponents({
        components: components as ReadonlyArray<RegistryComponent>,
        ...(valueAfter('--output') === undefined
          ? {}
          : { output: valueAfter('--output')! }),
        force: args.includes('--force'),
      }),
    )
    process.stdout.write(`✓ ${result.file}\n`)
    process.exit(0)
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    )
    process.exit(1)
  }
}

if (args[0] === 'preview') {
  const input = args[1]?.startsWith('-') ? '.' : (args[1] ?? '.')
  const portValue = valueAfter('--port')
  try {
    const server = await preview({
      input,
      ...(valueAfter('--host') === undefined
        ? {}
        : { host: valueAfter('--host')! }),
      ...(portValue === undefined
        ? {}
        : { port: Number.parseInt(portValue, 10) }),
    })
    process.stdout.write(`Foldocs preview: ${server.url}\n`)
    await new Promise<void>(() => undefined)
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    )
    process.exit(1)
  }
}

const root = args.slice(1).find((argument, index, list) => {
  if (argument.startsWith('-')) return false
  const previous = list[index - 1]
  return ![
    '--content',
    '--base-path',
    '--locales',
    '--fallback-locale',
    '--output',
  ].includes(previous ?? '')
})

if (args[0] === 'customize') {
  const selection = args[1]?.startsWith('-') ? undefined : args[1]
  const allowed: ReadonlyArray<Customization | 'all'> = [
    'theme',
    'layout',
    'mdx-components',
    'all',
  ]
  if (
    selection !== undefined &&
    !allowed.includes(selection as Customization)
  ) {
    process.stderr.write(`Unknown customization: ${selection}\n`)
    process.exit(1)
  }
  const components: ReadonlyArray<Customization> =
    selection === 'all'
      ? ['theme', 'layout', 'mdx-components']
      : selection === undefined
        ? ['theme', 'layout']
        : [selection as Customization]
  const positionalRoot = args
    .slice(selection === undefined ? 1 : 2)
    .find((argument, index, list) => {
      if (argument.startsWith('-')) return false
      return list[index - 1] !== '--output'
    })
  Effect.runPromise(
    customize({
      ...(positionalRoot === undefined ? {} : { root: positionalRoot }),
      ...(valueAfter('--output') === undefined
        ? {}
        : { outputDir: valueAfter('--output')! }),
      components,
      force: args.includes('--force'),
    }),
  ).then(
    result => {
      for (const file of result.files) process.stdout.write(`✓ ${file}\n`)
      if (components.includes('mdx-components'))
        process.stdout.write(
          'Merge customMdxComponents into the registry passed to createDocsProgram.\n',
        )
    },
    error => {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      )
      process.exitCode = 1
    },
  )
} else {
  const locales = valueAfter('--locales')
    ?.split(',')
    .map(locale => locale.trim())
    .filter(Boolean)

  Effect.runPromise(
    check({
      ...(root === undefined ? {} : { root }),
      ...(valueAfter('--content') === undefined
        ? {}
        : { contentDir: valueAfter('--content')! }),
      ...(valueAfter('--base-path') === undefined
        ? {}
        : { basePath: valueAfter('--base-path')! }),
      ...(locales === undefined ? {} : { locales }),
      ...(valueAfter('--fallback-locale') === undefined
        ? {}
        : { fallbackLocale: valueAfter('--fallback-locale')! }),
    }),
  ).then(
    result => {
      for (const issue of result.issues) {
        process.stderr.write(
          `${issue.level.toUpperCase()} ${issue.file}: ${issue.message}\n`,
        )
      }
      process.stdout.write(
        `${result.valid ? '✓' : '✗'} Checked ${String(result.pages)} documentation pages.\n`,
      )
      if (!result.valid) process.exitCode = 1
    },
    error => {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      )
      process.exitCode = 1
    },
  )
}
