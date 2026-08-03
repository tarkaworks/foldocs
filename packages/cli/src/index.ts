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
