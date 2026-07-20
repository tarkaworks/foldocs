import { promises as fs } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

import type { PageMetadata } from "@effectdocs/content";
import {
  buildNavigation,
  resolveConfig,
  type EffectdocsConfig,
  type NavigationMeta,
  type NavigationMetaMap,
  type ResolvedEffectdocsConfig,
} from "effectdocs-core";
import { compile, type CompiledPage } from "effectdocs-mdx";
import type { HtmlTagDescriptor, Plugin, ResolvedConfig } from "vite";

import {
  isMarkdownPreferred,
  makeLandingMarkdown,
  makePageMarkdown,
  markdownAssetPath,
  pageUrlFromMarkdownPath,
} from "./markdown.js";

export {
  isMarkdownPreferred,
  makeLandingMarkdown,
  makePageMarkdown,
  markdownAssetPath,
  pageUrlFromMarkdownPath,
} from "./markdown.js";

const virtualModuleId = "virtual:effectdocs";
const resolvedVirtualModuleId = `\0${virtualModuleId}`;
const documentPattern = /\.(?:md|mdx)$/iu;
const metaFileName = "meta.json";

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
  return segments.filter((segment) => !/^\(.+\)$/u.test(segment)).join("/");
};

const discoverNavigationMeta = async (
  directory: string,
  contentDirectory = directory,
): Promise<NavigationMetaMap> => {
  const entries = await fs
    .readdir(directory, { withFileTypes: true })
    .catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) =>
        discoverNavigationMeta(
          path.join(directory, entry.name),
          contentDirectory,
        ),
      ),
  );
  const metaPath = path.join(directory, metaFileName);
  const current = await fs.readFile(metaPath, "utf8").then(
    (source) => {
      const parsed: unknown = JSON.parse(source);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      )
        throw new TypeError(`${metaPath} must contain a JSON object.`);
      const value = parsed as Record<string, unknown>;
      if (value.title !== undefined && typeof value.title !== "string")
        throw new TypeError(`${metaPath} title must be a string.`);
      if (
        value.defaultOpen !== undefined &&
        typeof value.defaultOpen !== "boolean"
      )
        throw new TypeError(`${metaPath} defaultOpen must be a boolean.`);
      if (
        value.pages !== undefined &&
        (!Array.isArray(value.pages) ||
          !value.pages.every((entry) => typeof entry === "string"))
      )
        throw new TypeError(`${metaPath} pages must be an array of strings.`);
      const meta: NavigationMeta = {
        ...(typeof value.title === "string" ? { title: value.title } : {}),
        ...(typeof value.defaultOpen === "boolean"
          ? { defaultOpen: value.defaultOpen }
          : {}),
        ...(Array.isArray(value.pages)
          ? { pages: value.pages as string[] }
          : {}),
      };
      return {
        [toPosix(path.relative(contentDirectory, directory))]: meta,
      };
    },
    (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    },
  );
  return Object.assign({}, current, ...nested) as NavigationMetaMap;
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

const socialImageUrl = (
  config: ResolvedEffectdocsConfig,
): string | undefined => {
  const image = config.site.socialImage;
  if (image === undefined || config.site.baseUrl === undefined) return image;
  return absoluteUrl(config.site.baseUrl, image);
};

const headTags = (
  config: ResolvedEffectdocsConfig,
): ReadonlyArray<HtmlTagDescriptor> => {
  const { site } = config;
  const image = socialImageUrl(config);
  return [
    ...(site.description === undefined
      ? []
      : [
          {
            tag: "meta",
            attrs: { name: "description", content: site.description },
            injectTo: "head" as const,
          },
          {
            tag: "meta",
            attrs: { property: "og:description", content: site.description },
            injectTo: "head" as const,
          },
          {
            tag: "meta",
            attrs: {
              name: "twitter:description",
              content: site.description,
            },
            injectTo: "head" as const,
          },
        ]),
    ...(site.keywords === undefined || site.keywords.length === 0
      ? []
      : [
          {
            tag: "meta",
            attrs: { name: "keywords", content: site.keywords.join(", ") },
            injectTo: "head" as const,
          },
        ]),
    {
      tag: "meta",
      attrs: { property: "og:title", content: site.title },
      injectTo: "head" as const,
    },
    {
      tag: "meta",
      attrs: { property: "og:type", content: "website" },
      injectTo: "head" as const,
    },
    {
      tag: "meta",
      attrs: { name: "twitter:title", content: site.title },
      injectTo: "head" as const,
    },
    {
      tag: "meta",
      attrs: {
        name: "twitter:card",
        content: image === undefined ? "summary" : "summary_large_image",
      },
      injectTo: "head" as const,
    },
    ...(image === undefined
      ? []
      : [
          {
            tag: "meta",
            attrs: { property: "og:image", content: image },
            injectTo: "head" as const,
          },
          {
            tag: "meta",
            attrs: { name: "twitter:image", content: image },
            injectTo: "head" as const,
          },
        ]),
    ...(site.favicon === undefined
      ? []
      : [
          {
            tag: "link",
            attrs: { rel: "icon", href: site.favicon },
            injectTo: "head" as const,
          },
        ]),
  ];
};

const prepareIndexHtml = (html: string, locale: string): string => {
  const safeLocale = /^[a-z0-9-]+$/iu.test(locale) ? locale : "en";
  const localized = html.replace(
    /<html(?:\s+lang="[^"]*")?\s*>/iu,
    `<html lang="${safeLocale}">`,
  );
  const cssLinkPattern =
    /<link\s+rel="stylesheet"[^>]*crossorigin[^>]*href="[^"]*\.css"[^>]*>/giu;
  const cssLinks = localized.match(cssLinkPattern);
  if (cssLinks === null) return localized;
  let result = localized;
  for (const link of cssLinks) result = result.replace(link, "");
  const cleaned = cssLinks.map((link) =>
    link.replace(/\s+crossorigin(?:="[^"]*")?/iu, ""),
  );
  const head = result.indexOf("<head>");
  if (head < 0) return localized;
  const insertAt = head + "<head>".length;
  return `${result.slice(0, insertAt)}\n    ${cleaned.join("\n    ")}${result.slice(insertAt)}`;
};

const makeLlmsIndex = (
  config: ResolvedEffectdocsConfig,
  pages: ReadonlyArray<DiscoveredPage>,
): string => {
  const header = [
    `# ${config.site.title}`,
    config.site.description === undefined
      ? undefined
      : `> ${config.site.description}`,
    `Every documentation page is available as Markdown by appending \`.md\` to its URL. A single-file concatenation is available at ${
      config.site.baseUrl === undefined
        ? "/llms-full.txt"
        : absoluteUrl(config.site.baseUrl, "/llms-full.txt")
    }.`,
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
    ...pages.map((page) => {
      const source =
        config.site.baseUrl === undefined
          ? page.metadata.url
          : absoluteUrl(config.site.baseUrl, page.metadata.url);
      return `Source: ${source}\n\n${makePageMarkdown(config.site, page).trim()}`;
    }),
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

  const serveMarkdown = async (
    request: IncomingMessage,
    response: ServerResponse,
    next: (error?: unknown) => void,
  ): Promise<void> => {
    if (
      !config.markdown ||
      (request.method !== "GET" && request.method !== "HEAD")
    ) {
      next();
      return;
    }
    const pathname = new URL(request.url ?? "/", "http://effectdocs.local")
      .pathname;
    const explicitPageUrl = pageUrlFromMarkdownPath(pathname);
    const negotiated = isMarkdownPreferred(request.headers.accept);
    if (explicitPageUrl === undefined && !negotiated) {
      next();
      return;
    }
    const negotiatedPageUrl = pathname.replace(/\/+$/u, "") || "/";
    const pageUrl = explicitPageUrl ?? negotiatedPageUrl;
    try {
      const pages = await discover(false);
      const page = pages.find(({ metadata }) => metadata.url === pageUrl);
      const markdown =
        page === undefined && pageUrl === "/" && config.basePath !== ""
          ? makeLandingMarkdown(
              config.site,
              pages.find(({ metadata }) => metadata.slug === "")?.metadata
                .url ??
                pages[0]?.metadata.url ??
                config.basePath,
            )
          : page === undefined
            ? undefined
            : makePageMarkdown(config.site, page);
      if (markdown === undefined) {
        next();
        return;
      }
      response.statusCode = 200;
      response.setHeader("Content-Type", "text/markdown; charset=utf-8");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Content-Length", String(Buffer.byteLength(markdown)));
      response.end(request.method === "HEAD" ? undefined : markdown);
    } catch (error) {
      next(error);
    }
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
      server.middlewares.use((request, response, next) => {
        void serveMarkdown(request, response, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        void serveMarkdown(request, response, next);
      });
    },
    transformIndexHtml: {
      order: "post",
      handler(html) {
        return {
          html: prepareIndexHtml(html, config.site.locale ?? "en"),
          tags: [...headTags(config)],
        };
      },
    },
    resolveId(id) {
      if (id === virtualModuleId) return resolvedVirtualModuleId;
      return undefined;
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        const [pages, navigationMeta] = await Promise.all([
          discover(false),
          discoverNavigationMeta(contentRoot),
        ]);
        const entries = pages.map(({ absolutePath, metadata }) => {
          const specifier = importSpecifier(viteConfig.root, absolutePath);
          return `{ ...${JSON.stringify(metadata)}, load: () => import(${JSON.stringify(specifier)}) }`;
        });
        const navigation = buildNavigation(
          pages.map(({ metadata }) => metadata),
          navigationMeta,
        );
        return [
          `export const siteConfig = ${JSON.stringify(config.site)};`,
          `export const basePath = ${JSON.stringify(config.basePath)};`,
          `export const markdown = ${JSON.stringify(config.markdown)};`,
          `export const navigationMeta = ${JSON.stringify(navigationMeta)};`,
          `export const manifest = [${entries.join(",\n")}];`,
          `export const navigation = ${JSON.stringify(navigation)};`,
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
        path.basename(context.file) === metaFileName &&
        path.resolve(context.file).startsWith(contentRoot)
      ) {
        const virtualModule = context.server.moduleGraph.getModuleById(
          resolvedVirtualModuleId,
        );
        if (virtualModule !== undefined)
          context.server.moduleGraph.invalidateModule(virtualModule);
        return virtualModule === undefined
          ? context.modules
          : [...context.modules, virtualModule];
      }
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
      if (config.markdown) {
        for (const page of pages) {
          this.emitFile({
            type: "asset",
            fileName: markdownAssetPath(page.metadata.url),
            source: makePageMarkdown(config.site, page),
          });
        }
        if (!pages.some(({ metadata }) => metadata.url === "/")) {
          this.emitFile({
            type: "asset",
            fileName: "index.md",
            source: makeLandingMarkdown(
              config.site,
              pages.find(({ metadata }) => metadata.slug === "")?.metadata
                .url ??
                pages[0]?.metadata.url ??
                config.basePath,
            ),
          });
        }
      }
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
