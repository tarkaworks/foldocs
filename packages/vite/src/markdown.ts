import type { ResolvedLandingConfig, SiteConfig } from 'foldocs-core'
import {
  type CompiledPage,
  type Document,
  documentToMarkdown,
} from 'foldocs-mdx'

import type { PageMetadata } from '@foldocs/content'

export interface MarkdownPage {
  readonly metadata: PageMetadata
  readonly compiled: CompiledPage
}

export interface PageMarkdownOptions {
  /** Emits a provenance frontmatter block (url, locale, breadcrumbs, version, ...). Default: `false`. */
  readonly frontmatter?: boolean
  /** Ancestor navigation labels, in display order, for the frontmatter block. */
  readonly breadcrumbs?: ReadonlyArray<string>
  /** Product version stamped into the frontmatter block. */
  readonly version?: string
}

const yamlScalar = (value: string): string => JSON.stringify(value)

const yamlSequence = (values: ReadonlyArray<string>): string =>
  `[${values.map(yamlScalar).join(', ')}]`

/** Provenance frontmatter for a generated `.md` asset: see issue #5. */
const pageMarkdownFrontmatter = (
  site: SiteConfig,
  metadata: PageMetadata,
  options: PageMarkdownOptions,
): string => {
  const url =
    site.baseUrl === undefined
      ? metadata.url
      : new URL(
          metadata.url.replace(/^\//u, ''),
          `${site.baseUrl.replace(/\/+$/u, '')}/`,
        ).toString()
  const lines = [
    `url: ${yamlScalar(url)}`,
    `title: ${yamlScalar(metadata.frontmatter.title)}`,
    ...(metadata.frontmatter.description === undefined
      ? []
      : [`description: ${yamlScalar(metadata.frontmatter.description)}`]),
    ...(metadata.locale === undefined
      ? []
      : [`locale: ${yamlScalar(metadata.locale)}`]),
    ...(options.breadcrumbs === undefined || options.breadcrumbs.length === 0
      ? []
      : [`breadcrumbs: ${yamlSequence(options.breadcrumbs)}`]),
    ...(metadata.lastModified === undefined
      ? []
      : [`lastModified: ${yamlScalar(metadata.lastModified)}`]),
    ...(options.version === undefined
      ? []
      : [`version: ${yamlScalar(options.version)}`]),
  ]
  return `---\n${lines.join('\n')}\n---\n`
}

const trimPath = (pathname: string): string => {
  if (pathname === '/') return pathname
  return pathname.replace(/\/+$/u, '')
}

/** Foldkit convention: `/guide` -> `guide.md`, `/` -> `index.md`. */
export const markdownAssetPath = (urlPath: string): string => {
  const pathname = trimPath(urlPath.split(/[?#]/u, 1)[0] ?? urlPath)
  return pathname === '/'
    ? 'index.md'
    : `${pathname.replace(/^\/+|\/+$/gu, '')}.md`
}

/** Resolves an appended `.md` URL back to its documentation route. */
export const pageUrlFromMarkdownPath = (
  pathname: string,
): string | undefined => {
  const clean = trimPath(pathname)
  if (clean === '/index.md') return '/'
  if (!clean.toLowerCase().endsWith('.md')) return undefined
  const pageUrl = clean.slice(0, -3)
  return pageUrl.length === 0 ? '/' : pageUrl
}

const markdownMediaTypes = new Set([
  'text/plain',
  'text/markdown',
  'text/x-markdown',
])

/** Mirrors Fumadocs' Markdown content negotiation without a server dependency. */
export const isMarkdownPreferred = (accept: string | undefined): boolean =>
  (accept ?? '')
    .split(',')
    .map(part => part.trim().split(';'))
    .some(([type, ...parameters]) => {
      if (type === undefined || !markdownMediaTypes.has(type.toLowerCase()))
        return false
      const quality = parameters
        .map(parameter => parameter.trim())
        .find(parameter => parameter.startsWith('q='))
      return quality === undefined || Number(quality.slice(2)) > 0
    })

const withoutLeadingTitle = (page: CompiledPage): Document => ({
  blocks:
    page.document.blocks[0]?._tag === 'Heading' &&
    page.document.blocks[0].level === 1
      ? page.document.blocks.slice(1)
      : page.document.blocks,
})

/** Produces the processed, agent-readable sibling served at `<page>.md`. */
export const makePageMarkdown = (
  site: SiteConfig,
  { metadata, compiled }: MarkdownPage,
  options: PageMarkdownOptions = {},
): string => {
  const body = documentToMarkdown(withoutLeadingTitle(compiled), {
    ...(site.baseUrl === undefined ? {} : { baseUrl: site.baseUrl }),
  }).trim()
  const page = `${[
    `# ${metadata.frontmatter.title}`,
    metadata.frontmatter.description,
    body.length === 0 ? undefined : body,
  ]
    .filter((value): value is string => value !== undefined)
    .join('\n\n')}\n`
  return options.frontmatter === true
    ? `${pageMarkdownFrontmatter(site, metadata, options)}\n${page}`
    : page
}

/** Markdown representation of Foldocs' built-in `/` landing page. */
export const makeLandingMarkdown = (
  site: SiteConfig,
  docsUrl: string,
  landing?: ResolvedLandingConfig,
): string => {
  const href =
    site.baseUrl === undefined
      ? docsUrl
      : new URL(
          docsUrl.replace(/^\//u, ''),
          `${site.baseUrl.replace(/\/+$/u, '')}/`,
        ).toString()
  const description =
    landing?.description ??
    site.tagline ??
    site.description ??
    'Beautiful, searchable, LLM-ready documentation for Foldkit, powered by Effect.'
  const headline =
    landing?.headline ?? 'The documentation framework for Foldkit.'
  const command = landing?.command ?? 'pnpm create foldocs@latest'
  return `# ${site.title}

> ${description}

${headline}

## Get started

\`\`\`sh
${command}
\`\`\`

[Read the documentation](${href})

## What you get

- Markdown and deterministic MDX content
- A Foldkit-native application shell, routing, and documentation layout
- An Effect-powered runtime for state, search, and failures
- Local search and hosted-provider adapters
- Per-page Markdown, \`llms.txt\`, \`llms-full.txt\`, and sitemap output
`
}
