import {
  ArrowRight,
  Blocks,
  BookOpen,
  Braces,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  CodeXml,
  Copy,
  Database,
  FileText,
  Files,
  Folder,
  FolderOpen,
  GitBranch,
  Globe,
  House,
  type IconNode,
  Info,
  Languages,
  Lightbulb,
  Link,
  LockKeyhole,
  Maximize,
  Menu,
  Monitor,
  Moon,
  Package,
  PanelsTopLeft,
  Plug,
  Radio,
  Rocket,
  Scale,
  Search,
  Settings,
  Sparkles,
  Sun,
  TriangleAlert,
  Wrench,
  X,
  Zap,
} from 'lucide'

export const foldocsLogoSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="currentColor" aria-hidden="true"><path d="M148.656 50.395c-.055-18.276-21.816-33.88-48.655-34.395-26.918.273-48.615 16.1-48.595 34.457-.008 9.88 6.315 18.623 16.361 24.564C57.6 81.174 51.08 90.084 51.02 100c.058 9.917 6.54 18.843 16.7 25.016-10.072 5.957-16.408 14.718-16.375 24.59C51.4 167.88 73.16 183.485 100 184c26.917-.273 48.614-16.1 48.594-34.457.008-9.88-6.315-18.623-16.362-24.564 10.169-6.153 16.688-15.063 16.748-24.979-.058-9.917-6.54-18.842-16.7-25.016 10.072-5.957 16.408-14.718 16.375-24.59"/></svg>'

/** Generic interface icons use the same Lucide nodes as Fumadocs. */
export const icons = {
  search: lucideSvg(Search),
  menu: lucideSvg(Menu),
  close: lucideSvg(X),
  chevron: lucideSvg(ChevronDown),
  chevronLeft: lucideSvg(ChevronLeft),
  chevronRight: lucideSvg(ChevronRight),
  globe: lucideSvg(Globe),
  light: lucideSvg(Sun),
  system: lucideSvg(Monitor),
  dark: lucideSvg(Moon),
  github:
    '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"/></svg>',
  discord:
    '<svg viewBox="0 0 256 199" fill="currentColor" aria-hidden="true"><path d="M216.856 16.597A208.502 208.502 0 0 0 164.042 0c-2.275 4.113-4.933 9.645-6.766 14.046-19.692-2.961-39.203-2.961-58.533 0-1.832-4.4-4.55-9.933-6.846-14.046a207.809 207.809 0 0 0-52.855 16.638C5.618 67.147-3.443 116.4 1.087 164.956c22.169 16.555 43.653 26.612 64.775 33.193A161.094 161.094 0 0 0 79.735 175.3a136.413 136.413 0 0 1-21.846-10.632 108.636 108.636 0 0 0 5.355-4.237c42.122 19.702 87.89 19.702 129.51 0a131.66 131.66 0 0 0 5.355 4.237 136.07 136.07 0 0 1-21.886 10.653c4.006 8.02 8.638 15.67 13.873 22.848 21.142-6.58 42.646-16.637 64.815-33.213 5.316-56.288-9.08-108.36-38.056-148.36ZM85.474 135.095c-12.645 0-23.015-11.805-23.015-26.18s10.149-26.2 23.015-26.2c12.867 0 23.236 11.804 23.015 26.2.02 14.375-10.148 26.18-23.015 26.18Zm85.051 0c-12.645 0-23.014-11.805-23.014-26.18s10.148-26.2 23.014-26.2c12.867 0 23.236 11.804 23.015 26.2 0 14.375-10.148 26.18-23.015 26.18Z"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>',
  npm: '<svg viewBox="0 0 780 250" fill="currentColor" aria-hidden="true"><path d="M240 250h100v-50h100V0H240v250Zm100-200h50v100h-50V50ZM480 0v200h100V50h50v150h50V50h50v150h50V0H480ZM0 200h100V50h50v150h50V0H0v200Z"/></svg>',
  copy: lucideSvg(Copy),
  check: lucideSvg(Check),
  arrow: lucideSvg(ArrowRight),
  markdown: lucideSvg(FileText),
  bolt: lucideSvg(Zap),
  lock: lucideSvg(LockKeyhole),
  expand: lucideSvg(Maximize),
  link: lucideSvg(Link),
  information: lucideSvg(Info),
  warning: lucideSvg(TriangleAlert),
  success: lucideSvg(CircleCheck),
  error: lucideSvg(CircleX),
  idea: lucideSvg(Lightbulb),
} as const

export type IconName = keyof typeof icons

const lucideNavigationIcons: Readonly<Record<string, IconNode>> = {
  blocks: Blocks,
  'book-open': BookOpen,
  braces: Braces,
  check: Check,
  code: CodeXml,
  'code-xml': CodeXml,
  database: Database,
  file: FileText,
  'file-text': FileText,
  files: Files,
  folder: Folder,
  'folder-open': FolderOpen,
  'git-branch': GitBranch,
  home: House,
  information: Info,
  languages: Languages,
  package: Package,
  'panels-top-left': PanelsTopLeft,
  plug: Plug,
  radio: Radio,
  rocket: Rocket,
  scale: Scale,
  search: Search,
  settings: Settings,
  sparkles: Sparkles,
  wrench: Wrench,
}

const normalizedIconName = (name: string): string =>
  name
    .trim()
    .replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
    .replace(/[\s_]+/gu, '-')
    .toLowerCase()

function escapeAttribute(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function attributeName(name: string): string {
  return name.replace(/[A-Z]/gu, letter => `-${letter.toLowerCase()}`)
}

function lucideSvg(node: IconNode): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${node
    .map(
      ([tag, attributes]) =>
        `<${tag} ${Object.entries(attributes)
          .filter(([name]) => name !== 'key')
          .map(
            ([name, value]) =>
              `${attributeName(name)}="${escapeAttribute(value)}"`,
          )
          .join(' ')} />`,
    )
    .join('')}</svg>`
}

/** Resolve navigation icon names to tree-shaken Lucide SVGs or user SVG overrides. */
export const navigationIconSvg = (
  name: string,
  customIcons: Readonly<Record<string, string>> | undefined,
): string | undefined => {
  const normalized = normalizedIconName(name)
  const custom = customIcons?.[name] ?? customIcons?.[normalized]
  if (custom !== undefined) return custom
  const node = lucideNavigationIcons[normalized]
  return node === undefined ? undefined : lucideSvg(node)
}
