import type { CodeHighlighter } from 'foldocs-mdx'
import { codeToHtml } from 'shiki'

import {
  type TransformerTwoslashIndexOptions,
  transformerTwoslash,
} from '@shikijs/twoslash'

export interface FoldocsTwoslashOptions extends Omit<
  TransformerTwoslashIndexOptions,
  'explicitTrigger'
> {
  /** Require the `twoslash` code-fence meta flag. @default true */
  readonly explicitTrigger?: boolean | RegExp
}

const typeScriptLanguages = new Set([
  'ts',
  'tsx',
  'typescript',
  'js',
  'jsx',
  'javascript',
])

/** Build-time Shiki highlighter with compiler-powered type hovers and diagnostics. */
export const createTwoslashHighlighter = (
  options: FoldocsTwoslashOptions = {},
): CodeHighlighter => {
  const explicitTrigger = options.explicitTrigger ?? true
  const transformer = transformerTwoslash({
    ...options,
    explicitTrigger,
  })
  return async ({ value, language, meta }) => {
    if (!typeScriptLanguages.has(language.toLowerCase())) return undefined
    if (
      explicitTrigger === true &&
      !(meta ?? '')
        .split(/\s+/u)
        .some(entry => entry.toLowerCase() === 'twoslash')
    )
      return undefined
    return (
      await codeToHtml(value, {
        lang: language,
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultColor: false,
        meta: { __raw: meta ?? '' },
        transformers: [transformer],
      })
    ).replaceAll(
      '<span class="twoslash-hover">',
      '<span class="twoslash-hover" tabindex="0">',
    )
  }
}

export type { CodeHighlighter } from 'foldocs-mdx'
