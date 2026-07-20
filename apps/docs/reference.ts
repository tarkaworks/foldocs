/** Options for compiling a Foldocs page. */
export interface CompileOptions {
  /** Enable build-time syntax and type highlighting. */
  readonly highlight?: boolean;
  /** Source filename used in diagnostics. */
  readonly filePath?: string;
}

/** Create a stable localized documentation URL. */
export function documentationUrl(
  locale: string,
  slug: string,
  basePath = "/docs",
): string {
  return `/${locale}${basePath}/${slug}`.replace(/\/{2,}/gu, "/");
}
