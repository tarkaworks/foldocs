import type { PageMetadata } from '@foldocs/content'

export interface NavigationPage {
  readonly _tag: 'Page'
  readonly label: string
  readonly icon?: string
  readonly url: string
  readonly page: PageMetadata
}

export interface NavigationLink {
  readonly _tag: 'Link'
  readonly label: string
  readonly icon?: string
  readonly url: string
  readonly external: boolean
}

export interface NavigationFolder {
  readonly _tag: 'Folder'
  readonly label: string
  readonly segment: string
  readonly directory: string
  readonly defaultOpen: boolean
  readonly collapsible: boolean
  /** Root folders act as mutually exclusive documentation sections/tabs. */
  readonly root: boolean
  readonly description?: string
  readonly icon?: string
  /** Optional page linked from the folder row instead of listed as a child. */
  readonly index?: NavigationPage | NavigationLink
  readonly children: ReadonlyArray<NavigationNode>
}

/** A static sidebar section heading declared as `---Section---` in meta.json. */
export interface NavigationSeparator {
  readonly _tag: 'Separator'
  readonly label: string
  readonly icon?: string
}

export type NavigationNode =
  NavigationPage | NavigationLink | NavigationFolder | NavigationSeparator

interface MutableFolder {
  label: string
  segment: string
  directory: string
  folders: Map<string, MutableFolder>
  pages: Array<{ readonly key: string; readonly page: PageMetadata }>
}

/** Fumadocs-compatible navigation metadata loaded from a directory's meta.json. */
export interface NavigationMeta {
  readonly title?: string
  readonly description?: string
  readonly icon?: string
  readonly pages?: ReadonlyArray<string>
  readonly defaultOpen?: boolean
  readonly collapsible?: boolean
  readonly root?: boolean
  readonly pagesIndex?: string
}

export type NavigationMetaMap = Readonly<Record<string, NavigationMeta>>

const humanize = (value: string): string =>
  value
    .replace(/[-_]+/gu, ' ')
    .replace(/\b\p{L}/gu, letter => letter.toUpperCase())

const pageOrder = (page: PageMetadata): number =>
  page.frontmatter.order ?? Number.MAX_SAFE_INTEGER

const comparePages = (left: PageMetadata, right: PageMetadata): number =>
  pageOrder(left) - pageOrder(right) ||
  left.frontmatter.title.localeCompare(right.frontmatter.title)

const folderLabel = (segment: string): string =>
  humanize(segment.replace(/^\((.*)\)$/u, '$1'))

const separator = (entry: string): NavigationSeparator | undefined => {
  const match = /^---(?:\[([^\]]+)\])?(.+?)---$/u.exec(entry.trim())
  const label = match?.[2]?.trim()
  if (label === undefined || label.length === 0) return undefined
  const icon = match?.[1]?.trim()
  return {
    _tag: 'Separator',
    label,
    ...(icon === undefined || icon.length === 0 ? {} : { icon }),
  }
}

const navigationLink = (entry: string): NavigationLink | undefined => {
  const trimmed = entry.trim()
  const external = trimmed.startsWith('external:')
  const value = external ? trimmed.slice('external:'.length) : trimmed
  const withIcon = /^\[([^\]]+)\]\[([^\]]+)\]\((.+)\)$/u.exec(value)
  if (withIcon !== null)
    return {
      _tag: 'Link',
      icon: withIcon[1]!,
      label: withIcon[2]!,
      url: withIcon[3]!,
      external,
    }
  const plain = /^\[([^\]]+)\]\((.+)\)$/u.exec(value)
  if (plain === null) return undefined
  return {
    _tag: 'Link',
    label: plain[1]!,
    url: plain[2]!,
    external,
  }
}

const normalizeMetaPath = (value: string): string =>
  value.replace(/^\.\//u, '').replace(/\.(?:md|mdx)$/iu, '')

type OrderEntry = Readonly<{
  key: string
  node: NavigationPage | NavigationFolder
}>

const nodeByPath = (
  entries: ReadonlyArray<OrderEntry>,
  rawPath: string,
): NavigationPage | NavigationFolder | undefined => {
  const [head, ...tail] = normalizeMetaPath(rawPath).split('/').filter(Boolean)
  const entry = entries.find(candidate => candidate.key === head)
  if (entry === undefined || tail.length === 0) return entry?.node
  if (entry.node._tag !== 'Folder') return undefined
  const children: OrderEntry[] = entry.node.children.flatMap(
    (node): ReadonlyArray<OrderEntry> => {
      if (node._tag === 'Folder') return [{ key: node.segment, node }]
      if (node._tag !== 'Page') return []
      return [
        {
          key: node.page.slug.split('/').at(-1) ?? node.label,
          node,
        },
      ]
    },
  )
  return nodeByPath(children, tail.join('/'))
}

const orderChildren = (
  entries: ReadonlyArray<OrderEntry>,
  pages: ReadonlyArray<string> | undefined,
): ReadonlyArray<NavigationNode> => {
  const sorted = [...entries].sort((left, right) => {
    if (left.node._tag === 'Page' && right.node._tag === 'Page')
      return comparePages(left.node.page, right.node.page)
    if (left.node._tag !== right.node._tag)
      return left.node._tag === 'Page' ? -1 : 1
    return left.node.label.localeCompare(right.node.label)
  })
  if (pages === undefined) return sorted.map(({ node }) => node)

  const excludedKeys = new Set(
    pages
      .filter(entry => entry.startsWith('!'))
      .map(entry => normalizeMetaPath(entry.slice(1))),
  )
  const explicitKeys = new Set(
    pages.flatMap(entry => {
      if (
        entry === '...' ||
        entry === 'z...a' ||
        entry.startsWith('!') ||
        entry.startsWith('...') ||
        separator(entry) !== undefined ||
        navigationLink(entry) !== undefined
      )
        return []
      return [normalizeMetaPath(entry).split('/')[0]!]
    }),
  )
  const explicit = new Map(sorted.map(entry => [entry.key, entry.node]))
  const remaining = sorted.filter(
    ({ key }) => !explicitKeys.has(key) && !excludedKeys.has(key),
  )
  const ordered: NavigationNode[] = []
  const included = new Set<string>()
  let includedRemaining = false

  for (const entry of pages) {
    const separatorNode = separator(entry)
    if (separatorNode !== undefined) {
      ordered.push(separatorNode)
      continue
    }
    const link = navigationLink(entry)
    if (link !== undefined) {
      ordered.push(link)
      continue
    }
    if (entry === '...' || entry === 'z...a') {
      if (!includedRemaining)
        ordered.push(
          ...(entry === 'z...a' ? remaining.toReversed() : remaining)
            .filter(({ key }) => !included.has(key))
            .map(({ node }) => node),
        )
      includedRemaining = true
      continue
    }
    if (entry.startsWith('!')) continue
    if (entry.startsWith('...')) {
      const key = normalizeMetaPath(entry.slice(3))
      const node = explicit.get(key)
      if (node?._tag === 'Folder' && !included.has(key)) {
        ordered.push(
          ...(node.index === undefined ? [] : [node.index]),
          ...node.children,
        )
        included.add(key)
      }
      continue
    }
    const key = normalizeMetaPath(entry)
    const node = nodeByPath(sorted, key)
    if (node !== undefined && !included.has(key)) {
      ordered.push(node)
      included.add(key)
    }
  }

  return ordered
}

const freezeFolder = (
  folder: MutableFolder,
  metadata: NavigationMetaMap,
): NavigationFolder => {
  const meta = metadata[folder.directory]
  const folders = [...folder.folders.values()].map(child => ({
    key: child.segment,
    node: freezeFolder(child, metadata),
  }))
  const pages = folder.pages
    .sort((left, right) => comparePages(left.page, right.page))
    .map(({ key, page }) => ({
      key,
      node: {
        _tag: 'Page',
        label: page.frontmatter.label ?? page.frontmatter.title,
        ...(page.frontmatter.icon === undefined
          ? {}
          : { icon: page.frontmatter.icon }),
        url: page.url,
        page,
      } satisfies NavigationPage,
    }))
  const configuredIndex =
    meta?.pagesIndex === undefined
      ? undefined
      : (navigationLink(meta.pagesIndex) ??
        nodeByPath([...pages, ...folders], meta.pagesIndex))
  const indexEntry = pages.find(
    ({ key, node }) =>
      node.page.frontmatter.index === true ||
      (key === 'index' &&
        folder.directory.length > 0 &&
        !/^\(.+\)$/u.test(folder.segment)),
  )
  const index =
    configuredIndex?._tag === 'Page' || configuredIndex?._tag === 'Link'
      ? configuredIndex
      : indexEntry?.node
  const children = orderChildren(
    [...pages.filter(entry => entry.node !== index), ...folders],
    meta?.pages,
  )
  return {
    _tag: 'Folder',
    label: meta?.title ?? folder.label,
    segment: folder.segment,
    directory: folder.directory,
    defaultOpen: meta?.defaultOpen ?? true,
    collapsible: meta?.collapsible ?? true,
    root: meta?.root ?? false,
    ...(meta?.description === undefined
      ? {}
      : { description: meta.description }),
    ...(meta?.icon === undefined ? {} : { icon: meta.icon }),
    ...(index === undefined ? {} : { index }),
    children,
  }
}

const navigationPath = (
  page: PageMetadata,
): { readonly folders: ReadonlyArray<string>; readonly page: string } => {
  const segments = (page.navigationPath ?? page.translationKey ?? page.id)
    .replace(/\.(?:md|mdx)$/iu, '')
    .split('/')
    .filter(Boolean)
  const pageKey = segments.pop() ?? 'index'
  return { folders: segments, page: pageKey }
}

export const buildNavigation = (
  pages: ReadonlyArray<PageMetadata>,
  metadata: NavigationMetaMap = {},
): ReadonlyArray<NavigationNode> => {
  const root: MutableFolder = {
    label: 'Documentation',
    segment: '',
    directory: '',
    folders: new Map(),
    pages: [],
  }

  for (const page of pages) {
    if (page.frontmatter.hidden === true || page.frontmatter.draft === true)
      continue
    const { folders: folderSegments, page: pageKey } = navigationPath(page)
    let cursor = root
    for (const segment of folderSegments) {
      let next = cursor.folders.get(segment)
      if (next === undefined) {
        const directory = [cursor.directory, segment].filter(Boolean).join('/')
        next = {
          label: folderLabel(segment),
          segment,
          directory,
          folders: new Map(),
          pages: [],
        }
        cursor.folders.set(segment, next)
      }
      cursor = next
    }
    cursor.pages.push({ key: pageKey, page })
  }

  return freezeFolder(root, metadata).children
}

export const flattenNavigation = (
  nodes: ReadonlyArray<NavigationNode>,
): ReadonlyArray<NavigationPage> =>
  nodes.flatMap(node =>
    node._tag === 'Page'
      ? [node]
      : node._tag === 'Folder'
        ? [
            ...(node.index?._tag === 'Page' ? [node.index] : []),
            ...flattenNavigation(node.children),
          ]
        : [],
  )

/** Returns the ancestor folder labels for a page URL in display order. */
export const navigationContextForUrl = (
  nodes: ReadonlyArray<NavigationNode>,
  currentUrl: string,
  ancestors: ReadonlyArray<string> = [],
): ReadonlyArray<string> | undefined => {
  for (const node of nodes) {
    if (node._tag === 'Separator' || node._tag === 'Link') continue
    if (node._tag === 'Page') {
      if (node.url === currentUrl) return ancestors
      continue
    }
    if (node.index?.url === currentUrl) return ancestors
    const nested = navigationContextForUrl(node.children, currentUrl, [
      ...ancestors,
      node.label,
    ])
    if (nested !== undefined) return nested
  }
  return undefined
}

export interface NavigationTab {
  readonly title: string
  readonly description?: string
  readonly icon?: string
  readonly url: string
  readonly current: boolean
}

/** Returns whether a page or folder contains the canonical URL. */
export const navigationContainsUrl = (
  node: NavigationNode,
  currentUrl: string,
): boolean =>
  node._tag === 'Page'
    ? node.url === currentUrl
    : node._tag === 'Link'
      ? false
      : node._tag === 'Folder'
        ? node.index?.url === currentUrl ||
          node.children.some(child => navigationContainsUrl(child, currentUrl))
        : false

/** Returns the sidebar ancestor-folder keys for the canonical URL. */
export const navigationFolderKeysForUrl = (
  nodes: ReadonlyArray<NavigationNode>,
  currentUrl: string,
  parentKey = '',
): ReadonlyArray<string> => {
  for (const node of nodes) {
    if (node._tag !== 'Folder' || !navigationContainsUrl(node, currentUrl))
      continue

    if (node.root)
      return navigationFolderKeysForUrl(node.children, currentUrl, parentKey)

    // The folder row represents its index, so that folder is not an ancestor
    // and remains explicitly collapsible while its index page is active.
    if (node.index?.url === currentUrl) return []

    const key = `${parentKey}/${node.segment}`
    return [key, ...navigationFolderKeysForUrl(node.children, currentUrl, key)]
  }
  return []
}

const collectRootFolders = (
  nodes: ReadonlyArray<NavigationNode>,
): ReadonlyArray<NavigationFolder> =>
  nodes.flatMap(node => {
    if (node._tag !== 'Folder') return []
    return node.root ? [node] : collectRootFolders(node.children)
  })

const activeRootFolder = (
  nodes: ReadonlyArray<NavigationNode>,
  currentUrl: string,
): NavigationFolder | undefined => {
  for (const node of nodes) {
    if (node._tag !== 'Folder') continue
    const nested = activeRootFolder(node.children, currentUrl)
    if (nested !== undefined) return nested
    if (node.root && navigationContainsUrl(node, currentUrl)) return node
  }
  return undefined
}

const withoutRootFolders = (
  nodes: ReadonlyArray<NavigationNode>,
): ReadonlyArray<NavigationNode> => {
  const filtered = nodes.flatMap((node): ReadonlyArray<NavigationNode> => {
    if (node._tag !== 'Folder') return [node]
    if (node.root) return []
    const children = withoutRootFolders(node.children)
    return node.index !== undefined ||
      children.some(child => child._tag !== 'Separator')
      ? [{ ...node, children }]
      : []
  })
  return filtered.filter((node, index) => {
    if (node._tag !== 'Separator') return true
    for (const candidate of filtered.slice(index + 1)) {
      if (candidate._tag === 'Separator') return false
      return true
    }
    return false
  })
}

/** Returns the sidebar tree visible for a URL, respecting configured roots. */
export const navigationForUrl = (
  nodes: ReadonlyArray<NavigationNode>,
  currentUrl: string,
): ReadonlyArray<NavigationNode> => {
  const root = activeRootFolder(nodes, currentUrl)
  if (root === undefined) return withoutRootFolders(nodes)
  return [...(root.index === undefined ? [] : [root.index]), ...root.children]
}

/** Returns layout tabs when the URL is inside a root folder. */
export const navigationTabsForUrl = (
  nodes: ReadonlyArray<NavigationNode>,
  currentUrl: string,
): ReadonlyArray<NavigationTab> => {
  const current = activeRootFolder(nodes, currentUrl)
  if (current === undefined) return []
  return collectRootFolders(nodes).flatMap(folder => {
    const url = folder.index?.url ?? flattenNavigation(folder.children)[0]?.url
    if (url === undefined) return []
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
    ]
  })
}
