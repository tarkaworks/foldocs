import { manifest, siteConfig } from "virtual:effectdocs";
import { createDocsProgram } from "effectdocs";
import { Runtime } from "foldkit";

const program = createDocsProgram({ manifest, site: siteConfig });

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
