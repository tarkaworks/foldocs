import AxeBuilder from '@axe-core/playwright'
import { type Page, expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/_vercel/insights/script.js', async route => {
    await route.fulfill({
      body: '',
      contentType: 'application/javascript',
      status: 200,
    })
  })
})

const expectNoRuntimeErrors = (page: Page): Array<string> => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

const waitForRuntime = (page: Page) =>
  page.locator('html[data-foldocs-ready="true"]').waitFor()

const expectNoSeriousAccessibilityViolations = async (page: Page) => {
  const result = await new AxeBuilder({ page })
    .include('.fd-root')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(
    result.violations.filter(
      violation =>
        violation.impact === 'serious' || violation.impact === 'critical',
    ),
  ).toEqual([])
}

test('landing and docs have no serious WCAG violations', async ({ page }) => {
  await page.goto('/en')
  await waitForRuntime(page)
  await expectNoSeriousAccessibilityViolations(page)

  await page.goto('/en/docs/ui/components')
  await waitForRuntime(page)
  await expectNoSeriousAccessibilityViolations(page)
})

test('prerendered homepage, localized docs, Markdown, and remote content agree', async ({
  page,
  request,
}) => {
  const errors = expectNoRuntimeErrors(page)
  await page.addInitScript(() => {
    const loadingStates: Array<string> = []
    Object.defineProperty(window, '__foldocsLoadingStates', {
      value: loadingStates,
      configurable: true,
    })
    const rememberLoadingState = (node: Node): void => {
      const text = node.textContent ?? ''
      if (
        text.includes('Loading documentation') &&
        !loadingStates.includes(text)
      )
        loadingStates.push(text)
    }
    new MutationObserver(records => {
      for (const record of records) {
        rememberLoadingState(record.target)
        for (const node of record.addedNodes) rememberLoadingState(node)
      }
    }).observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  })
  await page.goto('/')
  await expect(page).toHaveURL(/\/en$/u)
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://foldocs.vercel.app/og/en/home.png',
  )
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
    'content',
    'https://foldocs.vercel.app/og/en/home.png',
  )
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
    'content',
    'Foldocs',
  )
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
    'content',
    'en_US',
  )
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    /max-image-preview:large/u,
  )
  await expect(page.locator('#foldocs-json-ld')).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'documentation framework',
  )
  expect(
    await page.evaluate(
      () =>
        (
          window as Window & {
            __foldocsLoadingStates: ReadonlyArray<string>
          }
        ).__foldocsLoadingStates,
    ),
  ).toEqual([])

  await page.getByRole('link', { name: /^Read the docs$/iu }).click()
  await expect(page).toHaveURL(/\/en\/docs$/u)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Quick Start',
  )
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://foldocs.vercel.app/og/en/index.png',
  )
  const jsonLd = JSON.parse(
    (await page.locator('#foldocs-json-ld').textContent()) ?? '{}',
  ) as { '@graph'?: ReadonlyArray<{ '@type'?: string }> }
  expect(jsonLd['@graph']?.some(node => node['@type'] === 'Article')).toBe(true)
  expect(
    jsonLd['@graph']?.some(node => node['@type'] === 'BreadcrumbList'),
  ).toBe(true)
  expect(
    await page.evaluate(
      () =>
        (
          window as Window & {
            __foldocsLoadingStates: ReadonlyArray<string>
          }
        ).__foldocsLoadingStates,
    ),
  ).toEqual([])

  await page.goto('/en/docs')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Quick Start',
  )
  expect(
    await page.evaluate(
      () =>
        (
          window as Window & {
            __foldocsLoadingStates: ReadonlyArray<string>
          }
        ).__foldocsLoadingStates,
    ),
  ).toEqual([])
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Quick Start',
  )
  expect(
    await page.evaluate(
      () =>
        (
          window as Window & {
            __foldocsLoadingStates: ReadonlyArray<string>
          }
        ).__foldocsLoadingStates,
    ),
  ).toEqual([])
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://foldocs.vercel.app/en/docs',
  )

  await page.locator('.fd-sidebar-link-root[href="/en/docs"]').click()
  await expect(page).toHaveURL(/\/en\/docs$/u)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Quick Start',
  )
  expect(
    await page.evaluate(
      () =>
        (
          window as Window & {
            __foldocsLoadingStates: ReadonlyArray<string>
          }
        ).__foldocsLoadingStates,
    ),
  ).toEqual([])

  const markdown = await request.get('/en/docs.md')
  expect(markdown.ok()).toBe(true)
  expect(markdown.headers()['content-type']).toContain('text/markdown')
  expect(await markdown.text()).toContain('# Quick Start')

  const staticHtml = await request.get('/en/docs')
  expect(staticHtml.ok()).toBe(true)
  const staticSource = await staticHtml.text()
  expect(staticSource).toContain('Quick Start')
  expect(staticSource).not.toContain('Loading documentation')
  expect(staticSource).toContain('id="foldocs-json-ld"')
  expect(staticSource).toContain('TechArticle')

  const robots = await request.get('/robots.txt')
  expect(robots.ok()).toBe(true)
  expect(await robots.text()).toContain(
    'Sitemap: https://foldocs.vercel.app/sitemap.xml',
  )

  const localizedAsset = await request.get(
    '/es/docs/guides/_assets/portable.svg',
  )
  expect(localizedAsset.ok()).toBe(true)
  expect(localizedAsset.headers()['content-type']).toContain('image/svg+xml')

  await page.goto('/en/docs/integrations/content/remote-adapter')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Remote and CMS content',
  )
  expect(errors).toEqual([])
})

test('landing uses the shared docs header and the footer keeps its attribution', async ({
  page,
}) => {
  const errors = expectNoRuntimeErrors(page)
  await page.goto('/en')
  await expect(
    page.locator('script[src="/_vercel/insights/script.js"]'),
  ).toHaveCount(1)

  const header = page.locator('.fd-landing-header')
  await expect(header).toBeVisible()
  await expect(header).toHaveClass(/fd-docs-header/u)
  await expect(header).not.toHaveAttribute('aria-hidden', 'true')
  await expect(header.locator('#fd-search-trigger')).toBeVisible()
  await expect(header.locator('.fd-language-trigger')).toBeVisible()
  await expect(header.locator('.fd-theme-selector')).toBeVisible()
  await header.locator('#fd-search-trigger').click()
  const searchDialog = page.getByRole('dialog', {
    name: 'Search documentation',
  })
  await expect(searchDialog).toBeVisible()
  await expect(searchDialog.getByRole('combobox')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(searchDialog).toBeHidden()
  await expect(header.locator('#fd-search-trigger')).toBeFocused()
  await expect(
    header.locator('.fd-social-link[aria-label="GitHub"]'),
  ).toHaveAttribute('href', 'https://github.com/tarkaworks/foldocs')
  await expect(
    header.locator('.fd-social-link[aria-label="npm"]'),
  ).toBeVisible()
  await expect(page.locator('.fd-hero-brand')).toHaveCount(0)
  await expect(page.locator('.fd-landing-section')).toHaveCount(4)
  await expect(page.locator('.fd-landing-section h2')).toHaveText([
    'Write docs. Ship. Repeat.',
    'Batteries included.',
    'Start writing.',
  ])
  await expect(
    page.getByText('Built on Foldkit. Powered by Effect.'),
  ).toHaveCount(0)
  await expect(page.getByText('Built for humans. Readable by AI.')).toHaveCount(
    0,
  )
  await expect(page.getByText('Everything is connected.')).toHaveCount(0)

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect(header).toBeVisible()

  const footer = page.locator('.fd-home-footer')
  await expect(footer.locator('.fd-site-footer-left p')).toHaveCount(1)
  await expect(footer).toContainText(
    'Built by Aniket. The source code is available on GitHub.',
  )
  await expect(footer.getByRole('link', { name: 'Aniket' })).toHaveAttribute(
    'href',
    'https://aniketpawar.com',
  )
  await expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/tarkaworks/foldocs',
  )
  await expect(footer).toContainText('© 2026 Tarkaworks')
  await expect(
    footer.getByRole('link', { name: 'Tarkaworks on X' }),
  ).toHaveAttribute('href', 'https://x.com/tarkaworks')
  expect(errors).toEqual([])
})

test('open fonts are bundled and applied consistently', async ({ page }) => {
  const errors = expectNoRuntimeErrors(page)
  await page.goto('/en/docs/markdown/code-blocks')

  const typography = await page.evaluate(async () => {
    await document.fonts.ready
    const code = document.querySelector<HTMLElement>('.fd-code-block pre')
    if (code === null) throw new Error('Code block was not rendered.')

    return {
      body: getComputedStyle(document.body).fontFamily,
      code: getComputedStyle(code).fontFamily,
      interLoaded: document.fonts.check('16px "Inter Variable"'),
      jetBrainsMonoLoaded: document.fonts.check(
        '14px "JetBrains Mono Variable"',
      ),
    }
  })

  expect(typography.body).toContain('Inter Variable')
  expect(typography.code).toContain('JetBrains Mono Variable')
  expect(typography.interLoaded).toBe(true)
  expect(typography.jetBrainsMonoLoaded).toBe(true)
  expect(errors).toEqual([])
})

test('package install blocks convert commands and remember the selected manager', async ({
  page,
}) => {
  const errors = expectNoRuntimeErrors(page)
  await page.goto('/en/docs/markdown/code-blocks')

  const install = page.locator('[data-component="PackageInstall"]')
  await expect(install).toHaveCount(1)
  await expect(install).toHaveAttribute('data-package-manager', 'npm')
  await expect(install.getByRole('tabpanel')).toContainText(
    'npm install foldocs foldkit effect',
  )

  await install.getByRole('tab', { name: 'bun', exact: true }).click()
  await expect(install).toHaveAttribute('data-package-manager', 'bun')
  await expect(
    install.getByRole('tab', { name: 'bun', exact: true }),
  ).toHaveAttribute('aria-selected', 'true')
  await expect(install.getByRole('tabpanel')).toContainText(
    'bun add foldocs foldkit effect',
  )

  await page.goto('/en/docs/ui/components/code-blocks')
  const nextInstall = page.locator('[data-component="PackageInstall"]')
  await expect(nextInstall).toHaveAttribute('data-package-manager', 'bun')
  await expect(nextInstall.getByRole('tabpanel')).toContainText(
    'bun add foldocs foldkit effect',
  )

  await page.reload()
  await expect(nextInstall).toHaveAttribute('data-package-manager', 'bun')
  expect(errors).toEqual([])
})

test('advanced authoring and static publishing features work together', async ({
  page,
  request,
}) => {
  const errors = expectNoRuntimeErrors(page)

  const rss = await request.get('/rss.xml')
  expect(rss.ok()).toBe(true)
  expect(rss.headers()['content-type']).toMatch(/xml/)
  expect(await rss.text()).toContain('<rss version="2.0">')

  const socialImage = await request.get('/og/en/markdown/mermaid.png')
  expect(socialImage.ok()).toBe(true)
  expect(socialImage.headers()['content-type']).toContain('image/png')

  await page.goto('/en/docs/markdown/math')
  await expect(page.locator('.fd-math-display .katex')).toBeVisible()

  await page.goto('/en/docs/markdown/mermaid')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Mermaid' }),
  ).toBeVisible()
  await expect(page.locator('.fd-mermaid')).toHaveAttribute(
    'data-rendered',
    'true',
  )
  await expect(page.locator('.fd-mermaid svg')).toBeVisible()

  await page.goto('/en/docs/markdown/advanced')
  await expect(page.locator('.fd-type-table')).toContainText(
    'Displayed page title',
  )
  await expect(page.locator('.fd-last-updated')).toBeVisible()

  await page.locator('.fd-image-zoom-trigger').click()
  await expect(
    page.getByRole('dialog', { name: 'Image preview' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Image preview' })).toHaveCount(
    0,
  )

  await page.locator('#fd-search-trigger').click()
  const search = page.getByRole('dialog', { name: 'Search documentation' })
  await expect(
    search.getByRole('group', { name: 'Filter by topic' }),
  ).toBeVisible()
  await search.getByRole('button', { name: 'Markdown', exact: true }).click()
  await search.getByRole('combobox').fill('advanced')
  await expect(search.getByRole('option').first()).toBeVisible()

  for (const [url, title] of [
    ['/en/docs/guides/export-pdf', 'Export PDF'],
    ['/en/docs/guides/rss', 'RSS feed'],
    ['/en/docs/integrations/feedback', 'Feedback'],
    ['/en/docs/integrations/social-images', 'Social images'],
    ['/en/docs/integrations/openapi/operation-pages', 'Operation pages'],
    ['/en/docs/integrations/asyncapi/schema-inputs', 'Schema inputs'],
  ] as const) {
    await page.goto(url)
    await expect(
      page.getByRole('heading', { level: 1, name: title }),
    ).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('Core exposes its headless component, MDX, utility, and source references', async ({
  page,
}) => {
  const errors = expectNoRuntimeErrors(page)

  await page.goto('/en/docs/core/components/breadcrumbs')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Breadcrumbs' }),
  ).toBeVisible()
  await expect(page.locator('.fd-page-context')).toHaveText(
    'Headless components',
  )
  await expect(page.locator('.fd-sidebar-section-label')).toHaveText([
    'Guide',
    'API References',
    'Sources',
  ])
  await expect(
    page.getByRole('link', { name: 'Table of contents', exact: true }),
  ).toBeVisible()

  await page.goto('/en/docs/core/mdx/package-install')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Package install' }),
  ).toBeVisible()
  await expect(page.locator('.fd-page-context')).toHaveText('MDX pipeline')

  await page.goto('/en/docs/core/content-sources/custom-adapters')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Custom adapters' }),
  ).toBeVisible()
  await expect(page.locator('.fd-page-context')).toHaveText('Sources')
  expect(errors).toEqual([])
})

test('MDX documents its content pipeline, integrations, and automatic features', async ({
  page,
}) => {
  const errors = expectNoRuntimeErrors(page)

  await page.goto('/en/docs/mdx/accessing-content')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Accessing content' }),
  ).toBeVisible()
  await expect(page.locator('.fd-sidebar-section-label')).toHaveText([
    'Guide',
    'Integrations',
    'Configuration',
    'Features',
    'Authoring',
    'Reference',
  ])

  for (const [url, title] of [
    ['/en/docs/mdx/vite', 'Vite'],
    ['/en/docs/mdx/runtime-compilation', 'Standalone compilation'],
    ['/en/docs/mdx/content-sources', 'Content sources'],
    ['/en/docs/mdx/configuration', 'Configuration'],
    ['/en/docs/mdx/reuse-content', 'Reuse content'],
    ['/en/docs/mdx/lazy-loading', 'Lazy loading'],
    ['/en/docs/mdx/type-safety', 'Type safety'],
    ['/en/docs/mdx/monorepos', 'Monorepos'],
  ] as const) {
    await page.goto(url)
    await expect(
      page.getByRole('heading', { level: 1, name: title }),
    ).toBeVisible()
    await expect(page.locator('.fd-toc-shell a').first()).toBeVisible()
  }

  expect(errors).toEqual([])
})

test('search traps focus, resolves local results, and restores its trigger', async ({
  page,
}) => {
  const errors = expectNoRuntimeErrors(page)
  await page.goto('/en/docs')
  await waitForRuntime(page)
  const trigger = page.locator('#fd-search-trigger')
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Search documentation' })
  const panel = dialog.locator('.fd-search-dialog')
  const input = dialog.getByRole('combobox')
  await expect(dialog).toBeVisible()
  await expect(input).toBeFocused()
  await expect(input).toHaveCSS('outline-style', 'none')
  await expect(panel).toHaveCSS('border-radius', '12px')
  expect((await panel.boundingBox())?.width ?? Infinity).toBeLessThanOrEqual(
    576,
  )

  await page.keyboard.press('Shift+Tab')
  await expect(dialog.locator('.fd-search-filter').last()).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(input).toBeFocused()

  const themeBeforeTyping = await page
    .locator('html')
    .evaluate(element => element.classList.contains('dark'))
  await input.press('d')
  expect(
    await page
      .locator('html')
      .evaluate(element => element.classList.contains('dark')),
  ).toBe(themeBeforeTyping)

  await input.fill('portable content')
  await expect(dialog.getByRole('option').first()).toBeVisible()
  await expect(dialog.locator('.fd-search-result mark').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(input).toHaveValue('')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  expect(errors).toEqual([])
})

test('Foldkit theme colors and dropdown chevrons stay synchronized', async ({
  page,
}) => {
  const errors = expectNoRuntimeErrors(page)
  await page.addInitScript(() => {
    localStorage.setItem('foldocs-theme', 'dark')
    const rootClasses: Array<string> = []
    Object.defineProperty(window, '__foldocsThemeRootClasses', {
      value: rootClasses,
      configurable: true,
    })
    const rememberRoot = (node: Node): void => {
      if (!(node instanceof Element)) return
      if (node.matches('.fd-root')) rootClasses.push(node.className)
      for (const root of node.querySelectorAll('.fd-root'))
        rootClasses.push(root.className)
    }
    new MutationObserver(records => {
      for (const record of records)
        for (const node of record.addedNodes) rememberRoot(node)
    }).observe(document, { childList: true, subtree: true })
  })
  await page.goto('/en/docs')

  const root = page.locator('.fd-root')
  await expect(root).not.toHaveAttribute('id', 'root')
  const search = page.locator('#fd-search-trigger')
  const light = page.getByRole('button', { name: 'Light' })
  const dark = page.getByRole('button', { name: 'Dark' })

  const controlHeights = await Promise.all(
    [
      search,
      page.locator('.fd-header .fd-language-trigger'),
      page.locator('.fd-header .fd-theme-selector'),
      page.locator('.fd-header .fd-social-link[aria-label="GitHub"]'),
      page.locator('.fd-header .fd-social-link[aria-label="npm"]'),
    ].map(async control => (await control.boundingBox())?.height),
  )
  expect(controlHeights).toEqual([36, 36, 36, 24, 32])
  const githubLink = page.locator(
    '.fd-header .fd-social-link[aria-label="GitHub"]',
  )
  await expect(githubLink).toHaveAttribute(
    'href',
    'https://github.com/tarkaworks/foldocs',
  )
  const npmLink = page.locator('.fd-header .fd-social-link[aria-label="npm"]')
  await expect(githubLink).not.toHaveClass(/fd-control/u)
  await expect(npmLink).not.toHaveClass(/fd-control/u)
  await expect(
    githubLink.locator('path[d^="M12 .297c-6.63 0-12 5.373-12 12"]'),
  ).toBeVisible()
  await expect(
    npmLink.locator('path[d^="M240 250h100v-50h100V0H240v250"]'),
  ).toBeVisible()

  await expect(page.locator('html')).toHaveClass(/dark/u)
  await expect(root).toHaveCSS('background-color', 'rgb(30, 28, 33)')
  await expect(root).not.toHaveClass(/(?:^|\s)(?:light|dark)(?:\s|$)/u)
  const initialRootClasses = await page.evaluate(
    () =>
      (
        window as Window & {
          __foldocsThemeRootClasses: ReadonlyArray<string>
        }
      ).__foldocsThemeRootClasses,
  )
  expect(initialRootClasses.length).toBeGreaterThan(0)
  expect(
    initialRootClasses.every(
      className => !/(?:^|\s)(?:light|dark)(?:\s|$)/u.test(className),
    ),
  ).toBe(true)

  await expect(page.locator('.fd-toc-shell')).toBeVisible()
  await expect(page.locator('.fd-mobile-toc-shell')).toBeHidden()

  await light.click()
  await expect(root).toHaveCSS('background-color', 'rgb(248, 247, 251)')
  await expect(light).toHaveCSS('color', 'rgb(30, 28, 33)')

  await dark.click()
  await expect(page.locator('html')).toHaveClass(/dark/u)
  await expect(root).toHaveCSS('background-color', 'rgb(30, 28, 33)')
  await expect(dark).toHaveCSS('color', 'rgb(255, 255, 255)')
  await githubLink.hover()
  await expect(githubLink).toHaveCSS('color', 'rgb(255, 255, 255)')
  expect(
    await search.evaluate(element => getComputedStyle(element).backgroundColor),
  ).not.toBe('color(srgb 1 1 1 / 0.5)')

  await page.keyboard.press('d')
  await expect(page.locator('html')).not.toHaveClass(/dark/u)
  await page.keyboard.press('d')
  await expect(page.locator('html')).toHaveClass(/dark/u)

  const languageSelector = page.locator('.fd-header .fd-language-selector')
  const languageTrigger = languageSelector.locator('.fd-language-trigger')
  const languageChevron = languageSelector.locator('.fd-language-chevron')
  await expect(languageChevron).toHaveClass(/fd-icon/u)
  const languageChevronBox = await languageChevron.boundingBox()
  expect(languageChevronBox).not.toBeNull()
  expect(languageChevronBox?.width).toBe(languageChevronBox?.height)
  expect(languageChevronBox?.width ?? 0).toBeGreaterThan(10)
  expect(languageChevronBox?.width ?? 0).toBeLessThan(12)
  await languageTrigger.click()
  await expect(languageTrigger).toHaveAttribute('aria-expanded', 'true')
  await expect(languageSelector).toHaveAttribute('data-open', '')
  await expect(page.getByRole('menu')).toBeFocused()
  const portalFont = await page
    .getByRole('menu')
    .evaluate(element => getComputedStyle(element).fontFamily)
  const documentFont = await page
    .locator('body')
    .evaluate(element => getComputedStyle(element).fontFamily)
  expect(portalFont).toBe(documentFont)
  expect(portalFont).toContain('Inter Variable')
  await expect(languageChevron).toHaveCSS(
    'transform',
    'matrix(-1, 0, 0, -1, 0, 0)',
  )

  await page.mouse.click(20, 200)
  await expect(languageTrigger).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(languageTrigger).toBeFocused()

  await languageTrigger.click()
  await expect(page.getByRole('menu')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(languageTrigger).toHaveAttribute('aria-expanded', 'false')
  await expect(languageTrigger).toBeFocused()
  expect(errors).toEqual([])
})

test('sections, folders, page actions, and pager work together', async ({
  page,
}) => {
  const errors = expectNoRuntimeErrors(page)
  await page.goto('/en/docs')

  await expect(page.locator('.fd-sidebar-section-label')).toHaveText([
    'Introduction',
    'Writing',
    'Configuration',
    'Integrations',
  ])
  await expect(page.locator('.fd-sidebar-section-label').first()).not.toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  )
  const sectionSpacing = await page.locator('.fd-sidebar').evaluate(sidebar => {
    const labels = sidebar.querySelectorAll<HTMLElement>(
      '.fd-sidebar-section-label',
    )
    const introduction = labels[0]
    const writing = labels[1]
    const quickStart = sidebar.querySelector<HTMLElement>(
      '.fd-sidebar-link-root[href="/en/docs"]',
    )
    const lastIntroductionItem = writing?.parentElement?.previousElementSibling
    if (
      introduction === undefined ||
      writing === undefined ||
      quickStart === null ||
      !(lastIntroductionItem instanceof HTMLElement)
    )
      throw new Error('Could not resolve sidebar section spacing anchors.')
    const introductionBox = introduction.getBoundingClientRect()
    const quickStartBox = quickStart.getBoundingClientRect()
    const lastIntroductionBox = lastIntroductionItem.getBoundingClientRect()
    const writingBox = writing.getBoundingClientRect()
    return {
      first: quickStartBox.y - introductionBox.y - introductionBox.height,
      last: writingBox.y - lastIntroductionBox.y - lastIntroductionBox.height,
    }
  })
  expect(sectionSpacing).toEqual({ first: 8, last: 8 })
  for (const href of [
    '/en/docs',
    '/en/docs/what-is-foldocs',
    '/en/docs/comparisons',
    '/en/docs/manual-installation',
    '/en/docs/guides',
  ]) {
    await expect(
      page.locator(`.fd-sidebar a[href="${href}"] .fd-navigation-icon`),
    ).toBeVisible()
  }
  for (const href of [
    '/en/docs/page-conventions',
    '/en/docs/markdown',
    '/en/docs/navigation',
    '/en/docs/versioning',
    '/en/docs/deploying',
    '/en/docs/internationalization',
    '/en/docs/search',
    '/en/docs/integrations',
  ]) {
    await expect(
      page.locator(`.fd-sidebar a[href="${href}"] .fd-navigation-icon`),
    ).toHaveCount(0)
  }
  await expect(page.locator('.fd-page-context')).toHaveCount(0)
  const navbarSearch = page.locator('#fd-search-trigger')
  const documentationSelector = page.getByRole('button', {
    name: 'Select documentation',
  })
  await expect(documentationSelector).toContainText('Framework')
  await expect(documentationSelector).not.toContainText(
    'Build production documentation with Foldkit',
  )
  await navbarSearch.hover()
  await page.waitForTimeout(200)
  const controlHoverBorder = await navbarSearch.evaluate(
    element => getComputedStyle(element).borderColor,
  )
  await documentationSelector.hover()
  await page.waitForTimeout(200)
  await expect(documentationSelector).toHaveCSS(
    'border-color',
    controlHoverBorder,
  )
  await documentationSelector.click()
  const documentationMenu = page.locator('.fd-layout-tabs-menu')
  await expect(documentationMenu).toBeVisible()
  await expect(documentationMenu).toBeFocused()
  await expect(documentationMenu).toHaveCSS('box-shadow', 'none')
  for (const packageName of [
    'Framework',
    'Foldocs UI',
    'Foldocs Core',
    'Foldocs MDX',
    'Foldocs CLI',
    'TypeScript API',
  ]) {
    await expect(
      documentationMenu.getByRole('menuitem', {
        name: new RegExp(`^${packageName}`, 'u'),
      }),
    ).toBeVisible()
  }
  await expect(documentationMenu.getByRole('menuitem')).toHaveCount(6)
  await expect(
    documentationMenu.getByRole('menuitem', { name: /^Framework/u }),
  ).toContainText('Production docs for Foldkit')
  await expect(
    documentationMenu.locator(
      '.fd-layout-tab-active .fd-icon path[d="M20 6 9 17l-5-5"]',
    ),
  ).toBeVisible()
  expect(
    await documentationMenu.evaluate(
      element => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
  expect(
    await documentationMenu
      .getByRole('menuitem')
      .evaluateAll(items =>
        items.every(
          item =>
            item.scrollWidth <= item.clientWidth &&
            getComputedStyle(item).textAlign === 'left',
        ),
      ),
  ).toBe(true)
  expect(
    await documentationMenu.evaluate(
      element => getComputedStyle(element).fontFamily,
    ),
  ).toBe(
    await page
      .locator('body')
      .evaluate(element => getComputedStyle(element).fontFamily),
  )
  await page.mouse.click(600, 240)
  await expect(documentationMenu).toHaveCount(0)
  await expect(documentationSelector).toBeFocused()

  const sidebar = page.locator('.fd-sidebar')
  const sidebarNavigation = sidebar.locator(':scope > nav')
  const selectorY = (await documentationSelector.boundingBox())?.y
  await expect(sidebar).toHaveCSS('overflow-y', 'hidden')
  await expect(sidebarNavigation).toHaveCSS('overflow-y', 'auto')
  await sidebarNavigation.evaluate(element => {
    element.scrollTop = element.scrollHeight
  })
  await expect
    .poll(() => sidebarNavigation.evaluate(element => element.scrollTop))
    .toBeGreaterThan(0)
  expect((await documentationSelector.boundingBox())?.y).toBe(selectorY)
  await sidebarNavigation.evaluate(element => {
    element.scrollTop = 0
  })

  const folderIndex = page.getByRole('link', {
    name: 'Manual installation',
    exact: true,
  })
  const folderRow = folderIndex
  const folderContainer = page.locator(
    '.fd-sidebar-folder:has(.fd-sidebar-folder-index[href="/en/docs/manual-installation"])',
  )
  const folder = folderIndex
  await expect(folderIndex).toHaveAttribute(
    'href',
    '/en/docs/manual-installation',
  )
  await expect(folder.locator('.fd-sidebar-chevron')).toHaveClass(/fd-icon/u)
  await expect(folder).toBeEnabled()
  await expect(folder).toHaveAttribute('aria-expanded', 'false')
  await expect(folderIndex.locator('.fd-navigation-icon')).toBeVisible()
  const folderPadding = await folderRow.evaluate(
    element => getComputedStyle(element).paddingLeft,
  )
  const singleItem = page.locator('.fd-sidebar-link-root[href="/en/docs"]')
  const singleItemPadding = await singleItem.evaluate(
    element => getComputedStyle(element).paddingLeft,
  )
  expect(folderPadding).toBe(singleItemPadding)
  expect((await folderRow.boundingBox())?.x).toBe(
    (await singleItem.boundingBox())?.x,
  )
  expect((await folderRow.boundingBox())?.width).toBe(
    (await singleItem.boundingBox())?.width,
  )
  const comparisons = page.locator(
    '.fd-sidebar-link-root[href="/en/docs/comparisons"]',
  )
  const comparisonsBox = await comparisons.boundingBox()
  const folderRowBox = await folderRow.boundingBox()
  expect((folderRowBox?.y ?? 0) - (comparisonsBox?.y ?? 0)).toBe(
    (comparisonsBox?.height ?? 0) + 2,
  )
  await folderRow.hover()
  await expect(folderRow).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await folder.locator('.fd-sidebar-item-label').click()
  await expect(page).toHaveURL(/\/en\/docs\/manual-installation$/u)
  await expect(page.locator('.fd-page-context')).toHaveCount(0)
  await expect(folder).toHaveAttribute('aria-expanded', 'true')
  const folderPanelId = await folder.getAttribute('aria-controls')
  expect(folderPanelId).not.toBeNull()
  const folderPanel = page.locator(`#${folderPanelId ?? 'missing-panel'}`)
  expect(
    await folderPanel.evaluate(
      element => getComputedStyle(element, '::before').width,
    ),
  ).toBe('1px')
  expect(
    await folderPanel.evaluate(
      element => getComputedStyle(element, '::before').zIndex,
    ),
  ).toBe('2')
  await folder.locator('.fd-sidebar-item-label').click()
  await expect(folder).toHaveAttribute('aria-expanded', 'false')
  await folder.locator('.fd-navigation-icon').click()
  await expect(folder).toHaveAttribute('aria-expanded', 'true')

  const pnpmPage = page.locator(
    '.fd-sidebar > nav a[href="/en/docs/manual-installation/pnpm"]',
  )
  const tocWidth = (await page.locator('.fd-toc-shell').boundingBox())?.width
  expect(tocWidth).toBe(268)
  await expect(pnpmPage).toBeVisible()
  expect((await pnpmPage.boundingBox())?.x).toBe(
    (await singleItem.boundingBox())?.x,
  )
  expect((await pnpmPage.boundingBox())?.width).toBe(
    (await singleItem.boundingBox())?.width,
  )
  await pnpmPage.click()
  await expect(page).toHaveURL(/\/en\/docs\/manual-installation\/pnpm$/u)
  await expect(pnpmPage).toHaveClass(/fd-sidebar-link-active/u)
  await expect(pnpmPage).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.fd-page-context')).toHaveText(
    'Manual installation',
  )
  const primaryValue = await page
    .locator('html')
    .evaluate(element =>
      getComputedStyle(element).getPropertyValue('--fd-primary').trim(),
    )
  const primaryColor = await page.evaluate(value => {
    const probe = document.createElement('span')
    probe.style.color = value
    document.body.append(probe)
    const normalized = getComputedStyle(probe).color
    probe.remove()
    return normalized
  }, primaryValue)
  const activePageColor = await pnpmPage.evaluate(
    element => getComputedStyle(element).color,
  )
  expect(activePageColor).toBe(primaryColor)
  expect(
    await pnpmPage.evaluate(
      element => getComputedStyle(element, '::before').backgroundColor,
    ),
  ).toBe(primaryColor)
  expect(
    await pnpmPage.evaluate(
      element => getComputedStyle(element, '::before').width,
    ),
  ).toBe('1px')
  expect(
    await pnpmPage.evaluate(
      element => getComputedStyle(element, '::before').zIndex,
    ),
  ).toBe('3')
  const npmPage = page.locator(
    '.fd-sidebar > nav a[href="/en/docs/manual-installation/npm"]',
  )
  await npmPage.hover()
  await expect(npmPage).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  expect(
    await folderPanel.evaluate(
      element => getComputedStyle(element, '::before').zIndex,
    ),
  ).toBe('2')
  await pnpmPage.hover()
  await expect(pnpmPage).toHaveCSS('color', primaryColor)
  await expect(page.locator('.fd-page-context')).toHaveCSS(
    'color',
    primaryColor,
  )
  await expect(folderContainer).not.toHaveClass(/fd-sidebar-folder-active/u)
  await expect(folderRow).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  expect((await page.locator('.fd-toc-shell').boundingBox())?.width).toBe(
    tocWidth,
  )
  await expect(folder).toBeEnabled()
  await expect(folder).toHaveAttribute('aria-expanded', 'true')
  const folderPanelClip = folderPanel.locator('..')
  const folderPanelMotion = folderPanelClip.locator('..')
  await folder.locator('.fd-sidebar-item-label').click()
  await expect(folder).toHaveAttribute('aria-expanded', 'false')
  await expect(folderPanelClip).toHaveAttribute('aria-hidden', 'true')
  await expect
    .poll(async () => (await folderPanelMotion.boundingBox())?.height ?? 0)
    .toBe(0)
  await folder.locator('.fd-sidebar-chevron').click()
  await expect(folder).toHaveAttribute('aria-expanded', 'true')
  await expect(folderPanelClip).not.toHaveAttribute('aria-hidden', 'true')
  await expect(pnpmPage).toBeVisible()

  const open = page.getByRole('button', { name: 'Open page options' })
  const copyMarkdown = page.locator('.fd-page-actions > button')
  for (const action of [copyMarkdown, open]) {
    await expect(action).toHaveClass(/fd-control-outline/u)
    expect((await action.boundingBox())?.height).toBe(32)
    expect(
      await action.evaluate(element => {
        const style = getComputedStyle(element)
        return [style.borderRadius, style.borderColor, style.backgroundColor]
      }),
    ).toEqual(
      await navbarSearch.evaluate(element => {
        const style = getComputedStyle(element)
        return [style.borderRadius, style.borderColor, style.backgroundColor]
      }),
    )
  }
  await open.click()
  const menu = page.locator('.fd-page-open-menu')
  await expect(menu).toBeVisible()
  await expect(menu).toBeFocused()
  await expect(menu).toHaveCSS('box-shadow', 'none')
  await expect(menu).toHaveCSS('outline-style', 'none')
  await expect(menu.locator('.fd-page-open-separator')).toHaveCount(0)
  expect(
    await menu.evaluate(element => getComputedStyle(element).fontFamily),
  ).toBe(
    await page
      .locator('body')
      .evaluate(element => getComputedStyle(element).fontFamily),
  )
  for (const externalIcon of await menu
    .locator('.fd-page-open-external')
    .all()) {
    const box = await externalIcon.boundingBox()
    expect(box).not.toBeNull()
    expect(box?.width).toBe(box?.height)
    expect(box?.width).toBe(14)
  }
  for (const providerIcon of await menu
    .locator('.fd-page-open-provider')
    .all()) {
    const box = await providerIcon.boundingBox()
    expect(box).not.toBeNull()
    expect(box?.width).toBe(16)
    expect(box?.height).toBe(16)
  }
  await expect(menu.getByRole('menuitem')).toHaveCount(6)
  for (const label of [
    'Open in GitHub',
    'View as Markdown',
    'Open in Scira AI',
    'Open in ChatGPT',
    'Open in Claude',
    'Open in Cursor',
  ]) {
    await expect(menu.getByRole('menuitem', { name: label })).toBeVisible()
  }
  await expect(
    menu.getByRole('menuitem', { name: 'Open in Grok' }),
  ).toHaveCount(0)
  await page.mouse.click(700, 240)
  await expect(menu).toHaveCount(0)
  await expect(open).toBeFocused()

  await expect(copyMarkdown).toHaveAccessibleName('Copy page as Markdown')
  expect((await copyMarkdown.locator('.fd-icon').boundingBox())?.width).toBe(
    (await navbarSearch.locator('.fd-icon').boundingBox())?.width,
  )
  const copyWidthBefore = (await copyMarkdown.boundingBox())?.width
  const copyIconBefore = await copyMarkdown.locator('.fd-icon').innerHTML()
  await copyMarkdown.click()
  await expect(copyMarkdown).toHaveText('Copy Markdown')
  await expect(copyMarkdown).toHaveAttribute('aria-label', 'Copied Markdown')
  expect(await copyMarkdown.locator('.fd-icon').innerHTML()).not.toBe(
    copyIconBefore,
  )
  expect((await copyMarkdown.boundingBox())?.width).toBe(copyWidthBefore)

  await expect(page.locator('.fd-pager-direction')).toHaveText([
    'Previous',
    'Next',
  ])
  await expect(page.locator('.fd-article .fd-doc-footer')).toHaveCount(0)
  await expect(page.locator('.fd-content-column .fd-doc-footer')).toHaveCount(0)
  const docsFooter = page.locator('.fd-root > .fd-doc-footer')
  await expect(docsFooter).toBeVisible()
  const footerBox = await docsFooter.boundingBox()
  const viewport = page.viewportSize()
  expect(footerBox?.x).toBe(0)
  expect(footerBox?.width).toBe(viewport?.width)
  expect(footerBox?.y ?? 0).toBeGreaterThanOrEqual(viewport?.height ?? 0)
  await docsFooter.scrollIntoViewIfNeeded()
  const visibleFooterBox = await docsFooter.boundingBox()
  const sidebarBoxAtFooter = await page.locator('.fd-sidebar').boundingBox()
  const tocBoxAtFooter = await page.locator('.fd-toc-shell').boundingBox()
  const footerTop = visibleFooterBox?.y ?? 0
  expect(
    (sidebarBoxAtFooter?.y ?? 0) + (sidebarBoxAtFooter?.height ?? 0),
  ).toBeLessThanOrEqual(footerTop + 1)
  expect(
    (tocBoxAtFooter?.y ?? 0) + (tocBoxAtFooter?.height ?? 0),
  ).toBeLessThanOrEqual(footerTop + 1)
  await expect(docsFooter).toContainText(
    'Built by Aniket. The source code is available on GitHub.',
  )
  await expect(
    docsFooter.getByRole('link', { name: 'Aniket' }),
  ).toHaveAttribute('href', 'https://aniketpawar.com')
  await expect(
    docsFooter.getByRole('link', { name: 'GitHub' }),
  ).toHaveAttribute('href', 'https://github.com/tarkaworks/foldocs')
  await expect(docsFooter).toContainText('© 2026 Tarkaworks')
  await expect(
    docsFooter.getByRole('link', { name: 'Tarkaworks on X' }),
  ).toHaveAttribute('href', 'https://x.com/tarkaworks')
  expect(errors).toEqual([])
})

test('default documentation components render with Foldkit-native behavior', async ({
  page,
}) => {
  const errors = expectNoRuntimeErrors(page)
  await page.addInitScript(() => localStorage.setItem('foldocs-theme', 'dark'))
  await page.goto('/en/docs/ui/components')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Components')
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(7)
  await expect(page.locator('.fd-callout')).toHaveCount(2)
  await expect(page.locator('.fd-callout-strand')).toHaveCount(2)
  await expect(page.locator('.fd-card-icon')).toHaveCount(2)
  await expect(page.locator('.fd-callout').first()).toHaveCSS(
    'box-shadow',
    'none',
  )
  await expect(page.locator('.fd-card-icon').first()).toHaveCSS(
    'box-shadow',
    'none',
  )
  await expect(page.locator('.fd-step')).toHaveCount(3)
  await expect(page.locator('.fd-accordion')).toHaveCount(2)
  await expect(page.locator('.fd-file-folder')).toHaveCount(3)

  const activePage = page.locator(
    '.fd-sidebar-folder-active .fd-sidebar-folder-index[href="/en/docs/ui/components"]',
  )
  const primaryValue = await page
    .locator('html')
    .evaluate(element =>
      getComputedStyle(element).getPropertyValue('--fd-primary').trim(),
    )
  const primaryColor = await page.evaluate(value => {
    const probe = document.createElement('span')
    probe.style.color = value
    document.body.append(probe)
    const normalized = getComputedStyle(probe).color
    probe.remove()
    return normalized
  }, primaryValue)
  await expect(activePage.locator('.fd-navigation-icon')).toHaveCount(0)

  const tabsLink = page.locator('.fd-toc').getByRole('link', { name: 'Tabs' })
  const tabsHeading = page.getByRole('heading', {
    level: 2,
    name: 'Tabs',
  })
  await tabsLink.click()
  await expect(page).toHaveURL(/#tabs$/u)
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0)
  const headerHeight =
    (await page.locator('.fd-header').boundingBox())?.height ?? 0
  await expect
    .poll(async () => (await tabsHeading.boundingBox())?.y ?? Infinity)
    .toBeLessThanOrEqual(headerHeight + 32)
  const headingTop = (await tabsHeading.boundingBox())?.y ?? 0
  expect(headingTop).toBeGreaterThanOrEqual(headerHeight)
  expect(headingTop).toBeLessThanOrEqual(headerHeight + 32)
  await activePage.hover()
  await expect(activePage).toHaveCSS('color', primaryColor)

  const tabs = page.locator('.fd-tabs[data-group-id]')
  await expect(tabs).toHaveCount(1)
  const npmTab = tabs.getByRole('tab', { name: 'npm', exact: true })
  await expect(npmTab).toHaveCount(1)
  await npmTab.click()
  await expect(npmTab).toHaveAttribute('aria-selected', 'true')
  await expect(
    tabs.getByRole('tabpanel', { name: 'npm', exact: true }),
  ).toBeVisible()
  await expect(tabs.locator('.fd-tab-panel').first()).toBeHidden()

  const closedAccordion = page
    .locator('.fd-accordion')
    .filter({ hasText: 'Does this require React?' })
  await expect(closedAccordion).toHaveCount(1)
  await expect(closedAccordion).not.toHaveAttribute('open', '')
  await closedAccordion.locator('summary').click()
  await expect(closedAccordion).toHaveAttribute('open', '')
  expect(errors).toEqual([])
})

test('mobile navigation traps focus and restores the menu button', async ({
  page,
}) => {
  const errors = expectNoRuntimeErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/en/docs/guides/remote-content')
  await expect(page.locator('.fd-docs-header .fd-theme-selector')).toBeVisible()
  const brandBox = await page.locator('.fd-docs-header .fd-brand').boundingBox()
  expect(brandBox).not.toBeNull()
  expect(brandBox?.width ?? 0).toBeGreaterThan(90)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth === window.innerWidth,
    ),
  ).toBe(true)
  const trigger = page.locator('#fd-menu-trigger')
  await trigger.click()
  const dialog = page.getByRole('dialog', {
    name: 'Documentation navigation',
  })
  await expect(dialog).toBeVisible()
  await expect(page.locator('.fd-theme-selector')).toHaveCount(1)
  await expect(dialog.locator('.fd-theme-selector')).toHaveCount(0)
  const first = dialog.locator('a[href]').first()
  await expect(first).toBeFocused()

  await page.keyboard.press('Shift+Tab')
  const wrappedToLast = await dialog.evaluate(element => {
    const focusable = [
      ...element.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ].filter(
      candidate =>
        candidate.getAttribute('aria-hidden') !== 'true' &&
        candidate.getClientRects().length > 0,
    )
    return document.activeElement === focusable.at(-1)
  })
  expect(wrappedToLast).toBe(true)
  await page.keyboard.press('Tab')
  await expect(first).toBeFocused()

  const mobileLanguageTrigger = dialog.getByRole('button', {
    name: 'Select language',
  })
  await mobileLanguageTrigger.click()
  const mobileLanguageMenu = page.getByRole('menu')
  await expect(mobileLanguageMenu).toBeFocused()
  const [mobileLanguageTriggerBox, mobileLanguageMenuBox] = await Promise.all([
    mobileLanguageTrigger.boundingBox(),
    mobileLanguageMenu.boundingBox(),
  ])
  expect(mobileLanguageTriggerBox).not.toBeNull()
  expect(mobileLanguageMenuBox).not.toBeNull()
  expect(
    mobileLanguageMenuBox === null
      ? Infinity
      : mobileLanguageMenuBox.y + mobileLanguageMenuBox.height,
  ).toBeLessThanOrEqual((mobileLanguageTriggerBox?.y ?? 0) + 1)
  await page.mouse.click(20, 100)
  await expect(mobileLanguageMenu).toHaveCount(0)
  await expect(mobileLanguageTrigger).toBeFocused()

  await dialog.getByRole('button', { name: 'Close navigation' }).click()
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  expect(errors).toEqual([])
})

test('Twoslash compiler information is keyboard accessible', async ({
  page,
}) => {
  const errors = expectNoRuntimeErrors(page)
  await page.goto('/en/docs/markdown/twoslash')
  const hover = page.locator('.twoslash-hover').first()
  await expect(hover).toHaveAttribute('tabindex', '0')
  await hover.focus()
  await expect(page.locator('.twoslash-popup-container').first()).toBeVisible()
  expect(errors).toEqual([])
})
