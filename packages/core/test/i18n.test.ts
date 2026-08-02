import { describe, expect, it } from 'vitest'

import {
  localeFromPathname,
  localizedPathname,
  resolveConfig,
  stripLocalePrefix,
} from '../src/config.js'

const config = resolveConfig({
  site: { title: 'Example' },
  i18n: {
    defaultLocale: 'en',
    fallbackLocale: 'en',
    locales: [
      { locale: 'en', name: 'English' },
      {
        locale: 'ar',
        name: 'العربية',
        dir: 'rtl',
        ui: { search: 'بحث' },
      },
    ],
  },
})

describe('i18n configuration', () => {
  it('resolves directions, UI fallbacks, and locale overrides', () => {
    expect(config.i18n.enabled).toBe(true)
    expect(config.i18n.locales[1]?.dir).toBe('rtl')
    expect(config.i18n.locales[1]?.ui.search).toBe('بحث')
    expect(config.i18n.locales[1]?.ui.searchResults).toBe('Search results')
  })

  it('localizes and strips documentation paths', () => {
    expect(localizedPathname(config.i18n, 'ar', '/docs/setup')).toBe(
      '/ar/docs/setup',
    )
    expect(localizedPathname(config.i18n, 'en', '/ar/docs/setup')).toBe(
      '/en/docs/setup',
    )
    expect(stripLocalePrefix(config.i18n, '/ar/docs/setup')).toBe('/docs/setup')
    expect(localeFromPathname(config.i18n, '/ar/docs/setup')).toBe('ar')
    expect(localeFromPathname(config.i18n, '/docs/setup')).toBe('en')
  })

  it('rejects missing default locales', () => {
    expect(() =>
      resolveConfig({
        site: { title: 'Invalid' },
        i18n: {
          defaultLocale: 'fr',
          locales: [{ locale: 'en', name: 'English' }],
        },
      }),
    ).toThrow(/default locale fr/u)
  })
})
