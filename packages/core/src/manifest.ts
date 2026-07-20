import type { PageMetadata } from "@foldocs/content";

import { flattenNavigation, type NavigationNode } from "./navigation.js";

export interface PageModule<Page> {
  readonly default: Page;
}

export interface PageManifestEntry<Page> extends PageMetadata {
  readonly load: () => Promise<PageModule<Page>>;
}

export type PageManifest<Page> = ReadonlyArray<PageManifestEntry<Page>>;

const normalizePathname = (pathname: string): string => {
  const withoutQuery = pathname.split(/[?#]/u, 1)[0] ?? pathname;
  if (withoutQuery.length > 1) return withoutQuery.replace(/\/+$/, "");
  return withoutQuery;
};

export const findPageByUrl = <Page>(
  manifest: PageManifest<Page>,
  pathname: string,
): PageManifestEntry<Page> | undefined => {
  const normalized = normalizePathname(pathname);
  return manifest.find((page) => normalizePathname(page.url) === normalized);
};

export const findPageBySlug = <Page>(
  manifest: PageManifest<Page>,
  slug: string,
): PageManifestEntry<Page> | undefined =>
  manifest.find((page) => page.slug === slug);

export const adjacentPages = <Page>(
  manifest: PageManifest<Page>,
  pathname: string,
  navigation?: ReadonlyArray<NavigationNode>,
): Readonly<{
  previous?: PageManifestEntry<Page>;
  next?: PageManifestEntry<Page>;
}> => {
  const current = findPageByUrl(manifest, pathname);
  if (current === undefined) return {};
  const visible =
    navigation === undefined
      ? manifest
          .filter(
            (page) =>
              page.frontmatter.hidden !== true &&
              page.frontmatter.draft !== true &&
              (current.locale === undefined || page.locale === current.locale),
          )
          .toSorted(
            (left, right) =>
              (left.frontmatter.order ?? Number.MAX_SAFE_INTEGER) -
                (right.frontmatter.order ?? Number.MAX_SAFE_INTEGER) ||
              left.slug.localeCompare(right.slug),
          )
      : flattenNavigation(navigation).flatMap((item) => {
          const page = manifest.find((entry) => entry.id === item.page.id);
          return page === undefined ? [] : [page];
        });
  const index = visible.findIndex((page) => page.id === current.id);
  if (index === -1) return {};
  return {
    ...(index > 0 ? { previous: visible[index - 1] } : {}),
    ...(index < visible.length - 1 ? { next: visible[index + 1] } : {}),
  };
};
