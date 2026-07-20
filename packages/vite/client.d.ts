declare module "virtual:foldocs" {
  import type { PageManifest } from "foldocs-core";
  import type { CompiledPage } from "foldocs-mdx";

  export const manifest: PageManifest<CompiledPage>;
  export const navigation: import("foldocs-core").NavigationNode[];
  export const navigations: Readonly<
    Record<string, import("foldocs-core").NavigationNode[]>
  >;
  export const navigationMeta: import("foldocs-core").NavigationMetaMap;
  export const navigationMetas: Readonly<
    Record<string, import("foldocs-core").NavigationMetaMap>
  >;
  export const siteConfig: import("foldocs-core").SiteConfig;
  export const i18n: import("foldocs-core").ResolvedI18nConfig;
  export const basePath: string;
  export const layout: import("foldocs-core").ResolvedFoldocsConfig["layout"];
  export const landing: import("foldocs-core").ResolvedLandingConfig;
  export const markdown: boolean;
  export const searchIndexUrls: Readonly<Record<string, string>>;
  export default manifest;
}
