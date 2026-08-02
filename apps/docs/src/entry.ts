import { Runtime } from 'foldkit'
import { createDocsProgram, preloadDocsPage } from 'foldocs'
import {
  basePath,
  i18n,
  landing,
  layout,
  manifest,
  markdown,
  navigations,
  searchIndexUrls,
  siteConfig,
} from 'virtual:foldocs'

import { overlay } from '@foldkit/devtools'
import { inject } from '@vercel/analytics'

import { markdownIslands } from './markdown-islands.js'
import { mdxComponents } from './mdx-components.js'

inject({ mode: import.meta.env.PROD ? 'production' : 'development' })

const preloadedPage = await preloadDocsPage(
  manifest,
  i18n,
  window.location.pathname,
)

const program = createDocsProgram({
  manifest,
  basePath,
  i18n,
  landing,
  layoutPreset: layout.preset,
  navigations,
  site: siteConfig,
  markdown,
  islands: markdownIslands,
  components: mdxComponents,
  searchIndexUrls,
  ...(preloadedPage === undefined ? {} : { preloadedPage }),
})

const application = Runtime.makeApplication({
  Model: program.Model,
  init: program.init,
  update: program.update,
  view: program.view,
  subscriptions: program.subscriptions,
  routing: program.routing,
  devTools: { overlay, Message: program.Message },
  container: document.getElementById('root'),
})

Runtime.run(application)
