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
  readonly children: ReadonlyArray<NavigationNode>;
}

export type NavigationNode = NavigationPage | NavigationFolder;

interface MutableFolder {
  label: string;
  segment: string;
  folders: Map<string, MutableFolder>;
  pages: PageMetadata[];
}

const humanize = (value: string): string =>
  value
    .replace(/[-_]+/gu, " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());

const pageOrder = (page: PageMetadata): number =>
  page.frontmatter.order ?? Number.MAX_SAFE_INTEGER;

const comparePages = (left: PageMetadata, right: PageMetadata): number =>
  pageOrder(left) - pageOrder(right) ||
  left.frontmatter.title.localeCompare(right.frontmatter.title);

const freezeFolder = (folder: MutableFolder): NavigationFolder => {
  const folders = [...folder.folders.values()]
    .sort((left, right) => left.label.localeCompare(right.label))
    .map(freezeFolder);
  const pages: NavigationPage[] = folder.pages
    .sort(comparePages)
    .map((page) => ({
      _tag: "Page",
      label: page.frontmatter.label ?? page.frontmatter.title,
      url: page.url,
      page,
    }));
  return {
    _tag: "Folder",
    label: folder.label,
    segment: folder.segment,
    children: [...pages, ...folders],
  };
};

export const buildNavigation = (
  pages: ReadonlyArray<PageMetadata>,
): ReadonlyArray<NavigationNode> => {
  const root: MutableFolder = {
    label: "Documentation",
    segment: "",
    folders: new Map(),
    pages: [],
  };

  for (const page of pages) {
    if (page.frontmatter.hidden === true || page.frontmatter.draft === true)
      continue;
    const segments = page.slug.split("/").filter(Boolean);
    const folderSegments = segments.slice(0, -1);
    let cursor = root;
    for (const segment of folderSegments) {
      let next = cursor.folders.get(segment);
      if (next === undefined) {
        next = {
          label: humanize(segment),
          segment,
          folders: new Map(),
          pages: [],
        };
        cursor.folders.set(segment, next);
      }
      cursor = next;
    }
    cursor.pages.push(page);
  }

  return freezeFolder(root).children;
};

export const flattenNavigation = (
  nodes: ReadonlyArray<NavigationNode>,
): ReadonlyArray<NavigationPage> =>
  nodes.flatMap((node) =>
    node._tag === "Page" ? [node] : flattenNavigation(node.children),
  );
