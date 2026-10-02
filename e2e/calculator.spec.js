const { test, expect } = require('@playwright/test');
const path = require('path');
const P = require('../js/pricing.js');

const HVAC = {
  hours: 10,
  workers: 2,
  laborRate: 45,
  materialCost: 6000,
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
  await expect(page.locator('#materialMarkup')).toHaveCount(0);
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

const BLOG = {
  furnaceB: {
    hours: '1.5', workers: '1', laborRate: '48', materialCost: '5.65',
    overhead: '25', driveTime: '0.5', fuelCost: '8.93', profitMargin: '20',
    price: '$169.99', cost: '$135.99', profit: '$34.00', margin: '20.0%'
  },
  whA: {
    hours: '6', workers: '2', laborRate: '45', materialCost: '5432.54',
    overhead: '17', driveTime: '1', fuelCost: '18', profitMargin: '20',
    price: '$8,888.96', cost: '$7,111.17', profit: '$1,777.79', margin: '20.0%'
  },
  whB: {
    hours: '6', workers: '2', laborRate: '45', materialCost: '9571.95',
    overhead: '17', driveTime: '1', fuelCost: '18', profitMargin: '20',
    price: '$14,942.85', cost: '$11,954.28', profit: '$2,988.57', margin: '20.0%'
  }
};

async function fillJob(page, fields) {
  for (const key of ['hours', 'workers', 'laborRate', 'materialCost', 'overhead', 'driveTime', 'fuelCost', 'profitMargin']) {
    await page.locator('#' + key).fill(fields[key]);
  }
  const bk = page.locator('#bkBody');
  if (!/open/.test((await bk.getAttribute('class')) || '')) {
    await page.locator('#bkToggle').click();
  }
}

test('blog cases on calculator.html at desktop and mobile', async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/calculator.html');
    await expect(page.locator('#materialMarkup')).toHaveCount(0);
    const tip = await page.locator('label[for="overhead"] .tip').getAttribute('data-tip');
    expect(tip).toContain('labor + drive labor + materials at cost (fuel excluded)');
    for (const fields of Object.values(BLOG)) {
      await fillJob(page, fields);
      await expect(page.locator('#suggestedPrice')).toHaveText(fields.price);
      await expect(page.locator('#bd-total')).toHaveText(fields.cost);
      await expect(page.locator('#netProfit')).toHaveText(fields.profit);
      await expect(page.locator('#marginDisplay')).toHaveText(fields.margin);
      const body = await page.locator('body').innerText();
      expect(body).not.toContain('NaN');
    }
    expect(page.errors).toEqual([]);
  }
  await page.screenshot({ path: path.join(shotDir, 'calculator-desktop.png'), fullPage: false });
});

test('HVAC trade page matches the no-drive hand check', async ({ page }) => {
  const fields = {
    hours: '10', workers: '2', laborRate: '45', materialCost: '6000',
    overhead: '15', driveTime: '0', fuelCost: '0', profitMargin: '20'
  };
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/hvac-job-pricing.html');
    await expect(page.locator('#materialMarkup')).toHaveCount(0);
    await fillJob(page, fields);
    await expect(page.locator('#suggestedPrice')).toHaveText('$9,918.75');
    await expect(page.locator('#bd-total')).toHaveText('$7,935.00');
    await expect(page.locator('#bd-oh')).toHaveText('$1,035.00');
    await expect(page.locator('#netProfit')).toHaveText('$1,983.75');
    expect(page.errors).toEqual([]);
  }
});

test('fractional workers and payment-terms HTML are handled', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/calculator.html');
  await page.locator('#workers').fill('1.5');
  await expect(page.locator('#msg-workers')).toContainText('Enter a whole number.');
  await expect(page.locator('#suggestedPrice')).toHaveText('$0.00');

  await page.locator('#workers').fill('1');
  await page.locator('#hours').fill('2');
  await page.locator('#laborRate').fill('40');
  await page.locator('#qsToggle').click();
  await expect(page.locator('#qsPanel')).toHaveClass(/open/);
  await page.locator('#includeTerms').check();
  await page.locator('#paymentTerms').fill('<img src=x onerror=alert(1)>');
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('#custPdfBtn').click();
  const html = await page.locator('#custFooterRows').innerHTML();
  expect(html).toContain('&lt;img');
  expect(html).not.toContain('<img');
  await expect(page.locator('#custFooterRows img')).toHaveCount(0);
  expect(page.errors).toEqual([]);
});
