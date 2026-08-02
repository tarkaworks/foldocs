import { Effect } from 'effect'
import {
  type Block,
  type CompiledPage,
  type Inline,
  compile,
} from 'foldocs-mdx'
import { promises as fs } from 'node:fs'
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
