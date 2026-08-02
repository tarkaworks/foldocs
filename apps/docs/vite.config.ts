import { defineConfig } from 'vite'

import { foldkit } from '@foldkit/vite-plugin'
import { createTwoslashHighlighter } from '@foldocs/twoslash'
import { foldocs } from '@foldocs/vite'

import docs from './foldocs.config.js'
import {
  markdownIslandDefinitions,
  markdownIslands,
} from './src/markdown-islands.js'
import { mdxComponents } from './src/mdx-components.js'

export default defineConfig({
  plugins: [
    foldocs({
      ...docs,
      components: mdxComponents,
      islands: markdownIslands,
      markdownOptions: { islands: markdownIslandDefinitions },
      highlightCode: createTwoslashHighlighter(),
    }),
    foldkit({ devToolsMcpPort: 9988 }),
  ],
  build: {
    rolldownOptions: {
      output: {
        manualChunks: id => {
          if (
            id.includes('/node_modules/.pnpm/effect@') ||
            id.includes('/node_modules/effect/')
          )
            return 'effect'
          if (
            id.includes('/node_modules/.pnpm/foldkit@') ||
            id.includes('/node_modules/foldkit/')
          )
            return 'foldkit'
          return undefined
        },
      },
    },
  },
})
