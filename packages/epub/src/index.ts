import { promises as fs } from "node:fs";
import path from "node:path";

import { compile, type Block, type Inline } from "foldocs-mdx";
import { strToU8, zipSync } from "fflate";

export interface EpubPage {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly body: string;
}

export interface EpubAsset {
  readonly path: string;
  readonly mediaType: string;
  readonly data: Uint8Array;
}

export interface EpubOptions {
  readonly title: string;
  readonly identifier: string;
  readonly language?: string;
  readonly author?: string;
  readonly description?: string;
  readonly modified?: Date;
  readonly assets?: ReadonlyArray<EpubAsset>;
}

export interface ExportDirectoryOptions extends EpubOptions {
  readonly input: string;
  readonly output: string;
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const inlineHtml = (
  inline: Inline,
  resolveAsset: (url: string) => string = (url) => url,
): string => {
  switch (inline._tag) {
    case "Text":
      return escapeHtml(inline.value);
    case "InlineCode":
      return `<code>${escapeHtml(inline.value)}</code>`;
    case "HardBreak":
      return "<br/>";
    case "Link":
      return `<a href="${escapeHtml(inline.url)}">${inline.content.map((child) => inlineHtml(child, resolveAsset)).join("")}</a>`;
    case "Image":
      return `<img src="${escapeHtml(resolveAsset(inline.url))}" alt="${escapeHtml(inline.alt ?? "")}"/>`;
    case "Emphasis":
      return `<em>${inline.content.map((child) => inlineHtml(child, resolveAsset)).join("")}</em>`;
    case "Strong":
      return `<strong>${inline.content.map((child) => inlineHtml(child, resolveAsset)).join("")}</strong>`;
    case "Strikethrough":
      return `<s>${inline.content.map((child) => inlineHtml(child, resolveAsset)).join("")}</s>`;
    case "InlineComponent":
      return inline.content
        .map((child) => inlineHtml(child, resolveAsset))
        .join("");
  }
};

const blockHtml = (
  block: Block,
  resolveAsset: (url: string) => string = (url) => url,
): string => {
  switch (block._tag) {
    case "Heading":
      return `<h${String(block.level)} id="${escapeHtml(block.id)}">${block.content.map((child) => inlineHtml(child, resolveAsset)).join("")}</h${String(block.level)}>`;
    case "Paragraph":
      return `<p>${block.content.map((child) => inlineHtml(child, resolveAsset)).join("")}</p>`;
    case "CodeBlock":
      return `<pre><code${block.language === undefined ? "" : ` class="language-${escapeHtml(block.language)}"`}>${escapeHtml(block.value)}</code></pre>`;
    case "Blockquote":
      return `<blockquote>${block.blocks.map((child) => blockHtml(child, resolveAsset)).join("")}</blockquote>`;
    case "ThematicBreak":
      return "<hr/>";
    case "List": {
      const tag = block.ordered ? "ol" : "ul";
      const start =
        block.ordered && block.start !== undefined
          ? ` start="${String(block.start)}"`
          : "";
      return `<${tag}${start}>${block.items
        .map(
          (item) =>
            `<li>${item.checked === undefined ? "" : `<span>${item.checked ? "☑" : "☐"} </span>`}${item.blocks.map((child) => blockHtml(child, resolveAsset)).join("")}</li>`,
        )
        .join("")}</${tag}>`;
    }
    case "Table":
      return `<table><thead><tr>${block.header.cells
        .map(
          (cell) =>
            `<th>${cell.content.map((child) => inlineHtml(child, resolveAsset)).join("")}</th>`,
        )
        .join("")}</tr></thead><tbody>${block.rows
        .map(
          (row) =>
            `<tr>${row.cells
              .map(
                (cell) =>
                  `<td>${cell.content.map((child) => inlineHtml(child, resolveAsset)).join("")}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("")}</tbody></table>`;
    case "BlockComponent":
      return `<aside>${block.blocks.map((child) => blockHtml(child, resolveAsset)).join("")}</aside>`;
  }
};

const xhtml = (title: string, body: string, language: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeHtml(language)}">
<head><title>${escapeHtml(title)}</title><link rel="stylesheet" type="text/css" href="../styles.css"/></head>
<body>${body}</body>
</html>`;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "") || "page";

export const createEpub = (
  pages: ReadonlyArray<EpubPage>,
  options: EpubOptions,
): Uint8Array => {
  if (pages.length === 0)
    throw new TypeError("An EPUB requires at least one page.");
  const language = options.language ?? "en";
  const modified = (options.modified ?? new Date())
    .toISOString()
    .replace(/\.\d{3}Z$/u, "Z");
  const names = new Map<string, number>();
  const chapters = pages.map((page, index) => {
    const base = slugify(page.id || page.title);
    const count = (names.get(base) ?? 0) + 1;
    names.set(base, count);
    const filename = `${count === 1 ? base : `${base}-${String(count)}`}.xhtml`;
    return { page, index, filename };
  });
  const manifest = chapters
    .map(
      ({ filename }, index) =>
        `<item id="chapter-${String(index + 1)}" href="chapters/${filename}" media-type="application/xhtml+xml"/>`,
    )
    .join("");
  const spine = chapters
    .map((_, index) => `<itemref idref="chapter-${String(index + 1)}"/>`)
    .join("");
  const nav = chapters
    .map(
      ({ page, filename }) =>
        `<li><a href="chapters/${filename}">${escapeHtml(page.title)}</a></li>`,
    )
    .join("");
  const assetManifest = (options.assets ?? [])
    .map(
      (asset, index) =>
        `<item id="asset-${String(index + 1)}" href="assets/${escapeHtml(asset.path)}" media-type="${escapeHtml(asset.mediaType)}"/>`,
    )
    .join("");
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(
      '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    ),
    "OEBPS/content.opf": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${escapeHtml(options.identifier)}</dc:identifier><dc:title>${escapeHtml(options.title)}</dc:title><dc:language>${escapeHtml(language)}</dc:language>${options.author === undefined ? "" : `<dc:creator>${escapeHtml(options.author)}</dc:creator>`}${options.description === undefined ? "" : `<dc:description>${escapeHtml(options.description)}</dc:description>`}<meta property="dcterms:modified">${modified}</meta></metadata><manifest><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/><item id="styles" href="styles.css" media-type="text/css"/>${manifest}${assetManifest}</manifest><spine>${spine}</spine></package>`),
    "OEBPS/nav.xhtml": strToU8(
      xhtml(
        options.title,
        `<nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc"><h1>${escapeHtml(options.title)}</h1><ol>${nav}</ol></nav>`,
        language,
      ).replace('href="../styles.css"', 'href="styles.css"'),
    ),
    "OEBPS/styles.css": strToU8(
      "body{font-family:system-ui,sans-serif;line-height:1.6;max-width:42rem;margin:auto}pre{white-space:pre-wrap;background:#f3f3f3;padding:1rem}code{font-family:monospace}table{border-collapse:collapse}th,td{border:1px solid #aaa;padding:.4rem}",
    ),
  };
  for (const { page, filename } of chapters)
    files[`OEBPS/chapters/${filename}`] = strToU8(
      xhtml(
        page.title,
        `<h1>${escapeHtml(page.title)}</h1>${page.description === undefined ? "" : `<p>${escapeHtml(page.description)}</p>`}${page.body}`,
        language,
      ),
    );
  for (const asset of options.assets ?? [])
    files[`OEBPS/assets/${asset.path}`] = asset.data;
  return zipSync(files, { level: 9 });
};

const mediaType = (file: string): string => {
  switch (path.extname(file).toLowerCase()) {
    case ".avif":
      return "image/avif";
    case ".gif":
      return "image/gif";
    case ".jpeg":
    case ".jpg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
};

const walk = async (directory: string): Promise<ReadonlyArray<string>> => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory()
          ? walk(target)
          : /\.(?:md|mdx)$/iu.test(entry.name)
            ? [target]
            : [];
      }),
    )
  )
    .flat()
    .sort();
};

const walkAssets = async (
  directory: string,
): Promise<ReadonlyArray<string>> => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries
        .filter((entry) => !entry.name.startsWith("."))
        .map((entry) => {
          const target = path.join(directory, entry.name);
          return entry.isDirectory()
            ? walkAssets(target)
            : !/\.(?:md|mdx)$/iu.test(entry.name) && entry.name !== "meta.json"
              ? [target]
              : [];
        }),
    )
  )
    .flat()
    .sort();
};

export const exportDirectory = async (
  options: ExportDirectoryOptions,
): Promise<{ readonly output: string; readonly pages: number }> => {
  const input = path.resolve(options.input);
  const files = await walk(input);
  const assetFiles = await walkAssets(input);
  const assetPaths = new Map(
    assetFiles.map((file) => [
      path.resolve(file),
      path.relative(input, file).split(path.sep).join("/"),
    ]),
  );
  const pages = await Promise.all(
    files.map(async (file): Promise<EpubPage> => {
      const compiled = await compile(await fs.readFile(file, "utf8"), {
        filePath: file,
        highlight: false,
      });
      const blocks =
        compiled.document.blocks[0]?._tag === "Heading" &&
        compiled.document.blocks[0].level === 1
          ? compiled.document.blocks.slice(1)
          : compiled.document.blocks;
      return {
        id: path.relative(input, file).replace(/\.(?:md|mdx)$/iu, ""),
        title: compiled.frontmatter.title,
        ...(compiled.frontmatter.description === undefined
          ? {}
          : { description: compiled.frontmatter.description }),
        body: blocks
          .map((block) =>
            blockHtml(block, (url) => {
              if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/iu.test(url)) return url;
              const match = url.match(/^([^?#]+)(.*)$/u);
              if (match === null) return url;
              const asset = assetPaths.get(
                path.resolve(path.dirname(file), decodeURIComponent(match[1]!)),
              );
              return asset === undefined
                ? url
                : `../assets/${asset}${match[2] ?? ""}`;
            }),
          )
          .join("\n"),
      };
    }),
  );
  await fs.mkdir(path.dirname(path.resolve(options.output)), {
    recursive: true,
  });
  const assets = await Promise.all(
    assetFiles.map(async (file): Promise<EpubAsset> => ({
      path: assetPaths.get(path.resolve(file))!,
      mediaType: mediaType(file),
      data: await fs.readFile(file),
    })),
  );
  await fs.writeFile(options.output, createEpub(pages, { ...options, assets }));
  return { output: path.resolve(options.output), pages: pages.length };
};
