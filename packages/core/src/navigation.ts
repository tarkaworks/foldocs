import type { PageMetadata } from "@foldocs/content";

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
  /** Root folders act as mutually exclusive documentation sections/tabs. */
  readonly root: boolean;
  readonly description?: string;
  readonly icon?: string;
  readonly children: ReadonlyArray<NavigationNode>;
}

/** A static sidebar section heading declared as `---Section---` in meta.json. */
export interface NavigationSeparator {
  readonly _tag: "Separator";
  readonly label: string;
}

export type NavigationNode =
  NavigationPage | NavigationFolder | NavigationSeparator;

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
  readonly description?: string;
  readonly icon?: string;
  readonly pages?: ReadonlyArray<string>;
  readonly defaultOpen?: boolean;
  readonly root?: boolean;
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

const folderLabel = (segment: string): string =>
  humanize(segment.replace(/^\((.*)\)$/u, "$1"));

const separatorLabel = (entry: string): string | undefined => {
  const match = /^---(.+?)---$/u.exec(entry.trim());
  const label = match?.[1]?.trim();
  return label === undefined || label.length === 0 ? undefined : label;
};

const orderChildren = (
  entries: ReadonlyArray<{
    readonly key: string;
    readonly node: NavigationPage | NavigationFolder;
  }>,
  pages: ReadonlyArray<string> | undefined,
): ReadonlyArray<NavigationNode> => {
  const sorted = [...entries].sort((left, right) => {
    if (left.node._tag === "Page" && right.node._tag === "Page")
      return comparePages(left.node.page, right.node.page);
    return left.node.label.localeCompare(right.node.label);
  });
  if (pages === undefined) return sorted.map(({ node }) => node);

  const explicitKeys = new Set(
    pages.filter(
      (entry) => entry !== "..." && separatorLabel(entry) === undefined,
    ),
  );
  const explicit = new Map(sorted.map((entry) => [entry.key, entry.node]));
  const remaining = sorted
    .filter(({ key }) => !explicitKeys.has(key))
    .map(({ node }) => node);
  const ordered: NavigationNode[] = [];
  const included = new Set<string>();
  let includedRemaining = false;

  for (const entry of pages) {
    const separator = separatorLabel(entry);
    if (separator !== undefined) {
      ordered.push({ _tag: "Separator", label: separator });
      continue;
    }
    if (entry === "...") {
      if (!includedRemaining) ordered.push(...remaining);
      includedRemaining = true;
      continue;
    }
    const node = explicit.get(entry);
    if (node !== undefined && !included.has(entry)) {
      ordered.push(node);
      included.add(entry);
    }
  }

  if (!includedRemaining) ordered.push(...remaining);
  return ordered;
};

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
  const children = orderChildren([...pages, ...folders], meta?.pages);
  return {
    _tag: "Folder",
    label: meta?.title ?? folder.label,
    segment: folder.segment,
    defaultOpen: meta?.defaultOpen ?? true,
    root: meta?.root ?? false,
    ...(meta?.description === undefined
      ? {}
      : { description: meta.description }),
    ...(meta?.icon === undefined ? {} : { icon: meta.icon }),
    children,
  };
};

const navigationPath = (
  page: PageMetadata,
): { readonly folders: ReadonlyArray<string>; readonly page: string } => {
  const segments = (page.navigationPath ?? page.translationKey ?? page.id)
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
    node._tag === "Page"
      ? [node]
      : node._tag === "Folder"
        ? flattenNavigation(node.children)
        : [],
  );

export interface NavigationTab {
  readonly title: string;
  readonly description?: string;
  readonly icon?: string;
  readonly url: string;
  readonly current: boolean;
}

const containsUrl = (node: NavigationNode, currentUrl: string): boolean =>
  node._tag === "Page"
    ? node.url === currentUrl
    : node._tag === "Folder"
      ? node.children.some((child) => containsUrl(child, currentUrl))
      : false;

const collectRootFolders = (
  nodes: ReadonlyArray<NavigationNode>,
): ReadonlyArray<NavigationFolder> =>
  nodes.flatMap((node) => {
    if (node._tag !== "Folder") return [];
    return node.root ? [node] : collectRootFolders(node.children);
  });

const activeRootFolder = (
  nodes: ReadonlyArray<NavigationNode>,
  currentUrl: string,
): NavigationFolder | undefined => {
  for (const node of nodes) {
    if (node._tag !== "Folder") continue;
    const nested = activeRootFolder(node.children, currentUrl);
    if (nested !== undefined) return nested;
    if (node.root && containsUrl(node, currentUrl)) return node;
  }
  return undefined;
};

const withoutRootFolders = (
  nodes: ReadonlyArray<NavigationNode>,
): ReadonlyArray<NavigationNode> => {
  const filtered = nodes.flatMap((node): ReadonlyArray<NavigationNode> => {
    if (node._tag !== "Folder") return [node];
    if (node.root) return [];
    const children = withoutRootFolders(node.children);
    return children.some((child) => child._tag !== "Separator")
      ? [{ ...node, children }]
      : [];
  });
  return filtered.filter((node, index) => {
    if (node._tag !== "Separator") return true;
    for (const candidate of filtered.slice(index + 1)) {
      if (candidate._tag === "Separator") return false;
      return true;
    }
    return false;
  });
};

/** Returns the sidebar tree visible for a URL, respecting Fumadocs-style roots. */
export const navigationForUrl = (
  nodes: ReadonlyArray<NavigationNode>,
  currentUrl: string,
): ReadonlyArray<NavigationNode> =>
  activeRootFolder(nodes, currentUrl)?.children ?? withoutRootFolders(nodes);

/** Returns layout tabs when the URL is inside a root folder. */
export const navigationTabsForUrl = (
  nodes: ReadonlyArray<NavigationNode>,
  currentUrl: string,
): ReadonlyArray<NavigationTab> => {
  const current = activeRootFolder(nodes, currentUrl);
  if (current === undefined) return [];
  return collectRootFolders(nodes).flatMap((folder) => {
    const url = flattenNavigation(folder.children)[0]?.url;
    if (url === undefined) return [];
    return [
      {
        title: folder.label,
        ...(folder.description === undefined
          ? {}
          : { description: folder.description }),
        ...(folder.icon === undefined ? {} : { icon: folder.icon }),
        url,
        current: folder === current,
      },
    ];
  });
};
