import type { ResolvedSeoConfig, SiteConfig } from './config.js'

export interface SeoBreadcrumb {
  readonly name: string
  readonly url: string
}

export interface SeoJsonLdInput {
  readonly kind: 'landing' | 'page'
  readonly site: SiteConfig
  readonly seo: ResolvedSeoConfig
  readonly title: string
  readonly description?: string
  readonly url?: string
  readonly image?: string
  readonly locale: string
  readonly locales?: ReadonlyArray<string>
  readonly lastModified?: string
  readonly keywords?: ReadonlyArray<string>
  readonly breadcrumbs?: ReadonlyArray<SeoBreadcrumb>
}

export const formatSeoTitle = (
  title: string,
  siteTitle: string,
  template: string,
): string =>
  title === siteTitle ? siteTitle : template.replaceAll('%s', title)

export const openGraphLocale = (locale: string): string => {
  try {
    const maximized = new Intl.Locale(locale).maximize()
    return maximized.region === undefined
      ? maximized.language
      : `${maximized.language}_${maximized.region}`
  } catch {
    return locale.replace('-', '_')
  }
}

export const robotsContent = (seo: ResolvedSeoConfig): string =>
  [
    seo.robots.index ? 'index' : 'noindex',
    seo.robots.follow ? 'follow' : 'nofollow',
    'max-image-preview:large',
    'max-snippet:-1',
    'max-video-preview:-1',
  ].join(', ')

const absoluteUrl = (baseUrl: string, value: string): string =>
  new URL(
    value.replace(/^\//u, ''),
    `${baseUrl.replace(/\/+$/u, '')}/`,
  ).toString()

const entityUrl = (
  baseUrl: string,
  value: string | undefined,
): string | undefined =>
  value === undefined ? undefined : absoluteUrl(baseUrl, value)

const sameEntity = (
  left: ResolvedSeoConfig['author'],
  right: ResolvedSeoConfig['publisher'],
): boolean =>
  left.name === right.name && left.url === right.url && left.type === right.type

/** Builds the Schema.org graph embedded into every prerendered Foldocs route. */
export const buildSeoJsonLd = (
  input: SeoJsonLdInput,
): Readonly<Record<string, unknown>> | undefined => {
  if (
    !input.seo.jsonLd ||
    input.site.baseUrl === undefined ||
    input.url === undefined
  )
    return undefined

  const baseUrl = input.site.baseUrl
  const siteUrl = absoluteUrl(baseUrl, '')
  const canonical = absoluteUrl(baseUrl, input.url)
  const organizationId = `${siteUrl}#organization`
  const authorId = sameEntity(input.seo.author, input.seo.publisher)
    ? organizationId
    : `${siteUrl}#author`
  const websiteId = `${siteUrl}#website`
  const webpageId = `${canonical}#webpage`
  const articleId = `${canonical}#article`
  const imageId = `${canonical}#primaryimage`
  const publisherUrl = entityUrl(baseUrl, input.seo.publisher.url)
  const publisherLogo = entityUrl(
    baseUrl,
    input.seo.publisher.logo ?? input.site.favicon,
  )
  const authorUrl = entityUrl(baseUrl, input.seo.author.url)
  const xProfile = (handle: string | undefined): string | undefined =>
    handle === undefined
      ? undefined
      : `https://x.com/${handle.replace(/^@/u, '')}`
  const sameAs = [
    ...new Set(
      [
        input.site.githubUrl,
        input.site.xUrl,
        input.site.npmUrl,
        input.site.discordUrl,
        xProfile(input.seo.twitterSite),
      ].filter((value): value is string => value !== undefined),
    ),
  ]
  const authorSameAs = xProfile(input.seo.twitterCreator)

  const publisher = {
    '@type': input.seo.publisher.type ?? 'Organization',
    '@id': organizationId,
    name: input.seo.publisher.name,
    ...(publisherUrl === undefined ? {} : { url: publisherUrl }),
    ...(publisherLogo === undefined
      ? {}
      : {
          logo: {
            '@type': 'ImageObject',
            url: publisherLogo,
          },
        }),
    ...(sameAs.length === 0 ? {} : { sameAs }),
  }
  const author = sameEntity(input.seo.author, input.seo.publisher)
    ? undefined
    : {
        '@type': input.seo.author.type ?? 'Person',
        '@id': authorId,
        name: input.seo.author.name,
        ...(authorUrl === undefined ? {} : { url: authorUrl }),
        ...(authorSameAs === undefined ? {} : { sameAs: [authorSameAs] }),
      }
  const website = {
    '@type': 'WebSite',
    '@id': websiteId,
    url: siteUrl,
    name: input.site.title,
    ...(input.site.description === undefined
      ? {}
      : { description: input.site.description }),
    inLanguage: input.locales ?? [input.locale],
    publisher: { '@id': organizationId },
  }
  const image =
    input.image === undefined
      ? undefined
      : {
          '@type': 'ImageObject',
          '@id': imageId,
          url: absoluteUrl(baseUrl, input.image),
          contentUrl: absoluteUrl(baseUrl, input.image),
          caption: input.title,
        }
  const breadcrumb =
    input.kind === 'landing' || input.breadcrumbs === undefined
      ? undefined
      : {
          '@type': 'BreadcrumbList',
          '@id': `${canonical}#breadcrumb`,
          itemListElement: input.breadcrumbs.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: absoluteUrl(baseUrl, item.url),
          })),
        }
  const webpage = {
    '@type': 'WebPage',
    '@id': webpageId,
    url: canonical,
    name: input.title,
    ...(input.description === undefined
      ? {}
      : { description: input.description }),
    isPartOf: { '@id': websiteId },
    inLanguage: input.locale,
    ...(image === undefined ? {} : { primaryImageOfPage: { '@id': imageId } }),
    ...(breadcrumb === undefined
      ? {}
      : { breadcrumb: { '@id': breadcrumb['@id'] } }),
    ...(input.kind === 'page' ? { mainEntity: { '@id': articleId } } : {}),
  }
  const article =
    input.kind === 'landing'
      ? undefined
      : {
          '@type': 'Article',
          additionalType: 'https://schema.org/TechArticle',
          '@id': articleId,
          headline: input.title,
          ...(input.description === undefined
            ? {}
            : { description: input.description }),
          url: canonical,
          mainEntityOfPage: { '@id': webpageId },
          isPartOf: { '@id': websiteId },
          author: { '@id': authorId },
          publisher: { '@id': organizationId },
          inLanguage: input.locale,
          ...(image === undefined ? {} : { image: { '@id': imageId } }),
          ...(input.lastModified === undefined
            ? {}
            : { dateModified: input.lastModified }),
          ...(input.keywords === undefined || input.keywords.length === 0
            ? {}
            : { keywords: input.keywords.join(', ') }),
        }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      publisher,
      ...(author === undefined ? [] : [author]),
      website,
      ...(image === undefined ? [] : [image]),
      webpage,
      ...(article === undefined ? [] : [article]),
      ...(breadcrumb === undefined ? [] : [breadcrumb]),
    ],
  }
}

/** Serializes JSON-LD without allowing metadata to terminate the script node. */
export const serializeJsonLd = (
  value: Readonly<Record<string, unknown>>,
): string =>
  JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
