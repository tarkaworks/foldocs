declare module "virtual:effectdocs" {
  import type { PageManifest } from "effectdocs-core";
  import type { CompiledPage } from "effectdocs-mdx";

  export const manifest: PageManifest<CompiledPage>;
  export const siteConfig: import("effectdocs-core").SiteConfig;
  export const basePath: string;
  export default manifest;
}
