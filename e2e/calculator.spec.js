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
  await expect(page.locator('#materialMarkup')).toHaveValue('0');
  await expect(page.locator('#effMarginLine')).toBeHidden();
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
  await expect(page.locator('#srEff')).toHaveText(money(Math.round(r.profitPerLaborHour * 100)) + '/hr');
  await expect(page.locator('#stripLive')).toBeVisible();
  await expect(page.locator('#stripExample')).toBeHidden();
  await expect(page.locator('#custBtn')).toBeVisible();
  await expect(page.locator('#custBtn')).toHaveText('Copy customer quote');
  await expect(page.locator('#seeBreakdownBtn')).toBeVisible();
  await expect(page.locator('#exportActions')).toBeVisible();
  await expect(page.locator('#useExampleBtn')).toBeHidden();

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

// Same keystroke sequence on calculator.html and a trade page.
// The committed cap or negative note stays through blur, then the next
// edit in the field clears it.
async function exerciseMarkupTyping(page) {
  const field = page.locator('#materialMarkup');
  const msg = page.locator('#msg-materialMarkup');
  const price = page.locator('#suggestedPrice');
  const defaults = await page.evaluate(() => ({
    hours: Number(document.getElementById('hours').value),
    workers: Number(document.getElementById('workers').value),
    laborRate: Number(document.getElementById('laborRate').value),
    materialCost: Number(document.getElementById('materialCost').value),
    overhead: Number(document.getElementById('overhead').value),
    driveTime: Number(document.getElementById('driveTime').value),
    fuelCost: Number(document.getElementById('fuelCost').value),
    margin: Number(document.getElementById('profitMargin').value)
  }));
  const at0 = money(P.priceJob(Object.assign({ materialMarkup: 0 }, defaults)).cents.price);
  const at500 = money(P.priceJob(Object.assign({ materialMarkup: 500 }, defaults)).cents.price);
  // What a real number input exposes while the entry is still unfinished.
  const browserValue = (s) => /^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s) ? s : '';

  async function typeMarkup(text) {
    await field.click();
    await field.fill('');
    let typed = '';
    for (const ch of text) {
      typed += ch;
      await page.keyboard.type(ch);
      await expect(field).toHaveValue(browserValue(typed));
    }
  }

  async function nextKeystrokeClears(committed) {
    await expect(msg).toHaveText(committed);
    await field.click();
    await page.keyboard.press('Control+a');
    await expect(msg).toHaveText(committed);
    await page.keyboard.type('2');
    await expect(field).toHaveValue('2');
    await expect(msg).toHaveText('');
  }

  await typeMarkup('-50');
  await expect(field).toHaveValue('-50');
  await expect(msg).toHaveText('Enter 0 or more. Using 0.');
  await expect(price).toHaveText(at0);
  await field.blur();
  await expect(field).toHaveValue('0');
  await expect(msg).toHaveText('Enter 0 or more. Using 0.');
  await expect(price).toHaveText(at0);
  await nextKeystrokeClears('Enter 0 or more. Using 0.');

  await typeMarkup('600');
  await expect(field).toHaveValue('600');
  await expect(msg).toHaveText('Capped at 500%.');
  await expect(price).toHaveText(at500);
  await field.blur();
  await expect(field).toHaveValue('500');
  await expect(msg).toHaveText('Capped at 500%.');
  await expect(price).toHaveText(at500);
  await nextKeystrokeClears('Capped at 500%.');

  await typeMarkup('1e3');
  await expect(field).toHaveValue('1e3');
  await expect(msg).toHaveText('Capped at 500%.');
  await expect(price).toHaveText(at500);
  await field.blur();
  await expect(field).toHaveValue('500');
  await expect(msg).toHaveText('Capped at 500%.');
  await expect(price).toHaveText(at500);

  await field.click();
  await field.fill('');
  await expect(field).toHaveValue('');
  await expect(msg).toHaveText('');
  await expect(price).toHaveText(at0);
  await field.blur();
  await expect(field).toHaveValue('');
  await expect(msg).toHaveText('');
  await expect(price).toHaveText(at0);
  expect(await page.evaluate(() => localStorage.getItem('jpc_materialMarkup_v2'))).toBe('');
  expect(page.errors).toEqual([]);
}

test('material markup waits to rewrite until blur', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/calculator.html');
  await page.evaluate(() => localStorage.setItem('jpc_materialMarkup', '40'));
  await page.reload();
  await expect(page.locator('#materialMarkup')).toHaveValue('0');
  expect(await page.evaluate(() => localStorage.getItem('jpc_materialMarkup'))).toBeNull();
  await expect(page.locator('#msg-materialMarkup')).toHaveText('');
  await exerciseMarkupTyping(page);
});

test('material markup on the HVAC page types like the calculator', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/hvac-job-pricing.html');
  await expect(page.locator('#materialMarkup')).toHaveValue('0');
  await exerciseMarkupTyping(page);
});

test('stored markup of 600 or -5 is clamped on screen and in storage', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const url of ['/calculator.html', '/hvac-job-pricing.html']) {
    await page.goto(url);
    await page.evaluate(() => localStorage.setItem('jpc_materialMarkup_v2', '600'));
    await page.reload();
    await expect(page.locator('#materialMarkup')).toHaveValue('500');
    await expect(page.locator('#msg-materialMarkup')).toHaveText('Capped at 500%.');
    expect(await page.evaluate(() => localStorage.getItem('jpc_materialMarkup_v2'))).toBe('500');

    await page.evaluate(() => localStorage.setItem('jpc_materialMarkup_v2', '-5'));
    await page.reload();
    await expect(page.locator('#materialMarkup')).toHaveValue('0');
    await expect(page.locator('#msg-materialMarkup')).toHaveText('Enter 0 or more. Using 0.');
    expect(await page.evaluate(() => localStorage.getItem('jpc_materialMarkup_v2'))).toBe('0');
    expect(page.errors).toEqual([]);
  }
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
    await expect(page.locator('#materialMarkup')).toHaveValue('0');
    await expect(page.locator('#effMarginLine')).toBeHidden();
    const tip = await page.locator('label[for="overhead"] .tip').getAttribute('data-tip');
    expect(tip).toBe('Overhead ÷ direct job costs: labor + drive labor + materials at cost (fuel excluded).');
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
    await expect(page.locator('#materialMarkup')).toHaveValue('0');
    await expect(page.locator('#effMarginLine')).toBeHidden();
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
  await page.locator('#materialCost').fill('0');
  await page.locator('#driveTime').fill('0');
  await page.locator('#fuelCost').fill('0');
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

test('empty state sells a labeled example and one tap fills the form', async ({ page }) => {
  const example = P.priceJob({
    hours: P.PAGE_DEFAULTS.hours,
    workers: P.PAGE_DEFAULTS.workers,
    laborRate: P.PAGE_DEFAULTS.laborRate,
    materialCost: P.PAGE_DEFAULTS.materialCost,
    overhead: P.PAGE_DEFAULTS.overhead,
    driveTime: P.PAGE_DEFAULTS.driveTime,
    fuelCost: P.PAGE_DEFAULTS.fuelCost,
    margin: P.PAGE_DEFAULTS.margin
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/calculator.html');

  await expect(page.locator('#stripExample')).toBeVisible();
  await expect(page.locator('#stripExample .example-badge')).toHaveText('Example');
  await expect(page.locator('#useExampleBtn')).toBeVisible();
  await expect(page.locator('#custBtn')).toBeHidden();
  await expect(page.locator('#seeBreakdownBtn')).toBeHidden();
  await expect(page.locator('#exportActions')).toBeHidden();
  await expect(page.locator('#pdfBtn')).toBeHidden();
  await expect(page.locator('#custPdfBtn')).toBeHidden();
  await expect(page.locator('#exPrice')).toHaveText(money(example.cents.price));
  await expect(page.locator('#exProfit')).toHaveText(money(example.cents.profit));
  await expect(page.locator('#exMargin')).toHaveText(P.formatPercent(example.profit / example.price));
  await expect(page.locator('#exEff')).toHaveText(money(Math.round(example.profitPerLaborHour * 100)) + '/hr');
  await expect(page.locator('#suggestedPrice')).toHaveText('$0.00');
  await expect(page.locator('#msg-hours')).toHaveText('');
  await expect(page.locator('#resultStrip')).toHaveCSS('position', 'sticky');

  await expect(page.locator('.field-section-help')).toHaveCount(4);
  await expect(page.getByText('Hours on the job, crew size, and your loaded cost per hour, not what you bill.')).toBeVisible();
  await expect(page.getByText('What you pay the supplier. Your margin already earns profit on this.')).toBeVisible();
  await expect(page.getByText('Shop overhead plus the trip. Drive time and fuel sit together so unpaid drive is not missed.')).toBeVisible();
  await expect(page.getByText('The share of the price you keep after every job cost.')).toBeVisible();
  await expect(page.locator('p.field-section', { hasText: 'Margin' })).toBeVisible();
  await expect(page.locator('.field-subhead')).toHaveText('Drive time and fuel');
  const driveBox = page.locator('#driveTime');
  const fuelBox = page.locator('#fuelCost');
  await expect(driveBox).toBeVisible();
  await expect(fuelBox).toBeVisible();
  const sameGrid = await page.evaluate(() => {
    const drive = document.getElementById('driveTime');
    const fuel = document.getElementById('fuelCost');
    return drive.closest('.igrid') === fuel.closest('.igrid');
  });
  expect(sameGrid).toBe(true);

  await page.locator('#useExampleBtn').click();
  await expect(page.locator('#hours')).toHaveValue('4');
  await expect(page.locator('#workers')).toHaveValue('1');
  await expect(page.locator('#laborRate')).toHaveValue('75');
  await expect(page.locator('#materialCost')).toHaveValue('200');
  await expect(page.locator('#driveTime')).toHaveValue('0.5');
  await expect(page.locator('#fuelCost')).toHaveValue('10');
  await expect(page.locator('#overhead')).toHaveValue('15');
  await expect(page.locator('#profitMargin')).toHaveValue('20');
  await expect(page.locator('#jobLabel')).toHaveValue('Example: 4-hour service call');
  await expect(page.locator('#suggestedPrice')).toHaveText(money(example.cents.price));
  await expect(page.locator('#srPrice')).toHaveText(money(example.cents.price));
  await expect(page.locator('#srProfit')).toHaveText(money(example.cents.profit));
  await expect(page.locator('#srMargin')).toHaveText(P.formatPercent(example.profit / example.price));
  await expect(page.locator('#srEff')).toHaveText(money(Math.round(example.profitPerLaborHour * 100)) + '/hr');
  await expect(page.locator('#stripExample')).toBeHidden();
  await expect(page.locator('#stripLive')).toBeVisible();
  await expect(page.locator('#custBtn')).toBeVisible();
  await expect(page.locator('#seeBreakdownBtn')).toBeVisible();
  await expect(page.locator('#exportActions')).toBeVisible();
  await expect(page.locator('#useExampleBtn')).toBeHidden();
  expect(page.errors).toEqual([]);
});
