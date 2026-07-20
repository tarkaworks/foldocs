import { promises as fs } from "node:fs";
import path from "node:path";

import type { PageMetadata } from "@effectdocs/content";
import {
  resolveConfig,
  type EffectdocsConfig,
  type ResolvedEffectdocsConfig,
} from "effectdocs-core";
import { compile, type CompiledPage } from "effectdocs-mdx";
import type { Plugin, ResolvedConfig } from "vite";

const virtualModuleId = "virtual:effectdocs";
const resolvedVirtualModuleId = `\0${virtualModuleId}`;
const documentPattern = /\.(?:md|mdx)$/iu;

interface DiscoveredPage {
  readonly absolutePath: string;
  readonly metadata: PageMetadata;
  readonly compiled: CompiledPage;
}

export interface EffectdocsPluginOptions extends EffectdocsConfig {}

const toPosix = (value: string): string => value.split(path.sep).join("/");

const walk = async (directory: string): Promise<ReadonlyArray<string>> => {
  const entries = await fs
    .readdir(directory, { withFileTypes: true })
    .catch((error) => {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return [];
      throw error;
    });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return walk(target);
      return entry.isFile() && documentPattern.test(entry.name) ? [target] : [];
    }),
  );
  return files.flat().sort((left, right) => left.localeCompare(right));
};

const slugFromFile = (contentRoot: string, file: string): string => {
  const relative = toPosix(path.relative(contentRoot, file)).replace(
    documentPattern,
    "",
  );
  const segments = relative.split("/");
  if (segments.at(-1)?.toLowerCase() === "index") segments.pop();
  return segments.join("/");
};

const joinUrl = (basePath: string, slug: string): string => {
  const value = [basePath, slug]
    .filter(Boolean)
    .join("/")
    .replace(/\/{2,}/gu, "/");
  return value.length === 0 ? "/" : value.startsWith("/") ? value : `/${value}`;
};

const importSpecifier = (root: string, file: string): string => {
  const relative = toPosix(path.relative(root, file));
  return relative.startsWith("../") ? `/@fs/${toPosix(file)}` : `/${relative}`;
};

const xmlEscape = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const absoluteUrl = (baseUrl: string, pathname: string): string =>
  new URL(
    pathname.replace(/^\//u, ""),
    `${baseUrl.replace(/\/+$/u, "")}/`,
  ).toString();

const makeLlmsIndex = (
  config: ResolvedEffectdocsConfig,
  pages: ReadonlyArray<DiscoveredPage>,
): string => {
  const header = [
    `# ${config.site.title}`,
    config.site.description === undefined
      ? undefined
      : `> ${config.site.description}`,
    "## Documentation",
  ].filter((line): line is string => line !== undefined);
  const links = pages.map(({ metadata }) => {
    const href =
      config.site.baseUrl === undefined
        ? metadata.url
        : absoluteUrl(config.site.baseUrl, metadata.url);
    const description = metadata.frontmatter.description;
    return `- [${metadata.frontmatter.title}](${href})${
      description === undefined ? "" : `: ${description}`
    }`;
  });
  return `${[...header, ...links].join("\n\n")}\n`;
};

const makeLlmsFull = (
  config: ResolvedEffectdocsConfig,
  pages: ReadonlyArray<DiscoveredPage>,
): string =>
  `${[
    `# ${config.site.title}`,
    config.site.description === undefined
      ? undefined
      : `> ${config.site.description}`,
    ...pages.flatMap(({ metadata, compiled }) => [
      `# ${metadata.frontmatter.title}`,
      `Source: ${metadata.url}`,
      compiled.source,
    ]),
  ]
    .filter((value): value is string => value !== undefined)
    .join("\n\n")}\n`;

/**
 * Turns a directory of Markdown and deterministic MDX into typed Foldkit page
 * modules and a virtual, lazy-loaded document manifest.
 */
export const effectdocs = (options: EffectdocsPluginOptions): Plugin => {
  const config = resolveConfig(options);
  let viteConfig: ResolvedConfig;
  let contentRoot = "";
  const compiledCache = new Map<string, Promise<CompiledPage>>();

  const compileFile = (
    file: string,
    highlight: boolean,
  ): Promise<CompiledPage> => {
    const cacheKey = `${file}:${highlight ? "highlight" : "plain"}`;
    const existing = compiledCache.get(cacheKey);
    if (existing !== undefined) return existing;
    const pending = fs
      .readFile(file, "utf8")
      .then((source) => compile(source, { filePath: file, highlight }));
    compiledCache.set(cacheKey, pending);
    return pending;
  };

  const discover = async (
    highlight: boolean,
  ): Promise<ReadonlyArray<DiscoveredPage>> => {
    const files = await walk(contentRoot);
    const pages = await Promise.all(
      files.map(async (absolutePath): Promise<DiscoveredPage> => {
        const compiled = await compileFile(absolutePath, highlight);
        const slug = slugFromFile(contentRoot, absolutePath);
        const relativeFile = toPosix(
          path.relative(viteConfig.root, absolutePath),
        );
        return {
          absolutePath,
          compiled,
          metadata: {
            id: toPosix(path.relative(contentRoot, absolutePath)),
            slug,
            url: joinUrl(config.basePath, slug),
            file: relativeFile,
            frontmatter: compiled.frontmatter,
            toc: compiled.toc,
            plainText: compiled.plainText,
          },
        };
      }),
    );
    return pages
      .filter(
        ({ metadata }) =>
          !metadata.frontmatter.draft || viteConfig.command === "serve",
      )
      .sort((left, right) => {
        const byOrder =
          (left.metadata.frontmatter.order ?? Number.MAX_SAFE_INTEGER) -
          (right.metadata.frontmatter.order ?? Number.MAX_SAFE_INTEGER);
        return byOrder === 0
          ? left.metadata.slug.localeCompare(right.metadata.slug)
          : byOrder;
      });
  };

  return {
    name: "effectdocs",
    enforce: "pre",
    configResolved(resolved) {
      viteConfig = resolved;
      contentRoot = path.resolve(resolved.root, config.content.dir);
    },
    configureServer(server) {
      server.watcher.add(contentRoot);
    },
    resolveId(id) {
      if (id === virtualModuleId) return resolvedVirtualModuleId;
      return undefined;
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        const pages = await discover(false);
        const entries = pages.map(({ absolutePath, metadata }) => {
          const specifier = importSpecifier(viteConfig.root, absolutePath);
          return `{ ...${JSON.stringify(metadata)}, load: () => import(${JSON.stringify(specifier)}) }`;
        });
        return [
          `export const siteConfig = ${JSON.stringify(config.site)};`,
          `export const basePath = ${JSON.stringify(config.basePath)};`,
          `export const manifest = [${entries.join(",\n")}];`,
          "export default manifest;",
        ].join("\n");
      }
      const cleanId = id.split("?", 1)[0] ?? id;
      if (
        documentPattern.test(cleanId) &&
        path.resolve(cleanId).startsWith(contentRoot)
      ) {
        const page = await compileFile(path.resolve(cleanId), true);
        return `export default ${JSON.stringify(page)};`;
      }
      return undefined;
    },
    async handleHotUpdate(context) {
      if (
        !documentPattern.test(context.file) ||
        !path.resolve(context.file).startsWith(contentRoot)
      ) {
        return undefined;
      }
      compiledCache.delete(`${context.file}:highlight`);
      compiledCache.delete(`${context.file}:plain`);
      const virtualModule = context.server.moduleGraph.getModuleById(
        resolvedVirtualModuleId,
      );
      if (virtualModule !== undefined)
        context.server.moduleGraph.invalidateModule(virtualModule);
      return virtualModule === undefined
        ? context.modules
        : [...context.modules, virtualModule];
    },
    async generateBundle() {
      const pages = await discover(false);
      if (config.llms) {
        this.emitFile({
          type: "asset",
          fileName: "llms.txt",
          source: makeLlmsIndex(config, pages),
        });
        this.emitFile({
          type: "asset",
          fileName: "llms-full.txt",
          source: makeLlmsFull(config, pages),
        });
      }
      if (config.sitemap) {
        if (config.site.baseUrl === undefined) {
          this.warn(
            "Effectdocs skipped sitemap.xml because site.baseUrl is not configured.",
          );
        } else {
          const urls = pages
            .map(
              ({ metadata }) =>
                `  <url><loc>${xmlEscape(absoluteUrl(config.site.baseUrl!, metadata.url))}</loc></url>`,
            )
            .join("\n");
          this.emitFile({
            type: "asset",
            fileName: "sitemap.xml",
            source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
          });
        }
      }
    },
  };
};

export default effectdocs;
