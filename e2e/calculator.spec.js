const { test, expect } = require('@playwright/test');
const path = require('path');
const P = require('../js/pricing.js');

const HVAC = {
  hours: 10,
  workers: 2,
  laborRate: 45,
  materialCost: 6000,
  materialMarkup: 10,
  overhead: 15,
  driveTime: 1,
  fuelCost: 40,
  margin: 20
};

const shotDir = process.env.SCREENSHOT_DIR || path.join(__dirname, '..', 'artifacts', 'screenshots');

function money(cents) {
  return P.formatDollars(cents);
}

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/googletagmanager|google-analytics|adsbygoogle|fundingchoices|doubleclick|googleapis|gstatic/i.test(text)) return;
    errors.push(text);
  });
  page.errors = errors;
});

async function enterHvac(page) {
  await page.goto('/index.html');
  await page.locator('#hours').fill(String(HVAC.hours));
  await page.locator('#workers').fill(String(HVAC.workers));
  await page.locator('#laborRate').fill(String(HVAC.laborRate));
  await page.locator('#materialCost').fill(String(HVAC.materialCost));
  await page.locator('#materialMarkup').fill(String(HVAC.materialMarkup));
  await page.locator('#overhead').fill(String(HVAC.overhead));
  await page.locator('#driveTime').fill(String(HVAC.driveTime));
  await page.locator('#fuelCost').fill(String(HVAC.fuelCost));
  await page.locator('#profitMargin').fill(String(HVAC.margin));
  await page.locator('#bkToggle').click();
}

test('HVAC changeout on desktop and mobile', async ({ page }) => {
  const r = P.priceJob(HVAC);
  await page.setViewportSize({ width: 1280, height: 900 });
  await enterHvac(page);

  await expect(page.locator('#suggestedPrice')).toHaveText(money(r.cents.price));
  await expect(page.locator('#netProfit')).toHaveText(money(r.cents.profit));
  await expect(page.locator('#marginDisplay')).toHaveText(P.formatPercent(r.profit / r.price));
  await expect(page.locator('#effRate')).toHaveText(money(Math.round(r.profitPerLaborHour * 100)) + '/hr');
  await expect(page.locator('#bd-labor')).toHaveText(money(r.cents.labor));
  await expect(page.locator('#bd-drive')).toHaveText(money(r.cents.driveLabor));
  await expect(page.locator('#bd-fuel')).toHaveText(money(r.cents.fuel));
  await expect(page.locator('#bd-mat')).toHaveText(money(r.cents.materials));
  await expect(page.locator('#bd-markup')).toHaveText(money(r.cents.markup));
  await expect(page.locator('#bd-oh')).toHaveText(money(r.cents.overhead));
  await expect(page.locator('#bd-total')).toHaveText(money(r.cents.totalCost));
  await expect(page.locator('#bd-setaside')).toHaveText(money(r.cents.setAside));
  await expect(page.locator('#q-labor')).toHaveText(money(r.cents.quoteLabor));
  await expect(page.locator('#q-mat')).toHaveText(money(r.cents.quoteMaterials));
  await expect(page.locator('#q-drive')).toHaveText(money(r.cents.quoteDrive));
  await expect(page.locator('#q-fuel')).toHaveText(money(r.cents.quoteFuel));
  await expect(page.locator('#q-total')).toHaveText(money(r.cents.price));
  await expect(page.locator('#srPrice')).toHaveText(money(r.cents.price));
  await expect(page.locator('#srMargin')).toHaveText(P.formatPercent(r.profit / r.price));
  await expect(page.locator('#srProfit')).toHaveText(money(r.cents.profit));

  const body = await page.locator('body').innerText();
  expect(body).not.toContain('NaN');
  expect(body).not.toContain('Infinity');
  expect(page.errors).toEqual([]);

  await page.locator('#calculator').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shotDir, 'hvac-desktop.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#suggestedPrice').scrollIntoViewIfNeeded();
  await expect(page.locator('#suggestedPrice')).toHaveText(money(r.cents.price));
  await expect(page.locator('#netProfit')).toHaveText(money(r.cents.profit));
  await expect(page.locator('#marginDisplay')).toHaveText(P.formatPercent(r.profit / r.price));
  await expect(page.locator('#effRate')).toHaveText(money(Math.round(r.profitPerLaborHour * 100)) + '/hr');
  await expect(page.locator('#q-total')).toHaveText(money(r.cents.price));
  const mobileBody = await page.locator('body').innerText();
  expect(mobileBody).not.toContain('NaN');
  expect(page.errors).toEqual([]);
  await page.screenshot({ path: path.join(shotDir, 'hvac-mobile.png'), fullPage: true });
});

test('invalid input shows a message and no NaN', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/index.html');
  await page.locator('#laborRate').fill('-5');
  await expect(page.locator('#msg-laborRate')).toContainText("Can't be negative.");
  await expect(page.locator('#suggestedPrice')).toHaveText('$0.00');
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('NaN');
  expect(body).not.toContain('Infinity');
  expect(page.errors).toEqual([]);
  await page.screenshot({ path: path.join(shotDir, 'invalid-desktop.png'), fullPage: false });
});
