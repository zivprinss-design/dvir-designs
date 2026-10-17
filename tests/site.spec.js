const { test, expect } = require('@playwright/test');

test('Desktop catalog and visible navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#pillows');
  await expect(page.locator('#products-grid .product-card').first()).toBeVisible();
  await expect(page.locator('#products-grid .product-card')).toHaveCount(12);
  await expect(page.locator('.instagram-nav-button')).toHaveAttribute('href', 'https://www.instagram.com/dvir_designs/');
  await expect(page.locator('#cart-trigger')).toBeVisible();
  await expect(page.locator('#theme-toggle')).toBeVisible();
  await expect(page.locator('.home-nav-button')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 1400));
  await expect.poll(async () => page.locator('.site-header').evaluate(el => Math.round(el.getBoundingClientRect().top))).toBeLessThan(30);
  await page.screenshot({ path: 'test-results/desktop-catalog.png', fullPage: true });
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('Phone layout, share review and customer name', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#pillows');
  await expect(page.locator('#products-grid .product-card').first()).toBeVisible();
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
  expect(overflows, 'The mobile layout should not scroll horizontally').toBe(false);
  await page.locator('#products-grid .product-add').first().click();
  await page.locator('#cart-trigger').click();
  await expect(page.locator('#cart-panel')).toHaveClass(/is-open/);
  await page.locator('#whatsapp-share').click();
  await expect(page.locator('#customer-name-error')).toBeVisible();
  await page.locator('#customer-name').fill('לקוחה לדוגמה');
  await page.locator('#whatsapp-share').click();
  await expect(page.locator('#share-preview-dialog')).toBeVisible();
  await expect(page.locator('#share-preview-send')).toBeVisible();
  await expect(page.locator('#share-preview-text')).toContainText('לקוחה לדוגמה');
  await page.locator('#share-preview-back').click();
  await page.screenshot({ path: 'test-results/mobile-cart.png', fullPage: false });
  page.on('dialog', dialog => dialog.accept());
  await page.locator('#share-cart').click();
  await expect(page.locator('#share-link-box')).toBeVisible();
  const link = await page.locator('#share-link-input').inputValue();
  expect(link).toContain('cart=');
  const receiver = await page.context().newPage();
  await receiver.goto(link);
  await expect(receiver.locator('#cart-panel')).toHaveClass(/is-open/);
  await expect(receiver.locator('#customer-name')).toHaveValue('לקוחה לדוגמה');
  await receiver.close();
  await page.keyboard.press('Escape');
  await expect(page.locator('#cart-panel')).not.toHaveClass(/is-open/);
  await expect(page.locator('#cart-trigger')).toBeFocused();
});

test('Tiny phones and admin access boundary', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await expect(page.locator('.site-header')).toBeVisible();
  await expect(page.locator('.home-nav-button')).toBeVisible();
  await expect(page.locator('.instagram-nav-button')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false);
  await page.goto('/admin.html');
  await expect(page.locator('#login-screen')).toBeVisible();
  await expect(page.locator('#dashboard')).toBeHidden();
});
