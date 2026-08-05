import { Effect } from 'effect'
import {
  type Block,
  type CompiledPage,
  type Inline,
  compile,
} from 'foldocs-mdx'
import { promises as fs } from 'node:fs'
import { type Server, createServer } from 'node:http'
import path from 'node:path'

export interface CheckOptions {
  readonly root?: string
  readonly contentDir?: string
  readonly basePath?: string
  readonly locales?: ReadonlyArray<string>
  readonly fallbackLocale?: string
}

export interface CheckIssue {
  readonly level: 'error' | 'warning'
  readonly file: string
  readonly message: string
}

export interface CheckResult {
  readonly pages: number
  readonly issues: ReadonlyArray<CheckIssue>
  readonly valid: boolean
}

export type Customization = 'theme' | 'layout' | 'mdx-components'

export interface CustomizeOptions {
  readonly root?: string
  readonly outputDir?: string
  readonly components?: ReadonlyArray<Customization>
  readonly force?: boolean
}

export interface CustomizeResult {
  readonly files: ReadonlyArray<string>
  readonly stylesheet: string
}

export interface TreeOptions {
  readonly input: string
  readonly output?: string
  readonly format?: 'mdx' | 'tsx'
  readonly includeHidden?: boolean
}

export type RegistryComponent =
  | 'callout'
  | 'cards'
  | 'files'
  | 'tabs'
  | 'accordion'
  | 'steps'
  | 'type-table'
  | 'graph'
  | 'story'

export interface AddComponentsOptions {
  readonly root?: string
  readonly output?: string
  readonly components: ReadonlyArray<RegistryComponent>
  readonly force?: boolean
}

export interface AddComponentsResult {
  readonly file: string
  readonly components: ReadonlyArray<RegistryComponent>
}

const registryNames: Readonly<
  Record<RegistryComponent, ReadonlyArray<readonly [string, string]>>
> = {
  callout: [['Callout', 'fd-callout']],
  cards: [
    ['Cards', 'fd-cards'],
    ['Card', 'fd-card'],
  ],
  files: [
    ['Files', 'fd-files'],
    ['Folder', 'fd-file-folder'],
    ['File', 'fd-file'],
  ],
  tabs: [
    ['Tabs', 'fd-tabs'],
    ['Tab', 'fd-tab-content'],
  ],
  accordion: [
    ['Accordions', 'fd-accordions'],
    ['Accordion', 'fd-accordion'],
  ],
  steps: [
    ['Steps', 'fd-steps'],
    ['Step', 'fd-step'],
  ],
  'type-table': [['TypeTable', 'fd-type-table-wrap']],
  graph: [['GraphView', 'fd-graph-view']],
  story: [
    ['Story', 'fd-story'],
    ['StoryVariant', 'fd-story-variant'],
  ],
}

/** Install editable Foldkit component views into the consuming project. */
export const addComponents = (
  options: AddComponentsOptions,
): Effect.Effect<AddComponentsResult, Error> =>
  Effect.tryPromise({
    try: async () => {
      const root = path.resolve(options.root ?? process.cwd())
      const target = path.resolve(
        root,
        options.output ?? 'src/foldocs/installed-components.ts',
      )
      const selected = [...new Set(options.components)]
      if (selected.length === 0)
        throw new TypeError('Select at least one component.')
      if (!options.force) {
        const exists = await fs.stat(target).then(
          () => true,
          error => {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
            throw error
          },
        )
        if (exists)
          throw new Error(
            `${path.relative(root, target)} already exists. Pass --force to replace it.`,
          )
      }
      const entries = selected.flatMap(name => registryNames[name])
      const source = [
        "import type { MdxComponents } from 'foldocs';",
        "import { inertHtml as h } from 'foldkit/html';",
        '',
        '/** Project-owned component views installed by `foldocs add`. */',
        'export const installedMdxComponents: MdxComponents = {',
        '  block: {',
        ...entries.map(
          ([name, className]) =>
            `    ${JSON.stringify(name)}: (_component, content) => h.div([h.Class(${JSON.stringify(className)})], content),`,
        ),
        '  },',
        '};',
        '',
      ].join('\n')
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, source, 'utf8')
      return {
        file: path.relative(root, target).split(path.sep).join('/'),
        components: selected,
      }
    },
    catch: cause => (cause instanceof Error ? cause : new Error(String(cause))),
  })

export interface TreeResult {
  readonly source: string
  readonly output?: string
}

interface FileTreeEntry {
  readonly name: string
  readonly directory: boolean
  readonly children: ReadonlyArray<FileTreeEntry>
}

const fileTree = async (
  directory: string,
  includeHidden: boolean,
): Promise<ReadonlyArray<FileTreeEntry>> => {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  return Promise.all(
    entries
      .filter(
        entry =>
          (includeHidden || !entry.name.startsWith('.')) &&
          entry.name !== 'node_modules',
      )
      .sort((left, right) => {
        if (left.isDirectory() !== right.isDirectory())
          return left.isDirectory() ? -1 : 1
        return left.name.localeCompare(right.name)
      })
      .map(async entry => ({
        name: entry.name,
        directory: entry.isDirectory(),
        children: entry.isDirectory()
          ? await fileTree(path.join(directory, entry.name), includeHidden)
          : [],
      })),
  )
}

const xmlAttribute = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')

const treeMarkup = (
  entries: ReadonlyArray<FileTreeEntry>,
  depth = 1,
): ReadonlyArray<string> =>
  entries.flatMap(entry => {
    const indent = '  '.repeat(depth)
    if (!entry.directory)
      return [`${indent}<File name="${xmlAttribute(entry.name)}" />`]
    return [
      `${indent}<Folder name="${xmlAttribute(entry.name)}">`,
      ...treeMarkup(entry.children, depth + 1),
      `${indent}</Folder>`,
    ]
  })

const treeAst = (
  entries: ReadonlyArray<FileTreeEntry>,
): ReadonlyArray<Record<string, unknown>> =>
  entries.map(entry => ({
    _tag: 'BlockComponent',
    name: entry.directory ? 'Folder' : 'File',
    attributes: { name: entry.name },
    blocks: entry.directory ? treeAst(entry.children) : [],
  }))

/** Generate a Foldocs Files component from a real directory tree. */
export const generateTree = (
  options: TreeOptions,
): Effect.Effect<TreeResult, Error> =>
  Effect.tryPromise({
    try: async () => {
      const input = path.resolve(options.input)
      const entries = await fileTree(input, options.includeHidden ?? false)
      const format =
        options.format ??
        (options.output?.toLowerCase().endsWith('.tsx') ? 'tsx' : 'mdx')
      const markup = ['<Files>', ...treeMarkup(entries), '</Files>'].join('\n')
      const source =
        format === 'tsx'
          ? [
              "import type { BlockComponent } from 'foldocs-mdx';",
              '',
              'export default {',
              "  _tag: 'BlockComponent',",
              "  name: 'Files',",
              '  attributes: {},',
              `  blocks: ${JSON.stringify(treeAst(entries), null, 2)},`,
              '} satisfies BlockComponent;',
              '',
            ].join('\n')
          : `${markup}\n`
      if (options.output === undefined) return { source }
      const output = path.resolve(options.output)
      await fs.mkdir(path.dirname(output), { recursive: true })
      await fs.writeFile(output, source, 'utf8')
      return { source, output }
    },
    catch: cause => (cause instanceof Error ? cause : new Error(String(cause))),
  })

export interface PreviewOptions {
  readonly input: string
  readonly host?: string
  readonly port?: number
}

export interface PreviewServer {
  readonly url: string
  readonly close: () => Promise<void>
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const previewInline = (inline: Inline): string => {
  switch (inline._tag) {
    case 'Text':
      return escapeHtml(inline.value)
    case 'InlineCode':
      return `<code>${escapeHtml(inline.value)}</code>`
    case 'InlineMath':
      return inline.html
    case 'HardBreak':
      return '<br>'
    case 'Emphasis':
      return `<em>${inline.content.map(previewInline).join('')}</em>`
    case 'Strong':
      return `<strong>${inline.content.map(previewInline).join('')}</strong>`
    case 'Strikethrough':
      return `<del>${inline.content.map(previewInline).join('')}</del>`
    case 'Link':
      return `<a href="${escapeHtml(inline.url)}">${inline.content.map(previewInline).join('')}</a>`
    case 'Image':
      return `<img src="${escapeHtml(inline.url)}" alt="${escapeHtml(inline.alt)}">`
    case 'InlineComponent':
      return `<span data-component="${escapeHtml(inline.name)}">${inline.content.map(previewInline).join('')}</span>`
  }
}

const previewBlock = (block: Block): string => {
  switch (block._tag) {
    case 'Heading':
      return `<h${String(block.level)} id="${escapeHtml(block.id)}">${block.content.map(previewInline).join('')}</h${String(block.level)}>`
    case 'Paragraph':
      return `<p>${block.content.map(previewInline).join('')}</p>`
    case 'CodeBlock':
      return (
        block.highlightedHtml ??
        `<pre><code>${escapeHtml(block.value)}</code></pre>`
      )
    case 'MathBlock':
      return block.html
    case 'Mermaid':
      return `<pre><code>${escapeHtml(block.value)}</code></pre>`
    case 'PackageInstall':
      return `<pre><code>${escapeHtml(block.commands[0]?.value ?? block.source)}</code></pre>`
    case 'List': {
      const tag = block.ordered ? 'ol' : 'ul'
      return `<${tag}>${block.items.map(item => `<li>${item.blocks.map(previewBlock).join('')}</li>`).join('')}</${tag}>`
    }
    case 'Blockquote':
      return `<blockquote>${block.blocks.map(previewBlock).join('')}</blockquote>`
    case 'ThematicBreak':
      return '<hr>'
    case 'Table':
      return `<table><thead><tr>${block.header.cells.map(cell => `<th>${cell.content.map(previewInline).join('')}</th>`).join('')}</tr></thead><tbody>${block.rows.map(row => `<tr>${row.cells.map(cell => `<td>${cell.content.map(previewInline).join('')}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    case 'BlockComponent':
      return `<section data-component="${escapeHtml(block.name)}">${block.blocks.map(previewBlock).join('')}</section>`
  }
}

const previewPage = (
  page: CompiledPage,
  navigation: string,
): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(page.frontmatter.title)}</title><style>
:root{font-family:Inter,system-ui,sans-serif;color-scheme:light dark}*{box-sizing:border-box}body{margin:0;display:grid;grid-template-columns:17rem minmax(0,1fr);background:#fff;color:#18181b}nav{position:sticky;top:0;height:100vh;overflow:auto;border-right:1px solid #ddd;padding:1rem}nav a{display:block;padding:.4rem .55rem;border-radius:.4rem;color:inherit;text-decoration:none}nav a:hover{background:#eee}main{width:min(52rem,100%);padding:3rem clamp(1rem,4vw,4rem)}h1{font-size:2.25rem}h2{margin-top:2.5rem}p,li{line-height:1.7}pre{overflow:auto;border:1px solid #ddd;border-radius:.6rem;padding:1rem;background:#f7f7f8}code{font-family:"JetBrains Mono",monospace}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:.55rem;text-align:left}@media(prefers-color-scheme:dark){body{background:#18171b;color:#f4f4f5}nav,pre,th,td{border-color:#38363f}nav a:hover,pre{background:#211f25}}@media(max-width:48rem){body{display:block}nav{position:relative;width:100%;height:auto;border-right:0;border-bottom:1px solid #ddd}main{padding:1.5rem}}
</style></head><body><nav>${navigation}</nav><main><h1>${escapeHtml(page.frontmatter.title)}</h1>${page.frontmatter.description === undefined ? '' : `<p>${escapeHtml(page.frontmatter.description)}</p>`}${page.document.blocks
  .filter(
    (block, index) =>
      !(index === 0 && block._tag === 'Heading' && block.level === 1),
  )
  .map(previewBlock)
  .join('')}</main></body></html>`

/** Start a dependency-free live Markdown/MDX preview server. */
export const preview = async (
  options: PreviewOptions,
): Promise<PreviewServer> => {
  const input = path.resolve(options.input)
  const inputStats = await fs.stat(input)
  const root = inputStats.isDirectory() ? input : path.dirname(input)
  const files = inputStats.isDirectory() ? await walk(input) : [input]
  const routes = new Map<string, string>(
    files.map(file => {
      const relative = path.relative(root, file).split(path.sep).join('/')
      const route = relative
        .replace(documentPattern, '')
        .replace(/(^|\/)index$/iu, '$1')
        .replace(/\/$/u, '')
      return [`/${route}`, file] as const
    }),
  )
  const first = files[0]
  if (first === undefined)
    throw new Error(`No Markdown files found in ${input}.`)
  const routeFor = (file: string) =>
    [...routes.entries()].find(([, candidate]) => candidate === file)?.[0] ??
    '/'
  const navigation = files
    .map(
      file =>
        `<a href="${routeFor(file)}">${escapeHtml(path.relative(root, file).replace(documentPattern, ''))}</a>`,
    )
    .join('')
  const server: Server = createServer((request, response) => {
    const pathname = new URL(
      request.url ?? '/',
      'http://foldocs.local',
    ).pathname.replace(/\/$/u, '')
    const file = routes.get(pathname) ?? (pathname === '' ? first : undefined)
    if (file === undefined) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Document not found')
      return
    }
    fs.readFile(file, 'utf8')
      .then(source => compile(source, { filePath: file }))
      .then(page => {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        response.end(previewPage(page, navigation))
      })
      .catch(error => {
        response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        response.end(error instanceof Error ? error.stack : String(error))
      })
  })
  const host = options.host ?? '127.0.0.1'
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port ?? 0, host, () => resolve())
  })
  const address = server.address()
  const port =
    typeof address === 'object' && address !== null ? address.port : 0
  return {
    url: `http://${host}:${String(port)}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close(error =>
          error === undefined ? resolve() : reject(error),
        ),
      ),
  }
}

const customizationTemplates: Readonly<Record<Customization, string>> = {
  theme: `/* Project-owned Foldocs theme overrides. */
:root {
  --fd-primary: #163a2d;
  --fd-accent-700: #247c5b;
  --fd-radius: 0.625rem;
}

.dark {
  --fd-primary: #8dd8b8;
}
`,
  layout: `/* Every docs route exposes data-layout="docs|notebook|flux|glass". */
.fd-root[data-layout="docs"] .fd-article {
  max-width: 58rem;
}

/* Example project-owned slot styling for deterministic MDX components. */
.fd-prose .project-note {
  padding: 1rem;
  border-inline-start: 3px solid var(--fd-primary);
  background: var(--fd-muted);
}
`,
  'mdx-components': `import type { MdxComponents } from "foldocs";
import { inertHtml as h } from "foldkit/html";

/** Merge these project-owned renderers into the registry passed to createDocsProgram. */
export const customMdxComponents: MdxComponents = {
  inline: {
    ProductName: () => h.strong([], ["Your product"]),
  },
  block: {
    Note: (_, content) => h.aside([h.Class("project-note")], content),
  },
};
`,
}

const cssCustomization = (
  component: Customization,
): component is 'theme' | 'layout' => component !== 'mdx-components'

/** Copy stable, project-owned customization entry points without touching package code. */
export const customize = (
  options: CustomizeOptions = {},
): Effect.Effect<CustomizeResult, Error> =>
  Effect.tryPromise({
    try: async () => {
      const root = path.resolve(options.root ?? process.cwd())
      const output = path.resolve(root, options.outputDir ?? 'src/foldocs')
      const components = options.components ?? ['theme', 'layout']
      const unique = [...new Set(components)]
      if (unique.length === 0) throw new TypeError('Select a customization.')
      await fs.mkdir(output, { recursive: true })
      const files: string[] = []
      for (const component of unique) {
        const filename =
          component === 'mdx-components'
            ? 'mdx-components.ts'
            : `${component}.css`
        const target = path.join(output, filename)
        if (!options.force) {
          const exists = await fs.stat(target).then(
            () => true,
            error => {
              if ((error as NodeJS.ErrnoException).code === 'ENOENT')
                return false
              throw error
            },
          )
          if (exists)
            throw new Error(
              `Customization already exists: ${path.relative(root, target)}. Pass --force to replace it.`,
            )
        }
        await fs.writeFile(target, customizationTemplates[component], 'utf8')
        files.push(path.relative(root, target).split(path.sep).join('/'))
      }

      const stylesheet = path.join(root, 'src/styles.css')
      const cssComponents = unique.filter(cssCustomization)
      if (cssComponents.length > 0) {
        const existing = await fs.readFile(stylesheet, 'utf8').catch(error => {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''
          throw error
        })
        const imports = cssComponents.map(component => {
          let relative = path
            .relative(
              path.dirname(stylesheet),
              path.join(output, `${component}.css`),
            )
            .split(path.sep)
            .join('/')
          if (!relative.startsWith('.')) relative = `./${relative}`
          return `@import ${JSON.stringify(relative)};`
        })
        const missing = imports.filter(entry => !existing.includes(entry))
        if (missing.length > 0) {
          const importBlock =
            existing.match(/^(?:@import[^\n]*\n)*/u)?.[0] ?? ''
          await fs.writeFile(
            stylesheet,
            `${importBlock}${missing.join('\n')}\n${existing.slice(importBlock.length)}`,
            'utf8',
          )
        }
      }

      return {
        files,
        stylesheet: path.relative(root, stylesheet).split(path.sep).join('/'),
      }
    },
    catch: cause => (cause instanceof Error ? cause : new Error(String(cause))),
  })

interface CheckedPage {
  readonly file: string
  readonly url: string
  readonly locale?: string
  readonly translationKey: string
  readonly compiled: CompiledPage
}

const documentPattern = /\.(?:md|mdx)$/iu

const walk = async (directory: string): Promise<ReadonlyArray<string>> => {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async entry => {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) return walk(target)
      return entry.isFile() && documentPattern.test(entry.name) ? [target] : []
    }),
  )
  return nested.flat().sort((left, right) => left.localeCompare(right))
}

const normalizeBasePath = (basePath: string): string => {
  const prefixed = basePath.startsWith('/') ? basePath : `/${basePath}`
  return prefixed === '/' ? '' : prefixed.replace(/\/+$/u, '')
}

const pageRoute = (
  contentRoot: string,
  file: string,
  basePath: string,
  locales: ReadonlyArray<string> | undefined,
): {
  readonly url: string
  readonly locale?: string
  readonly translationKey: string
} => {
  const relative = path.relative(contentRoot, file).split(path.sep).join('/')
  const segments = relative.replace(documentPattern, '').split('/')
  const candidateLocale = segments[0]
  const locale =
    candidateLocale !== undefined && locales?.includes(candidateLocale)
      ? candidateLocale
      : undefined
  if (locale !== undefined) segments.shift()
  if (segments.at(-1)?.toLowerCase() === 'index') segments.pop()
  const translationKey = segments
    .filter(segment => !/^\(.+\)$/u.test(segment))
    .join('/')
  const result = [locale, basePath, translationKey].filter(Boolean).join('/')
  return {
    url: (result.startsWith('/') ? result : `/${result}`).replace(
      /\/{2,}/gu,
      '/',
    ),
    ...(locale === undefined ? {} : { locale }),
    translationKey,
  }
}

const linksFromInline = (inline: Inline): ReadonlyArray<string> => {
  switch (inline._tag) {
    case 'Link':
      return [inline.url, ...inline.content.flatMap(linksFromInline)]
    case 'Emphasis':
    case 'Strong':
    case 'Strikethrough':
    case 'InlineComponent':
      return inline.content.flatMap(linksFromInline)
    default:
      return []
  }
}

const linksFromBlock = (block: Block): ReadonlyArray<string> => {
  switch (block._tag) {
    case 'Heading':
    case 'Paragraph':
      return block.content.flatMap(linksFromInline)
    case 'List':
      return block.items.flatMap(item => item.blocks.flatMap(linksFromBlock))
    case 'Blockquote':
      return block.blocks.flatMap(linksFromBlock)
    case 'BlockComponent':
      return [
        ...(block.attributes.href === undefined ? [] : [block.attributes.href]),
        ...block.blocks.flatMap(linksFromBlock),
      ]
    case 'Table':
      return [block.header, ...block.rows].flatMap(row =>
        row.cells.flatMap(cell => cell.content.flatMap(linksFromInline)),
      )
    default:
      return []
  }
}

const targetFor = (
  href: string,
  fromUrl: string,
): { pathname: string; hash: string } | undefined => {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(href)) return undefined
  const target = new URL(href, `https://foldocs.local${fromUrl}`)
  let pathname = target.pathname.replace(documentPattern, '')
  if (pathname.endsWith('/index')) pathname = pathname.slice(0, -6) || '/'
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/u, '')
  return { pathname, hash: target.hash.slice(1) }
}

export const check = (
  options: CheckOptions = {},
): Effect.Effect<CheckResult, Error> =>
  Effect.tryPromise({
    try: async () => {
      const root = path.resolve(options.root ?? process.cwd())
      const contentRoot = path.resolve(
        root,
        options.contentDir ?? 'content/docs',
      )
      const basePath = normalizeBasePath(options.basePath ?? '/docs')
      const locales = options.locales?.filter(Boolean)
      const fallbackLocale = options.fallbackLocale ?? locales?.[0]
      if (fallbackLocale !== undefined && !locales?.includes(fallbackLocale))
        throw new TypeError(
          `Fallback locale ${fallbackLocale} is not listed in locales.`,
        )
      const files = await walk(contentRoot)
      const issues: CheckIssue[] = []
      const pages: CheckedPage[] = []

      for (const file of files) {
        try {
          const source = await fs.readFile(file, 'utf8')
          const route = pageRoute(contentRoot, file, basePath, locales)
          pages.push({
            file,
            ...route,
            compiled: await compile(source, {
              filePath: file,
              highlight: false,
            }),
          })
        } catch (error) {
          issues.push({
            level: 'error',
            file: path.relative(root, file),
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }

      const byUrl = new Map<string, CheckedPage>()
      for (const page of pages) {
        const duplicate = byUrl.get(page.url)
        if (duplicate !== undefined) {
          issues.push({
            level: 'error',
            file: path.relative(root, page.file),
            message: `Duplicate route ${page.url}; already generated by ${path.relative(root, duplicate.file)}.`,
          })
        } else {
          byUrl.set(page.url, page)
        }
      }

      if (locales !== undefined && fallbackLocale !== undefined) {
        const fallbackPages = pages.filter(
          page => page.locale === fallbackLocale,
        )
        for (const locale of locales) {
          for (const fallbackPage of fallbackPages) {
            if (
              pages.some(
                page =>
                  page.locale === locale &&
                  page.translationKey === fallbackPage.translationKey,
              )
            )
              continue
            const url = [locale, basePath, fallbackPage.translationKey]
              .filter(Boolean)
              .join('/')
              .replace(/\/{2,}/gu, '/')
            byUrl.set(url.startsWith('/') ? url : `/${url}`, {
              ...fallbackPage,
              locale,
              url: url.startsWith('/') ? url : `/${url}`,
            })
          }
        }
      }

      const isDocumentationPath = (pathname: string): boolean =>
        locales === undefined
          ? pathname.startsWith(basePath || '/')
          : locales.some(locale =>
              pathname.startsWith(`/${locale}${basePath || '/'}`),
            )

      for (const page of pages) {
        const links = page.compiled.document.blocks.flatMap(linksFromBlock)
        for (const href of links) {
          const target = targetFor(href, page.url)
          if (target === undefined || !isDocumentationPath(target.pathname))
            continue
          const targetPage = byUrl.get(target.pathname)
          if (targetPage === undefined) {
            issues.push({
              level: 'error',
              file: path.relative(root, page.file),
              message: `Broken documentation link ${href}.`,
            })
            continue
          }
          if (target.hash.length > 0) {
            const headingIds = new Set(
              targetPage.compiled.document.blocks.flatMap(block =>
                block._tag === 'Heading' ? [block.id] : [],
              ),
            )
            if (!headingIds.has(decodeURIComponent(target.hash))) {
              issues.push({
                level: 'error',
                file: path.relative(root, page.file),
                message: `Broken heading link ${href}.`,
              })
            }
          }
        }
      }

      return {
        pages: pages.length,
        issues,
        valid: issues.every(issue => issue.level !== 'error'),
      }
    },
    catch: cause => (cause instanceof Error ? cause : new Error(String(cause))),
  })

export interface AuditOptions extends CheckOptions {
  readonly checkLinks?: boolean
  readonly checkSeo?: boolean
  readonly checkAccessibility?: boolean
  readonly checkPerformance?: boolean
  readonly checkSecurity?: boolean
}

export interface AuditIssue extends CheckIssue {
  readonly category: 'links' | 'seo' | 'accessibility' | 'performance' | 'security' | 'content'
  readonly impact?: 'critical' | 'serious' | 'moderate' | 'minor'
}

export interface AuditResult {
  readonly pages: number
  readonly issues: ReadonlyArray<AuditIssue>
  readonly summary: {
    readonly critical: number
    readonly serious: number
    readonly moderate: number
    readonly minor: number
  }
  readonly valid: boolean
}

const estimateReadingTime = (text: string): number => {
  const wordsPerMinute = 200
  const words = text.split(/\s+/).length
  return Math.ceil(words / wordsPerMinute)
}

const countSyllables = (word: string): number => {
  const lower = word.toLowerCase()
  if (lower.length <= 3) return 1
  const vowels = lower.match(/[aeiouy]+/g)
  return vowels?.length ?? 1
}

const fleschKincaidGrade = (text: string): number => {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const words = text.split(/\s+/).filter(w => w.length > 0)
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0)
  if (sentences.length === 0 || words.length === 0) return 0
  return (
    0.39 * (words.length / sentences.length) +
    11.8 * (syllables / words.length) -
    15.59
  )
}

export const audit = (
  options: AuditOptions = {},
): Effect.Effect<AuditResult, Error> =>
  Effect.tryPromise({
    try: async () => {
      const root = path.resolve(options.root ?? process.cwd())
      const contentRoot = path.resolve(
        root,
        options.contentDir ?? 'content/docs',
      )
      const basePath = normalizeBasePath(options.basePath ?? '/docs')
      const locales = options.locales?.filter(Boolean)
      const fallbackLocale = options.fallbackLocale ?? locales?.[0]
      const files = await walk(contentRoot)
      const issues: AuditIssue[] = []
      const pages: CheckedPage[] = []

      for (const file of files) {
        try {
          const source = await fs.readFile(file, 'utf8')
          const route = pageRoute(contentRoot, file, basePath, locales)
          pages.push({
            file,
            ...route,
            compiled: await compile(source, {
              filePath: file,
              highlight: false,
            }),
          })
        } catch (error) {
          issues.push({
            level: 'error',
            file: path.relative(root, file),
            message: error instanceof Error ? error.message : String(error),
            category: 'content',
            impact: 'critical',
          })
        }
      }

      const byUrl = new Map<string, CheckedPage>()
      for (const page of pages) {
        const duplicate = byUrl.get(page.url)
        if (duplicate !== undefined) {
          issues.push({
            level: 'error',
            file: path.relative(root, page.file),
            message: `Duplicate route ${page.url}; already generated by ${path.relative(root, duplicate.file)}.`,
            category: 'content',
            impact: 'critical',
          })
        } else {
          byUrl.set(page.url, page)
        }
      }

      // SEO checks
      if (options.checkSeo !== false) {
        for (const page of pages) {
          const frontmatter = page.compiled.frontmatter
          if (!frontmatter.title || frontmatter.title.length === 0) {
            issues.push({
              level: 'error',
              file: path.relative(root, page.file),
              message: 'Missing page title in frontmatter.',
              category: 'seo',
              impact: 'critical',
            })
          } else if (frontmatter.title.length > 60) {
            issues.push({
              level: 'warning',
              file: path.relative(root, page.file),
              message: `Title is ${frontmatter.title.length} characters (recommended: 60 or fewer).`,
              category: 'seo',
              impact: 'moderate',
            })
          }
          if (!frontmatter.description || frontmatter.description.length === 0) {
            issues.push({
              level: 'warning',
              file: path.relative(root, page.file),
              message: 'Missing page description in frontmatter.',
              category: 'seo',
              impact: 'serious',
            })
          } else if (frontmatter.description.length > 160) {
            issues.push({
              level: 'warning',
              file: path.relative(root, page.file),
              message: `Description is ${frontmatter.description.length} characters (recommended: 160 or fewer).`,
              category: 'seo',
              impact: 'moderate',
            })
          }
          if (!frontmatter.socialImage) {
            issues.push({
              level: 'warning',
              file: path.relative(root, page.file),
              message: 'Missing social image for social media previews.',
              category: 'seo',
              impact: 'moderate',
            })
          }
          if (!frontmatter.keywords || frontmatter.keywords.length === 0) {
            issues.push({
              level: 'warning',
              file: path.relative(root, page.file),
              message: 'Missing keywords for search discoverability.',
              category: 'seo',
              impact: 'minor',
            })
          }
        }
      }

      // Content quality checks
      for (const page of pages) {
        const text = page.compiled.document.blocks
          .filter(block => block._tag === 'Paragraph')
          .map(block =>
            block.content
              .filter(inline => inline._tag === 'Text')
              .map(inline => inline.value)
              .join(''),
          )
          .join(' ')
        const readingTime = estimateReadingTime(text)
        if (readingTime > 20) {
          issues.push({
            level: 'warning',
            file: path.relative(root, page.file),
            message: `Estimated reading time is ${readingTime} minutes. Consider splitting into shorter pages.`,
            category: 'content',
            impact: 'moderate',
          })
        }
        const grade = fleschKincaidGrade(text)
        if (grade > 12) {
          issues.push({
            level: 'warning',
            file: path.relative(root, page.file),
            message: `Reading grade level is ${grade.toFixed(1)} (target: 8-10). Simplify language.`,
            category: 'content',
            impact: 'moderate',
          })
        }
      }

      // Link checks
      if (options.checkLinks !== false) {
        for (const page of pages) {
          const links = page.compiled.document.blocks.flatMap(linksFromBlock)
          for (const href of links) {
            const target = targetFor(href, page.url)
            if (target === undefined) continue
            const targetPage = byUrl.get(target.pathname)
            if (targetPage === undefined) {
              issues.push({
                level: 'error',
                file: path.relative(root, page.file),
                message: `Broken documentation link ${href}.`,
                category: 'links',
                impact: 'critical',
              })
            }
          }
        }
      }

      // Accessibility checks
      if (options.checkAccessibility !== false) {
        for (const page of pages) {
          const headings = page.compiled.document.blocks
            .filter(block => block._tag === 'Heading')
            .map(block => ({ level: block.level, id: block.id }))
          let previousLevel = 0
          for (const heading of headings) {
            if (heading.level > previousLevel + 1) {
              issues.push({
                level: 'warning',
                file: path.relative(root, page.file),
                message: `Heading level skipped from H${String(previousLevel)} to H${String(heading.level)}.`,
                category: 'accessibility',
                impact: 'serious',
              })
            }
            previousLevel = heading.level
          }
        }
      }

      // Security checks
      if (options.checkSecurity !== false) {
        for (const page of pages) {
          const links = page.compiled.document.blocks.flatMap(linksFromBlock)
          for (const href of links) {
            if (href.startsWith('http://')) {
              issues.push({
                level: 'warning',
                file: path.relative(root, page.file),
                message: `Insecure HTTP link: ${href}. Use HTTPS.`,
                category: 'security',
                impact: 'moderate',
              })
            }
          }
        }
      }

      const summary = {
        critical: issues.filter(i => i.impact === 'critical').length,
        serious: issues.filter(i => i.impact === 'serious').length,
        moderate: issues.filter(i => i.impact === 'moderate').length,
        minor: issues.filter(i => i.impact === 'minor').length,
      }

      return {
        pages: pages.length,
        issues,
        summary,
        valid: issues.every(issue => issue.impact !== 'critical'),
      }
    },
    catch: cause => (cause instanceof Error ? cause : new Error(String(cause))),
  })

export interface EvalOptions extends CheckOptions {
  /** AI endpoint to use for evaluation */
  readonly endpoint?: string
  /** API key for the AI provider */
  readonly apiKey?: string
  /** Models to evaluate with */
  readonly models?: ReadonlyArray<string>
  /** Maximum concurrent evaluations */
  readonly concurrency?: number
  /** Output format for results */
  readonly format?: 'json' | 'markdown' | 'html'
  /** Output file path */
  readonly output?: string
}

export interface EvalTest {
  readonly id: string
  readonly name: string
  readonly category: 'accuracy' | 'completeness' | 'clarity' | 'consistency' | 'examples'
  readonly prompt: string
  readonly expectedBehavior: string
}

export interface EvalResult {
  readonly testId: string
  readonly testName: string
  readonly category: string
  readonly passed: boolean
  readonly score: number
  readonly reasoning: string
  readonly suggestions: ReadonlyArray<string>
}

export interface EvalReport {
  readonly timestamp: string
  readonly totalPages: number
  readonly totalTests: number
  readonly passed: number
  readonly failed: number
  readonly score: number
  readonly results: ReadonlyArray<EvalResult>
  readonly summary: {
    readonly accuracy: number
    readonly completeness: number
    readonly clarity: number
    readonly consistency: number
    readonly examples: number
  }
}

const defaultEvalTests: ReadonlyArray<EvalTest> = [
  {
    id: 'accuracy-001',
    name: 'Technical Accuracy',
    category: 'accuracy',
    prompt: 'Review this documentation page for technical accuracy. Check if the code examples are correct, API descriptions match the actual behavior, and any claims are verifiable.',
    expectedBehavior: 'All code examples should be syntactically correct and demonstrate the described functionality.',
  },
  {
    id: 'completeness-001',
    name: 'API Coverage',
    category: 'completeness',
    prompt: 'Check if this documentation page covers all the important aspects of the topic. Are there any missing sections, parameters, return types, or edge cases?',
    expectedBehavior: 'Documentation should cover the main use cases, parameters, return values, and common edge cases.',
  },
  {
    id: 'clarity-001',
    name: 'Readability',
    category: 'clarity',
    prompt: 'Evaluate the readability of this documentation. Is the language clear? Are sentences concise? Is the structure logical?',
    expectedBehavior: 'Documentation should be easy to understand for the target audience.',
  },
  {
    id: 'consistency-001',
    name: 'Style Consistency',
    category: 'consistency',
    prompt: 'Check if the documentation follows consistent style conventions. Are headings formatted the same way? Is terminology used consistently?',
    expectedBehavior: 'Documentation should maintain consistent formatting and terminology throughout.',
  },
  {
    id: 'examples-001',
    name: 'Code Examples',
    category: 'examples',
    prompt: 'Review the code examples in this documentation. Are they complete? Do they demonstrate real-world usage? Are they easy to follow?',
    expectedBehavior: 'Code examples should be complete, runnable, and demonstrate practical usage.',
  },
]

const callAiEndpoint = async (
  endpoint: string,
  apiKey: string | undefined,
  prompt: string,
  content: string,
): Promise<string> => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey !== undefined ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: 'You are a documentation quality evaluator. Analyze the provided documentation and give a score from 0-100 with detailed reasoning.',
        },
        {
          role: 'user',
          content: `${prompt}\n\n---\n\nDocumentation content:\n${content}`,
        },
      ],
      max_tokens: 1000,
    }),
  })
  if (!response.ok) {
    throw new Error(`AI endpoint returned ${response.status}`)
  }
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content ?? ''
}

const parseAiResponse = (
  response: string,
  testId: string,
  testName: string,
  category: string,
): EvalResult => {
  const scoreMatch = response.match(/(?:score|rating)[:\s]*(\d+)/i)
  const score = scoreMatch !== null && scoreMatch[1] !== undefined ? parseInt(scoreMatch[1], 10) : 50
  const passed = score >= 70
  const suggestions = response
    .split('\n')
    .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(s => s.length > 0)
  return {
    testId,
    testName,
    category,
    passed,
    score,
    reasoning: response,
    suggestions,
  }
}

export const eval_ = (
  options: EvalOptions = {},
): Effect.Effect<EvalReport, Error> =>
  Effect.tryPromise({
    try: async () => {
      const root = path.resolve(options.root ?? process.cwd())
      const contentRoot = path.resolve(
        root,
        options.contentDir ?? 'content/docs',
      )
      const basePath = normalizeBasePath(options.basePath ?? '/docs')
      const locales = options.locales?.filter(Boolean)
      const fallbackLocale = options.fallbackLocale ?? locales?.[0]
      const endpoint = options.endpoint ?? process.env.FOLDOCS_AI_ENDPOINT
      const apiKey = options.apiKey ?? process.env.FOLDOCS_AI_API_KEY
      const concurrency = options.concurrency ?? 3
      if (endpoint === undefined) {
        throw new Error(
          'AI endpoint is required. Set --endpoint or FOLDOCS_AI_ENDPOINT environment variable.',
        )
      }
      const files = await walk(contentRoot)
      const pages: CheckedPage[] = []
      const issues: EvalResult[] = []
      for (const file of files) {
        try {
          const source = await fs.readFile(file, 'utf8')
          const route = pageRoute(contentRoot, file, basePath, locales)
          pages.push({
            file,
            ...route,
            compiled: await compile(source, {
              filePath: file,
              highlight: false,
            }),
          })
        } catch (error) {
          issues.push({
            testId: 'compile-error',
            testName: 'Page Compilation',
            category: 'accuracy',
            passed: false,
            score: 0,
            reasoning: error instanceof Error ? error.message : String(error),
            suggestions: ['Fix the compilation error before evaluating.'],
          })
        }
      }
      const tests = options.models !== undefined
        ? defaultEvalTests.filter(test =>
            options.models!.some(model => test.id.startsWith(model)),
          )
        : defaultEvalTests
      const evaluatePage = async (
        page: CheckedPage,
      ): Promise<ReadonlyArray<EvalResult>> => {
        const content = page.compiled.document.blocks
          .map(block => {
            if (block._tag === 'Heading') return `# ${block.id}`
            if (block._tag === 'Paragraph') {
              return block.content
                .map(inline => {
                  if (inline._tag === 'Text') return inline.value
                  if (inline._tag === 'InlineCode') return `\`${inline.value}\``
                  return ''
                })
                .join('')
            }
            return ''
          })
          .filter(Boolean)
          .join('\n\n')
        const results: EvalResult[] = []
        for (const test of tests) {
          try {
            const response = await callAiEndpoint(endpoint, apiKey, test.prompt, content)
            results.push(
              parseAiResponse(response, test.id, test.name, test.category),
            )
          } catch (error) {
            results.push({
              testId: test.id,
              testName: test.name,
              category: test.category,
              passed: false,
              score: 0,
              reasoning: error instanceof Error ? error.message : String(error),
              suggestions: ['Retry the evaluation.'],
            })
          }
        }
        return results
      }
      const allResults: EvalResult[] = [...issues]
      for (let i = 0; i < pages.length; i += concurrency) {
        const batch = pages.slice(i, i + concurrency)
        const batchResults = await Promise.all(
          batch.map(page => evaluatePage(page)),
        )
        allResults.push(...batchResults.flat())
      }
      const passed = allResults.filter(r => r.passed).length
      const failed = allResults.filter(r => !r.passed).length
      const avgScore =
        allResults.length > 0
          ? allResults.reduce((sum, r) => sum + r.score, 0) / allResults.length
          : 0
      const categoryScores = {
        accuracy: 0,
        completeness: 0,
        clarity: 0,
        consistency: 0,
        examples: 0,
      }
      const categoryCounts = {
        accuracy: 0,
        completeness: 0,
        clarity: 0,
        consistency: 0,
        examples: 0,
      }
      for (const result of allResults) {
        const cat = result.category as keyof typeof categoryScores
        if (cat in categoryScores) {
          categoryScores[cat] += result.score
          categoryCounts[cat]++
        }
      }
      return {
        timestamp: new Date().toISOString(),
        totalPages: pages.length,
        totalTests: allResults.length,
        passed,
        failed,
        score: Math.round(avgScore),
        results: allResults,
        summary: {
          accuracy:
            categoryCounts.accuracy > 0
              ? Math.round(categoryScores.accuracy / categoryCounts.accuracy)
              : 0,
          completeness:
            categoryCounts.completeness > 0
              ? Math.round(categoryScores.completeness / categoryCounts.completeness)
              : 0,
          clarity:
            categoryCounts.clarity > 0
              ? Math.round(categoryScores.clarity / categoryCounts.clarity)
              : 0,
          consistency:
            categoryCounts.consistency > 0
              ? Math.round(categoryScores.consistency / categoryCounts.consistency)
              : 0,
          examples:
            categoryCounts.examples > 0
              ? Math.round(categoryScores.examples / categoryCounts.examples)
              : 0,
        },
      }
    },
    catch: cause => (cause instanceof Error ? cause : new Error(String(cause))),
  })

export const formatEvalReport = (
  report: EvalReport,
  format: 'json' | 'markdown' | 'html' = 'markdown',
): string => {
  if (format === 'json') {
    return JSON.stringify(report, null, 2)
  }
  if (format === 'html') {
    return `<!DOCTYPE html>
<html>
<head>
  <title>Foldocs Eval Report</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin: 2rem 0; }
    .metric { text-align: center; padding: 1rem; border: 1px solid #ddd; border-radius: 0.5rem; }
    .metric-value { font-size: 2rem; font-weight: bold; }
    .metric-label { font-size: 0.875rem; color: #666; }
    .passed { color: #16a34a; }
    .failed { color: #dc2626; }
    .result { margin: 1rem 0; padding: 1rem; border: 1px solid #ddd; border-radius: 0.5rem; }
    .result-header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
    .score { font-weight: bold; }
  </style>
</head>
<body>
  <h1>Foldocs Eval Report</h1>
  <p>Generated: ${report.timestamp}</p>
  <p>Pages: ${report.totalPages} | Tests: ${report.totalTests} | Score: ${report.score}%</p>
  <div class="summary">
    <div class="metric">
      <div class="metric-value">${String(report.summary.accuracy)}%</div>
      <div class="metric-label">Accuracy</div>
    </div>
    <div class="metric">
      <div class="metric-value">${String(report.summary.completeness)}%</div>
      <div class="metric-label">Completeness</div>
    </div>
    <div class="metric">
      <div class="metric-value">${String(report.summary.clarity)}%</div>
      <div class="metric-label">Clarity</div>
    </div>
    <div class="metric">
      <div class="metric-value">${String(report.summary.consistency)}%</div>
      <div class="metric-label">Consistency</div>
    </div>
    <div class="metric">
      <div class="metric-value">${String(report.summary.examples)}%</div>
      <div class="metric-label">Examples</div>
    </div>
  </div>
  <h2>Results</h2>
  ${report.results
    .map(
      result => `
  <div class="result">
    <div class="result-header">
      <strong>${result.testName}</strong>
      <span class="score ${result.passed ? 'passed' : 'failed'}">${String(result.score)}%</span>
    </div>
    <p>${result.reasoning.slice(0, 200)}...</p>
    ${result.suggestions.length > 0 ? `<p><strong>Suggestions:</strong> ${result.suggestions.slice(0, 3).join('; ')}</p>` : ''}
  </div>`,
    )
    .join('')}
</body>
</html>`
  }
  const lines = [
    '# Foldocs Eval Report',
    '',
    `**Generated:** ${report.timestamp}`,
    `**Pages:** ${report.totalPages} | **Tests:** ${report.totalTests} | **Score:** ${report.score}%`,
    '',
    '## Summary',
    '',
    `| Category | Score |`,
    `|----------|-------|`,
    `| Accuracy | ${String(report.summary.accuracy)}% |`,
    `| Completeness | ${String(report.summary.completeness)}% |`,
    `| Clarity | ${String(report.summary.clarity)}% |`,
    `| Consistency | ${String(report.summary.consistency)}% |`,
    `| Examples | ${String(report.summary.examples)}% |`,
    '',
    '## Results',
    '',
  ]
  for (const result of report.results) {
    lines.push(`### ${result.testName}`)
    lines.push('')
    lines.push(`**Score:** ${String(result.score)}% | **Status:** ${result.passed ? '✅ Passed' : '❌ Failed'}`)
    lines.push('')
    lines.push(result.reasoning.slice(0, 300))
    lines.push('')
    if (result.suggestions.length > 0) {
      lines.push('**Suggestions:**')
      for (const suggestion of result.suggestions.slice(0, 3)) {
        lines.push(`- ${suggestion}`)
      }
      lines.push('')
    }
  }
  return lines.join('\n')
}
