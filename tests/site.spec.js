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

test('Phone layout, private optional contact and short cart sharing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let savedRequest=null,creationCount=0;
  await page.context().route('**/rest/v1/rpc/dvir_create_short_cart',async route=>{
    savedRequest=route.request().postDataJSON();creationCount++;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify('AbCdEf1234')});
  });
  await page.context().route('**/rest/v1/rpc/dvir_open_short_cart',async route=>{
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({name:savedRequest?.p_customer_name,items:savedRequest?.p_items})});
  });
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
  await expect(page.locator('#customer-phone')).toBeVisible();
  await page.locator('#customer-phone').fill('invalid-phone');
  await page.locator('#whatsapp-share').click();
  await expect(page.locator('#customer-phone-error')).toBeVisible();
  await page.locator('#customer-phone').fill('050-1234567');
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
  expect(link).toMatch(/\\?s=AbCdEf1234$/);
  expect(link).not.toContain('050');
  expect(savedRequest.p_phone).toBe('0501234567');
  expect(savedRequest.p_customer_name).toBe('לקוחה לדוגמה');
  expect(savedRequest.p_items.length).toBeGreaterThan(0);
  await page.locator('#share-cart').click();
  expect(creationCount).toBe(1);
  const receiver = await page.context().newPage();
  await receiver.goto(link);
  await expect(receiver.locator('#cart-panel')).toHaveClass(/is-open/);
  await expect(receiver.locator('#customer-name')).toHaveValue('לקוחה לדוגמה');
  await expect(receiver.locator('#customer-phone')).toHaveValue('');
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

test('Studio design preview and local photo cropping do not require publishing to inspect', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/admin.html');
  await expect(page.locator('#login-screen')).toBeVisible();
  // In the smoke suite, reveal the UI only; backend writes still require real admin RLS.
  await page.evaluate(() => document.getElementById('dashboard').classList.remove('hidden'));
  await page.locator('[data-studio-tab="design"]').click();
  await expect(page.locator('#studio-pane-design')).toBeVisible();
  await expect(page.locator('#studio-preview-frame')).toBeVisible();
  await page.frameLocator('#studio-preview-frame').locator('.site-header').waitFor();
  await expect(page.locator('#studio-design-status')).toContainText('נטען');
  await page.locator('[name="lightHeader"]').fill('#dac4c7');
  await expect(page.locator('[name="lightHeader"]')).toHaveValue('#dac4c7');
  await expect.poll(async () => page.frameLocator('#studio-preview-frame').locator('.site-header').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(218, 196, 199)');
  await expect(page.locator('[name="logoUrl"]')).toHaveValue('assets/logo.png');
  await page.locator('[name="homeTitle"]').fill('קולקציות מעוצבות');
  await expect(page.frameLocator('#studio-preview-frame').locator('#home-heading')).toHaveText('קולקציות מעוצבות');
  await page.locator('[name="homePillowsImage"]').fill('assets/home-curtains.jpg');
  await expect(page.frameLocator('#studio-preview-frame').locator('.category-tile[data-nav="pillows"] img')).toHaveAttribute('src','assets/home-curtains.jpg');
  await page.locator('#studio-mobile-view').click();
  await expect(page.locator('#studio-preview-shell')).toHaveClass(/mobile/);
  await page.locator('[data-studio-tab="photos"]').click();
  await expect(page.locator('#studio-pane-photos')).toBeVisible();
  const sample = await page.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 30;
    const context = cv.getContext('2d');
    context.fillStyle = '#b75866';
    context.fillRect(0,0,30,30);
    return cv.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#photo-source-file').setInputFiles({name:'product.png',mimeType:'image/png',buffer:Buffer.from(sample,'base64')});
  await expect(page.locator('#photo-apply')).toBeEnabled();
  await page.locator('#photo-zoom').evaluate(el=>{el.value='1.5';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.locator('#photo-apply').click();
  await expect(page.locator('#studio-pane-products')).toBeVisible();
  await expect(page.locator('#preview')).toHaveAttribute('src', /blob:/);
  await expect(page.locator('#save')).toBeVisible();
});

test('Optional phone may be empty and admin inbox UI renders securely', async ({ page })=>{
  let saved=null;
  await page.context().route('**/rest/v1/rpc/dvir_create_short_cart',async route=>{
    saved=route.request().postDataJSON();
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify('MnOpQr5678')});
  });
  await page.goto('/#pillows');
  await expect(page.locator('.product-card').first()).toBeVisible();
  await page.locator('.product-add').first().click();
  await page.locator('#cart-trigger').click();
  await page.locator('#customer-name').fill('לקוח ללא טלפון');
  await page.locator('#share-cart').click();
  await expect(page.locator('#share-link-input')).toHaveValue(/\\?s=MnOpQr5678$/);
  expect(saved.p_phone).toBeNull();
  await page.goto('/admin.html');
  await expect(page.locator('#login-screen')).toBeVisible();
  await expect(page.locator('#studio-pane-inbox')).toBeHidden();
  await page.evaluate(()=>{
    document.querySelector('#dashboard').classList.remove('hidden');
    window.DVIR_ADMIN_DB={
      from:()=>{
        const rows=[{code:'MnOpQr5678',customer_name:'לקוח ללא טלפון',phone:null,
          status:'new',created_at:new Date().toISOString(),items:[['p1','45×45',1,null]]}];
        return {select:()=>({order:()=>({limit:async()=>({data:rows,error:null})})}),
          update:()=>({eq:async()=>({error:null})})};
      }
    };
  });
  await page.locator('[data-studio-tab="inbox"]').click();
  await expect(page.locator('#inbox-list .inbox-entry')).toHaveCount(1);
  await page.locator('#inbox-list .inbox-entry').click();
  await expect(page.locator('#inbox-detail')).toContainText('לקוח ללא טלפון');
  await expect(page.locator('#inbox-detail')).toContainText('הלקוח לא הזין מספר טלפון');
});

test('Old long cart links continue to open', async ({ page })=>{
  const legacy=Buffer.from(JSON.stringify([3,[['p1','45×45',1,null]],'לקוח ישן']),'utf8').toString('base64url');
  await page.goto('/?cart='+encodeURIComponent(legacy)+'#all');
  await expect(page.locator('#cart-panel')).toHaveClass(/is-open/);
  await expect(page.locator('#customer-name')).toHaveValue('לקוח ישן');
  await expect(page.locator('#customer-phone')).toHaveValue('');
  await expect(page.locator('#cart-list .cart-line')).toHaveCount(1);
});
