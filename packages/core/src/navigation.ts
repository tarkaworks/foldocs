import type { PageMetadata } from "@effectdocs/content";

export interface NavigationPage {
  readonly _tag: "Page";
  readonly label: string;
  readonly url: string;
  readonly page: PageMetadata;
}

export interface NavigationFolder {
  readonly _tag: "Folder";
  readonly label: string;
  readonly segment: string;
  readonly defaultOpen: boolean;
  readonly children: ReadonlyArray<NavigationNode>;
}

export type NavigationNode = NavigationPage | NavigationFolder;

interface MutableFolder {
  label: string;
  segment: string;
  directory: string;
  folders: Map<string, MutableFolder>;
  pages: Array<{ readonly key: string; readonly page: PageMetadata }>;
}

/** Fumadocs-compatible navigation metadata loaded from a directory's meta.json. */
export interface NavigationMeta {
  readonly title?: string;
  readonly pages?: ReadonlyArray<string>;
  readonly defaultOpen?: boolean;
}

export type NavigationMetaMap = Readonly<Record<string, NavigationMeta>>;

const humanize = (value: string): string =>
  value
    .replace(/[-_]+/gu, " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());

const pageOrder = (page: PageMetadata): number =>
  page.frontmatter.order ?? Number.MAX_SAFE_INTEGER;

const comparePages = (left: PageMetadata, right: PageMetadata): number =>
  pageOrder(left) - pageOrder(right) ||
  left.frontmatter.title.localeCompare(right.frontmatter.title);

const metaPosition = (
  key: string,
  pages: ReadonlyArray<string> | undefined,
): number => {
  if (pages === undefined) return Number.MAX_SAFE_INTEGER;
  const exact = pages.indexOf(key);
  if (exact >= 0) return exact;
  const rest = pages.indexOf("...");
  return rest >= 0 ? rest : Number.MAX_SAFE_INTEGER;
};

const folderLabel = (segment: string): string =>
  humanize(segment.replace(/^\((.*)\)$/u, "$1"));

const freezeFolder = (
  folder: MutableFolder,
  metadata: NavigationMetaMap,
): NavigationFolder => {
  const meta = metadata[folder.directory];
  const folders = [...folder.folders.values()].map((child) => ({
    key: child.segment,
    node: freezeFolder(child, metadata),
  }));
  const pages = folder.pages
    .sort((left, right) => comparePages(left.page, right.page))
    .map(({ key, page }) => ({
      key,
      node: {
        _tag: "Page",
        label: page.frontmatter.label ?? page.frontmatter.title,
        url: page.url,
        page,
      } satisfies NavigationPage,
    }));
  const children = [...pages, ...folders]
    .sort((left, right) => {
      const byMeta =
        metaPosition(left.key, meta?.pages) -
        metaPosition(right.key, meta?.pages);
      if (byMeta !== 0) return byMeta;
      if (left.node._tag === "Page" && right.node._tag === "Page")
        return comparePages(left.node.page, right.node.page);
      return left.node.label.localeCompare(right.node.label);
    })
    .map(({ node }) => node);
  return {
    _tag: "Folder",
    label: meta?.title ?? folder.label,
    segment: folder.segment,
    defaultOpen: meta?.defaultOpen ?? true,
    children,
  };
};

const navigationPath = (
  page: PageMetadata,
): { readonly folders: ReadonlyArray<string>; readonly page: string } => {
  const segments = page.id
    .replace(/\.(?:md|mdx)$/iu, "")
    .split("/")
    .filter(Boolean);
  const pageKey = segments.pop() ?? "index";
  return { folders: segments, page: pageKey };
};

export const buildNavigation = (
  pages: ReadonlyArray<PageMetadata>,
  metadata: NavigationMetaMap = {},
): ReadonlyArray<NavigationNode> => {
  const root: MutableFolder = {
    label: "Documentation",
    segment: "",
    directory: "",
    folders: new Map(),
    pages: [],
  };

  for (const page of pages) {
    if (page.frontmatter.hidden === true || page.frontmatter.draft === true)
      continue;
    const { folders: folderSegments, page: pageKey } = navigationPath(page);
    let cursor = root;
    for (const segment of folderSegments) {
      let next = cursor.folders.get(segment);
      if (next === undefined) {
        const directory = [cursor.directory, segment].filter(Boolean).join("/");
        next = {
          label: folderLabel(segment),
          segment,
          directory,
          folders: new Map(),
          pages: [],
        };
        cursor.folders.set(segment, next);
      }
      cursor = next;
    }
    cursor.pages.push({ key: pageKey, page });
  }

  return freezeFolder(root, metadata).children;
};

export const flattenNavigation = (
  nodes: ReadonlyArray<NavigationNode>,
): ReadonlyArray<NavigationPage> =>
  nodes.flatMap((node) =>
    node._tag === "Page" ? [node] : flattenNavigation(node.children),
  );
