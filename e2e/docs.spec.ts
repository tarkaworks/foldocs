import { expect, test, type Page } from "@playwright/test";

const expectNoRuntimeErrors = (page: Page): Array<string> => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
};

test("prerendered homepage, localized docs, Markdown, and remote content agree", async ({
  page,
  request,
}) => {
  const errors = expectNoRuntimeErrors(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/u);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "documentation framework",
  );

  await page.goto("/en/docs/getting-started");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Getting started",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://foldocs.dev/en/docs/getting-started",
  );

  const markdown = await request.get("/en/docs/getting-started.md");
  expect(markdown.ok()).toBe(true);
  expect(markdown.headers()["content-type"]).toContain("text/markdown");
  expect(await markdown.text()).toContain("# Getting started");

  const localizedAsset = await request.get(
    "/es/docs/features/_assets/portable.svg",
  );
  expect(localizedAsset.ok()).toBe(true);
  expect(localizedAsset.headers()["content-type"]).toContain("image/svg+xml");

  await page.goto("/en/docs/features/remote-content");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Remote and CMS content",
  );
  expect(errors).toEqual([]);
});

test("search traps focus, resolves local results, and restores its trigger", async ({
  page,
}) => {
  const errors = expectNoRuntimeErrors(page);
  await page.goto("/en/docs/getting-started");
  const trigger = page.locator("#fd-search-trigger");
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Search documentation" });
  const input = dialog.getByRole("combobox");
  const close = dialog.getByRole("button", { name: "Close search" });
  await expect(dialog).toBeVisible();
  await expect(input).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(input).toBeFocused();

  await input.fill("portable content");
  await expect(dialog.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(input).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test("mobile navigation traps focus and restores the menu button", async ({
  page,
}) => {
  const errors = expectNoRuntimeErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/docs/features/portable-content");
  const trigger = page.locator("#fd-menu-trigger");
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Documentation navigation",
  });
  await expect(dialog).toBeVisible();
  const first = dialog.locator("a[href]").first();
  await expect(first).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  const wrappedToLast = await dialog.evaluate((element) => {
    const focusable = [
      ...element.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ].filter(
      (candidate) =>
        candidate.getAttribute("aria-hidden") !== "true" &&
        candidate.getClientRects().length > 0,
    );
    return document.activeElement === focusable.at(-1);
  });
  expect(wrappedToLast).toBe(true);
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();

  await dialog.getByRole("button", { name: "Close navigation" }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test("Twoslash compiler information is keyboard accessible", async ({
  page,
}) => {
  const errors = expectNoRuntimeErrors(page);
  await page.goto("/en/docs/features/language-reference");
  const hover = page.locator(".twoslash-hover").first();
  await expect(hover).toHaveAttribute("tabindex", "0");
  await hover.focus();
  await expect(page.locator(".twoslash-popup-container").first()).toBeVisible();
  expect(errors).toEqual([]);
});
