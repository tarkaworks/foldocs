import { type Page, expect, test } from '@playwright/test'

const expectNoRuntimeErrors = (page: Page): Array<string> => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

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

test('landing navigation follows the hero and the footer keeps its attribution', async ({
  page,
}) => {
  const errors = expectNoRuntimeErrors(page)
  await page.goto('/en')

  const header = page.locator('.fd-landing-header')
  await expect(header).toHaveClass(/fd-landing-header-hidden/u)
  await expect(header).toHaveAttribute('aria-hidden', 'true')

  await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('.fd-hero')
    if (hero === null) throw new Error('Landing hero was not rendered.')
    window.scrollTo(0, hero.offsetTop + hero.offsetHeight + 1)
  })
  await expect(header).toHaveClass(/fd-landing-header-visible/u)
  await expect(header).toHaveAttribute('aria-hidden', 'false')

  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(header).toHaveClass(/fd-landing-header-hidden/u)

  const footer = page.locator('.fd-home-footer')
  await expect(footer.locator('.fd-site-footer-left p')).toHaveCount(1)
  await expect(footer).toContainText(
    'Built by Aniket. The source code is available on GitHub.',
  )
  await expect(footer).toContainText('© 2026 Tarkaworks')
  await expect(
    footer.getByRole('link', { name: 'Tarkaworks on X' }),
  ).toHaveAttribute('href', 'https://x.com/tarkaworks')
  expect(errors).toEqual([])
})

test('search traps focus, resolves local results, and restores its trigger', async ({
  page,
}) => {
  const errors = expectNoRuntimeErrors(page)
  await page.goto('/en/docs')
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
  const npmLink = page.locator('.fd-header .fd-social-link[aria-label="npm"]')
  await expect(githubLink).not.toHaveClass(/fd-control/u)
  await expect(npmLink).not.toHaveClass(/fd-control/u)
  await expect(
    githubLink.locator('path[d^="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53"]'),
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
  expect(portalFont).toContain('ABC Favorit')
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

test('Fumadocs-style sections, folders, page actions, and pager work together', async ({
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
  const introductionLabel = page.locator('.fd-sidebar-section-label').first()
  const quickStartItem = page.locator('.fd-sidebar-link-root[href="/en/docs"]')
  const writingLabel = page.locator('.fd-sidebar-section-label').nth(1)
  const lastIntroductionItem = writingLabel.locator(
    'xpath=../preceding-sibling::li[1]',
  )
  const introductionLabelBox = await introductionLabel.boundingBox()
  const quickStartItemBox = await quickStartItem.boundingBox()
  const lastIntroductionItemBox = await lastIntroductionItem.boundingBox()
  const writingLabelBox = await writingLabel.boundingBox()
  expect(
    (quickStartItemBox?.y ?? 0) -
      (introductionLabelBox?.y ?? 0) -
      (introductionLabelBox?.height ?? 0),
  ).toBe(8)
  expect(
    (writingLabelBox?.y ?? 0) -
      (lastIntroductionItemBox?.y ?? 0) -
      (lastIntroductionItemBox?.height ?? 0),
  ).toBe(8)
  for (const href of [
    '/en/docs',
    '/en/docs/what-is-foldocs',
    '/en/docs/comparisons',
    '/en/docs/manual-installation',
    '/en/docs/guides',
    '/en/docs/navigation',
    '/en/docs/versioning',
  ]) {
    await expect(
      page.locator(`.fd-sidebar a[href="${href}"] .fd-navigation-icon`),
    ).toBeVisible()
  }
  await expect(page.locator('.fd-page-context')).toHaveCount(0)
  const documentationSelector = page.getByRole('button', {
    name: 'Select documentation',
  })
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
  ]) {
    await expect(
      documentationMenu.getByRole('menuitem', {
        name: new RegExp(`^${packageName}`, 'u'),
      }),
    ).toBeVisible()
  }
  await expect(documentationMenu.getByRole('menuitem')).toHaveCount(5)
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
  await open.click()
  const menu = page.locator('.fd-page-open-menu')
  await expect(menu).toBeVisible()
  await expect(menu).toBeFocused()
  await expect(menu).toHaveCSS('box-shadow', 'none')
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
    expect(box?.width ?? 0).toBeLessThan(16)
  }
  await expect(
    menu.getByRole('menuitem', { name: 'View as Markdown' }),
  ).toBeVisible()
  await expect(
    menu.getByRole('menuitem', { name: 'Open in ChatGPT' }),
  ).toBeVisible()
  await expect(
    menu.getByRole('menuitem', { name: 'Open in Claude' }),
  ).toBeVisible()
  await expect(
    menu.getByRole('menuitem', { name: 'Open in Grok' }),
  ).toBeVisible()
  await page.mouse.click(700, 240)
  await expect(menu).toHaveCount(0)
  await expect(open).toBeFocused()

  const copyMarkdown = page.locator('.fd-page-actions > button')
  await expect(copyMarkdown).toHaveAccessibleName('Copy page as Markdown')
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
  await page.goto('/en/docs/ui/components')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Components')
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(7)
  await expect(page.locator('.fd-callout')).toHaveCount(2)
  await expect(page.locator('.fd-callout-strand')).toHaveCount(2)
  await expect(page.locator('.fd-card-icon')).toHaveCount(2)
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
  await expect(activePage.locator('.fd-navigation-icon')).toHaveCSS(
    'color',
    primaryColor,
  )
  await activePage.hover()
  await expect(activePage).toHaveCSS('color', primaryColor)
  await expect(activePage.locator('.fd-navigation-icon')).toHaveCSS(
    'color',
    primaryColor,
  )

  const tabInputs = page.locator('.fd-tab-input')
  await expect(tabInputs).toHaveCount(2)
  const npmTab = page.locator('.fd-tab-trigger[for$="-1"]')
  await expect(npmTab).toHaveCount(1)
  await npmTab.click()
  await expect(page.locator('.fd-tab-input:checked')).toHaveValue('1')
  await expect(page.locator('.fd-tab-panel:nth-child(2)')).toBeVisible()
  await expect(page.locator('.fd-tab-panel:nth-child(1)')).toBeHidden()

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
