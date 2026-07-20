import { promises as fs } from "node:fs";
import path from "node:path";

export interface ObsidianConversionOptions {
  readonly sourcePath?: string;
  readonly resolveLink?: (
    target: string,
    sourcePath: string | undefined,
  ) => string;
  readonly resolveAsset?: (
    target: string,
    sourcePath: string | undefined,
  ) => string;
}

export interface GenerateVaultOptions {
  readonly input: string;
  readonly output: string;
  readonly title?: string;
  readonly description?: string;
  readonly root?: boolean;
}

export interface GeneratedVaultResult {
  readonly pages: number;
  readonly assets: number;
  readonly files: ReadonlyArray<string>;
}

const generatedManifestName = ".foldocs-obsidian.json";
const markdownPattern = /\.md$/iu;

const slugifySegment = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "") || "note";

const slugifyPath = (value: string): string =>
  value.split(/[\\/]/u).filter(Boolean).map(slugifySegment).join("/");

const headingSlug = (value: string): string =>
  slugifySegment(value.replace(/^\^/u, ""));

/** Convert Obsidian comments, embeds, and wiki links into deterministic Markdown. */
export const convertObsidianMarkdown = (
  source: string,
  options: ObsidianConversionOptions = {},
): string => {
  const withoutComments = source.replace(/%%[\s\S]*?%%/gu, "");
  const embeds = withoutComments.replace(
    /!\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/gu,
    (_, target: string, label: string | undefined) => {
      const href =
        options.resolveAsset?.(target.trim(), options.sourcePath) ??
        target.trim().replaceAll(" ", "%20");
      return `![${label?.trim() ?? path.basename(target.trim())}](${href})`;
    },
  );
  return embeds
    .replace(
      /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/gu,
      (_, rawTarget: string, label: string | undefined) => {
        const [note = "", fragment] = rawTarget.split("#", 2);
        const resolved =
          options.resolveLink?.(note.trim(), options.sourcePath) ??
          slugifyPath(note.trim());
        const hash =
          fragment === undefined ? "" : `#${headingSlug(fragment.trim())}`;
        return `[${label?.trim() ?? (fragment?.trim() || path.basename(note.trim()))}](${resolved}${hash})`;
      },
    )
    .replace(/\s+\^[a-z0-9-]+\s*$/gimu, "")
    .replace(/\n{3,}/gu, "\n\n")
    .trim()
    .concat("\n");
};

const walk = async (directory: string): Promise<ReadonlyArray<string>> => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries
        .filter((entry) => !entry.name.startsWith("."))
        .map((entry) => {
          const target = path.join(directory, entry.name);
          return entry.isDirectory() ? walk(target) : [target];
        }),
    )
  )
    .flat()
    .sort();
};

const titleFromSource = (source: string, fallback: string): string => {
  const frontmatter = source.match(/^---\n[\s\S]*?\n---/u)?.[0];
  const title = frontmatter?.match(/^title:\s*["']?(.+?)["']?\s*$/imu)?.[1];
  const heading = source.match(/^#\s+(.+)$/mu)?.[1];
  return title?.trim() || heading?.trim() || fallback;
};

export const generateVault = async (
  options: GenerateVaultOptions,
): Promise<GeneratedVaultResult> => {
  const input = path.resolve(options.input);
  const output = path.resolve(options.output);
  const files = await walk(input);
  const notes = files.filter((file) => markdownPattern.test(file));
  const assets = files.filter((file) => !markdownPattern.test(file));
  const notePaths = new Map<string, string>();
  for (const note of notes) {
    const relative = path.relative(input, note).split(path.sep).join("/");
    const target = `${slugifyPath(relative.replace(markdownPattern, ""))}.mdx`;
    notePaths.set(relative.toLowerCase().replace(markdownPattern, ""), target);
    notePaths.set(path.basename(relative, ".md").toLowerCase(), target);
  }
  const assetPaths = new Map(
    assets.map((asset) => {
      const relative = path.relative(input, asset).split(path.sep).join("/");
      return [
        relative.toLowerCase(),
        `_assets/${slugifyPath(relative)}`,
      ] as const;
    }),
  );
  const generated: string[] = [];
  await fs.mkdir(output, { recursive: true });
  for (const note of notes) {
    const relative = path.relative(input, note).split(path.sep).join("/");
    const target = notePaths.get(
      relative.toLowerCase().replace(markdownPattern, ""),
    )!;
    const targetDirectory = path.posix.dirname(target);
    const source = await fs.readFile(note, "utf8");
    const content = convertObsidianMarkdown(source, {
      sourcePath: relative,
      resolveLink: (value) => {
        const normalized = value.replace(/\.md$/iu, "").toLowerCase();
        const resolved =
          notePaths.get(normalized) ?? notePaths.get(path.basename(normalized));
        if (resolved === undefined) return slugifyPath(value);
        const route = resolved.replace(/\.mdx$/u, "");
        const from = targetDirectory === "." ? "" : targetDirectory;
        const href = path.posix.relative(from, route);
        return href.startsWith(".") ? href : `./${href}`;
      },
      resolveAsset: (value) => {
        const resolved =
          assetPaths.get(value.toLowerCase()) ??
          assetPaths.get(
            [...assetPaths.keys()].find(
              (candidate) =>
                path.posix.basename(candidate) === value.toLowerCase(),
            ) ?? "",
          );
        if (resolved === undefined) return value.replaceAll(" ", "%20");
        const from = targetDirectory === "." ? "" : targetDirectory;
        const href = path.posix.relative(from, resolved);
        return href.startsWith(".") ? href : `./${href}`;
      },
    });
    const withFrontmatter = /^---\n/u.test(content)
      ? content
      : `---\ntitle: ${JSON.stringify(titleFromSource(content, path.basename(note, ".md")))}\n---\n\n${content}`;
    const filename = path.join(output, ...target.split("/"));
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, withFrontmatter, "utf8");
    generated.push(target);
  }
  for (const asset of assets) {
    const relative = path.relative(input, asset).split(path.sep).join("/");
    const target = assetPaths.get(relative.toLowerCase())!;
    const filename = path.join(output, ...target.split("/"));
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.copyFile(asset, filename);
    generated.push(target);
  }
  const topLevelPages = notes
    .map((note) =>
      notePaths.get(
        path
          .relative(input, note)
          .split(path.sep)
          .join("/")
          .toLowerCase()
          .replace(markdownPattern, ""),
      )!,
    )
    .filter((file) => !file.includes("/"))
    .map((file) => file.replace(/\.mdx$/u, ""));
  const meta = "meta.json";
  await fs.writeFile(
    path.join(output, meta),
    JSON.stringify(
      {
        title: options.title ?? path.basename(input),
        ...(options.description === undefined
          ? {}
          : { description: options.description }),
        root: options.root ?? true,
        defaultOpen: true,
        pages: [...topLevelPages, "..."],
      },
      null,
      2,
    ).concat("\n"),
    "utf8",
  );
  generated.push(meta);
  const manifestPath = path.join(output, generatedManifestName);
  const previous = await fs.readFile(manifestPath, "utf8").then(
    (value) => JSON.parse(value) as string[],
    (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    },
  );
  const next = new Set(generated);
  await Promise.all(
    previous
      .filter(
        (file) =>
          !file.split("/").includes("..") &&
          file !== generatedManifestName &&
          !next.has(file),
      )
      .map((file) =>
        fs.unlink(path.join(output, ...file.split("/"))).catch(() => undefined),
      ),
  );
  await fs.writeFile(
    manifestPath,
    JSON.stringify([...next].toSorted(), null, 2).concat("\n"),
    "utf8",
  );
  return {
    pages: notes.length,
    assets: assets.length,
    files: [...next].toSorted(),
  };
};
