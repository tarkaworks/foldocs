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
} from "virtual:foldocs";
import { createDocsProgram } from "foldocs";
import { Runtime } from "foldkit";

import { mdxComponents } from "./mdx-components.js";

const program = createDocsProgram({
  manifest,
  basePath,
  i18n,
  landing,
  layoutPreset: layout.preset,
  navigations,
  site: siteConfig,
  markdown,
  components: mdxComponents,
  searchIndexUrls,
});

const application = Runtime.makeApplication({
  Model: program.Model,
  init: program.init,
  update: program.update,
  view: program.view,
  subscriptions: program.subscriptions,
  routing: program.routing,
  container: document.getElementById("root"),
});

Runtime.run(application);
