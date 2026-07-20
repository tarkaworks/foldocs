import { Schema as S } from "effect";

export const SiteConfig = S.Struct({
  title: S.String,
  description: S.optionalKey(S.String),
  baseUrl: S.optionalKey(S.String),
  logoText: S.optionalKey(S.String),
  badge: S.optionalKey(S.String),
  tagline: S.optionalKey(S.String),
  githubUrl: S.optionalKey(S.String),
  discordUrl: S.optionalKey(S.String),
  xUrl: S.optionalKey(S.String),
  npmUrl: S.optionalKey(S.String),
  keywords: S.optionalKey(S.Array(S.String)),
  socialImage: S.optionalKey(S.String),
  favicon: S.optionalKey(S.String),
  locale: S.optionalKey(S.String),
});
export type SiteConfig = typeof SiteConfig.Type;

export interface EffectdocsConfig {
  readonly site: SiteConfig;
  readonly content?: {
    readonly dir?: string;
  };
  readonly basePath?: string;
  readonly llms?: boolean;
  readonly markdown?: boolean;
  readonly sitemap?: boolean;
}

export interface ResolvedEffectdocsConfig {
  readonly site: SiteConfig;
  readonly content: {
    readonly dir: string;
  };
  readonly basePath: string;
  readonly llms: boolean;
  readonly markdown: boolean;
  readonly sitemap: boolean;
}

const normalizeBasePath = (value: string): string => {
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  if (withLeadingSlash === "/") return "";
  return withLeadingSlash.replace(/\/+$/, "");
};

export const defineConfig = <const Config extends EffectdocsConfig>(
  config: Config,
): Config => config;

export const resolveConfig = (
  config: EffectdocsConfig,
): ResolvedEffectdocsConfig => ({
  site: S.decodeUnknownSync(SiteConfig)(config.site),
  content: {
    dir: config.content?.dir ?? "content/docs",
  },
  basePath: normalizeBasePath(config.basePath ?? "/docs"),
  llms: config.llms ?? true,
  markdown: config.markdown ?? true,
  sitemap: config.sitemap ?? true,
});
