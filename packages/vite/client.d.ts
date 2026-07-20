declare module "virtual:effectdocs" {
  import type { PageManifest } from "effectdocs-core";
  import type { CompiledPage } from "effectdocs-mdx";

  export const manifest: PageManifest<CompiledPage>;
  export const navigation: import("effectdocs-core").NavigationNode[];
  export const navigationMeta: import("effectdocs-core").NavigationMetaMap;
  export const siteConfig: import("effectdocs-core").SiteConfig;
  export const basePath: string;
  export const markdown: boolean;
  export default manifest;
}
