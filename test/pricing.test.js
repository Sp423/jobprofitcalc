const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/pricing.js');

function cents(dollars) {
  return Math.round(dollars * 100);
}

function job(overrides) {
  return Object.assign({
    hours: 0,
    workers: 1,
    laborRate: 0,
    materialCost: 0,
    overhead: 0,
    driveTime: 0,
    fuelCost: 0,
    margin: 0
  }, overrides);
}

function assertIdentity(result, marginPct) {
  assert.equal(result.ok, true);
  assert.equal(result.seTax, 0);
  assert.equal(result.stateTax, 0);
  assert.equal(result.taxes, 0);
  const denom = Number((100 - marginPct).toPrecision(12));
  const expectedPrice = Math.round(Number((result.cents.totalCost * 100 / denom).toPrecision(15)));
  assert.equal(result.cents.price, expectedPrice);
  assert.ok(Math.abs(result.price - result.cents.totalCost / denom) <= 0.01);
  if (result.cents.price > 0) {
    assert.ok((result.cents.price - result.cents.totalCost) / result.cents.price < 0.95);
  }
  assert.equal(result.cents.price, result.cents.totalCost + result.cents.profit);
  if (result.cents.price > 0) {
    assert.ok(Math.abs(result.marginPct / 100 - result.profit / result.price) < 1e-12);
  } else {
    assert.equal(result.marginPct, 0);
  }
  const c = result.cents;
  assert.equal(c.labor + c.driveLabor + c.materials + c.overhead + c.fuel, c.totalCost);
  assert.equal(c.quoteLabor + c.quoteMaterials + c.quoteDrive + c.quoteFuel, c.price);
  assert.equal(c.directCost, c.labor + c.driveLabor + c.materials);
  assert.ok(Number.isFinite(result.price) && result.price >= 0);
  assert.ok(Number.isFinite(result.totalCost) && result.totalCost >= 0);
}

test('page default inputs', () => {
  // hours 4 × 1 × $75 = $300.00
  // drive 0.5 × 1 × $75 = $37.50
  // materials $200.00 at cost
  // direct = 300 + 37.50 + 200 = $537.50
  // overhead 15% × 537.50 = $80.625 → $80.63
  // fuel $10.00 is outside the overhead base
  // total cost = 537.50 + 80.63 + 10.00 = $628.13
  // price = 628.13 / 0.80 = 785.1625 → $785.16
  // profit = 785.16 − 628.13 = $157.03
  // profit per labor hour = 157.03 / 4 = $39.2575 → $39.26
  const d = P.PAGE_DEFAULTS;
  const r = P.priceJob(job({
    hours: d.hours,
    workers: d.workers,
    laborRate: d.laborRate,
    materialCost: d.materialCost,
    overhead: d.overhead,
    driveTime: d.driveTime,
    fuelCost: d.fuelCost,
    margin: d.margin
  }));
  assertIdentity(r, 20);
  assert.equal(r.labor, 300);
  assert.equal(r.driveLabor, 37.5);
  assert.equal(r.materials, 200);
  assert.equal(r.overhead, 80.63);
  assert.equal(r.fuel, 10);
  assert.equal(r.totalCost, 628.13);
  assert.equal(r.price, 785.16);
  assert.equal(r.profit, 157.03);
  assert.equal(Math.round(r.profitPerLaborHour * 100) / 100, 39.26);
});

test('HVAC changeout: 20 crew-hours with drive and fuel', () => {
  // 10 hr × 2 × $45 = $900.00 labor
  // 1 hr × 2 × $45 = $90.00 drive labor
  // materials $6,000.00 at cost
  // direct = 900 + 90 + 6000 = $6,990.00
  // overhead 15% × 6990 = $1,048.50
  // fuel $40.00
  // total cost = 900 + 90 + 6000 + 1048.50 + 40 = $8,078.50
  // price = 8078.50 / 0.80 = 10098.125 → $10,098.13
  // profit = 10098.13 − 8078.50 = $2,019.63
  // profit per labor hour = 2019.63 / 20 = $100.9815 → $100.98
  const r = P.priceJob(job({
    hours: 10, workers: 2, laborRate: 45, materialCost: 6000,
    overhead: 15, driveTime: 1, fuelCost: 40, margin: 20
  }));
  assertIdentity(r, 20);
  assert.equal(r.totalCost, 8078.5);
  assert.equal(r.price, 10098.13);
  assert.equal(r.profit, 2019.63);
});

test('HVAC hand-check: 20 crew-hours, no drive, no fuel', () => {
  // labor 10 × 2 × 45 = 900.00
  // materials 6,000.00
  // direct = 6,900.00
  // overhead 15% × 6,900 = 1,035.00
  // total = 7,935.00
  // price = 7,935 / 0.80 = 9,918.75
  // profit = 1,983.75
  const r = P.priceJob(job({
    hours: 10, workers: 2, laborRate: 45, materialCost: 6000,
    overhead: 15, driveTime: 0, fuelCost: 0, margin: 20
  }));
  assertIdentity(r, 20);
  assert.equal(r.directCost, 6900);
  assert.equal(r.overhead, 1035);
  assert.equal(r.totalCost, 7935);
  assert.equal(r.price, 9918.75);
  assert.equal(r.profit, 1983.75);
});

test('solo labor-only job', () => {
  // 8 × 1 × $40 = $320.00
  // overhead 10% × 320 = $32.00
  // fuel 0, materials 0, drive 0
  // total cost = $352.00
  // price = 352 / 0.75 = 469.333… → $469.33
  // profit = 469.33 − 352.00 = $117.33
  const r = P.priceJob(job({
    hours: 8, workers: 1, laborRate: 40, overhead: 10, margin: 25
  }));
  assertIdentity(r, 25);
  assert.equal(r.labor, 320);
  assert.equal(r.materials, 0);
  assert.equal(r.driveLabor, 0);
  assert.equal(r.fuel, 0);
  assert.equal(r.overhead, 32);
  assert.equal(r.totalCost, 352);
  assert.equal(r.price, 469.33);
  assert.equal(r.profit, 117.33);
  assert.equal(r.seTax, 0);
});

test('materials-only job', () => {
  // materials $500, overhead 10% × 500 = $50.00, fuel 0
  // total cost = $550.00
  // price = 550 / 0.85 = 647.0588… → $647.06
  const r = P.priceJob(job({
    hours: 0, workers: 1, laborRate: 0, materialCost: 500,
    overhead: 10, margin: 15
  }));
  assertIdentity(r, 15);
  assert.equal(r.labor, 0);
  assert.equal(r.materials, 500);
  assert.equal(r.overhead, 50);
  assert.equal(r.totalCost, 550);
  assert.equal(r.price, 647.06);
  assert.equal(r.profitPerLaborHour, null);
});

test('multi-person crew multiplies drive hours', () => {
  // labor 3 × 3 × $50 = $450.00
  // drive 2 × 3 × $50 = $300.00  (not 2 × $50)
  // materials $100, fuel $15
  // direct = 450 + 300 + 100 = $850.00
  // overhead 10% × 850 = $85.00  (fuel is not in this base)
  // total cost = 850 + 85 + 15 = $950.00
  // price = 950 / 0.80 = $1,187.50
  const r = P.priceJob(job({
    hours: 3, workers: 3, laborRate: 50, materialCost: 100,
    overhead: 10, driveTime: 2, fuelCost: 15, margin: 20
  }));
  assertIdentity(r, 20);
  assert.equal(r.driveLabor, 300);
  assert.equal(r.overhead, 85);
  assert.equal(r.fuel, 15);
  assert.equal(r.totalCost, 950);
  assert.equal(r.price, 1187.5);
  const onePerson = P.priceJob(job({
    hours: 3, workers: 1, laborRate: 50, materialCost: 100,
    overhead: 10, driveTime: 2, fuelCost: 15, margin: 20
  }));
  assert.equal(onePerson.driveLabor, 100);
});

test('fuel is outside the overhead base', () => {
  const low = P.priceJob(job({
    hours: 2, workers: 1, laborRate: 40, materialCost: 10,
    overhead: 25, driveTime: 1, fuelCost: 8.93, margin: 20
  }));
  const high = P.priceJob(job({
    hours: 2, workers: 1, laborRate: 40, materialCost: 10,
    overhead: 25, driveTime: 1, fuelCost: 80, margin: 20
  }));
  assert.equal(low.overhead, high.overhead);
  assert.equal(high.totalCost - low.totalCost, cents(80 - 8.93) / 100);
});

test('furnace tune-up example B matches to the cent', () => {
  // 1.5 × 1 × 48 = 72.00
  // 0.5 × 1 × 48 = 24.00
  // direct = 72 + 24 + 5.65 = 101.65
  // overhead 25% × 101.65 = 25.4125 → 25.41
  // total = 72 + 24 + 8.93 + 5.65 + 25.41 = 135.99
  // price = 135.99 / 0.80 = 169.9875 → 169.99
  const r = P.priceJob(job({
    hours: 1.5, workers: 1, laborRate: 48, materialCost: 5.65,
    overhead: 25, driveTime: 0.5, fuelCost: 8.93, margin: 20
  }));
  assertIdentity(r, 20);
  assert.equal(r.labor, 72);
  assert.equal(r.driveLabor, 24);
  assert.equal(r.overhead, 25.41);
  assert.equal(r.totalCost, 135.99);
  assert.equal(r.price, 169.99);
  assert.equal(r.profit, 34);
});

test('commercial gas water heater option A matches to the cent', () => {
  // labor 6 × 2 × 45 = 540.00
  // drive 1 × 2 × 45 = 90.00
  // materials 5432.54
  // direct = 540 + 90 + 5432.54 = 6062.54
  // overhead 17% × 6062.54 = 1030.6318 → 1030.63
  // total = 540 + 90 + 18 + 5432.54 + 1030.63 = 7111.17
  // price = 7111.17 / 0.80 = 8888.9625 → 8888.96
  const r = P.priceJob(job({
    hours: 6, workers: 2, laborRate: 45, materialCost: 5432.54,
    overhead: 17, driveTime: 1, fuelCost: 18, margin: 20
  }));
  assertIdentity(r, 20);
  assert.equal(r.overhead, 1030.63);
  assert.equal(r.totalCost, 7111.17);
  assert.equal(r.price, 8888.96);
  assert.equal(r.profit, 1777.79);
});

test('commercial gas water heater option B matches to the cent', () => {
  // materials 9571.95
  // direct = 540 + 90 + 9571.95 = 10201.95
  // overhead 17% × 10201.95 = 1734.3315 → 1734.33
  // total = 540 + 90 + 18 + 9571.95 + 1734.33 = 11954.28
  // price = 11954.28 / 0.80 = 14942.85
  const r = P.priceJob(job({
    hours: 6, workers: 2, laborRate: 45, materialCost: 9571.95,
    overhead: 17, driveTime: 1, fuelCost: 18, margin: 20
  }));
  assertIdentity(r, 20);
  assert.equal(r.overhead, 1734.33);
  assert.equal(r.totalCost, 11954.28);
  assert.equal(r.price, 14942.85);
  assert.equal(r.profit, 2988.57);
});

test('other furnace rows from the same draft', () => {
  const a = P.priceJob(job({
    hours: 1, workers: 1, laborRate: 48, materialCost: 5.65,
    overhead: 25, driveTime: 0.5, fuelCost: 8.93, margin: 20
  }));
  assert.equal(a.totalCost, 105.99);
  assert.equal(a.price, 132.49);

  const condensing = P.priceJob(job({
    hours: 1.75, workers: 1, laborRate: 48, materialCost: 5.65,
    overhead: 25, driveTime: 0.5, fuelCost: 8.93, margin: 20
  }));
  assert.equal(condensing.totalCost, 150.99);
  assert.equal(condensing.price, 188.74);

  const c = P.priceJob(job({
    hours: 1.5, workers: 1, laborRate: 48, materialCost: 5.65,
    overhead: 25, driveTime: 1, fuelCost: 17.86, margin: 20
  }));
  assert.equal(c.totalCost, 174.92);
  assert.equal(c.price, 218.65);

  const sensor = P.priceJob(job({
    hours: 0.25, workers: 1, laborRate: 48, materialCost: 13.48,
    overhead: 25, margin: 20
  }));
  assert.equal(sensor.totalCost, 31.85);
  assert.equal(sensor.price, 39.81);

  // 1.5 × 29.33 = 43.995 → 44.00; 0.5 × 29.33 = 14.665 → 14.67
  const wage = P.priceJob(job({
    hours: 1.5, workers: 1, laborRate: 29.33, materialCost: 5.65,
    overhead: 25, driveTime: 0.5, fuelCost: 8.93, margin: 20
  }));
  assert.equal(wage.labor, 44);
  assert.equal(wage.driveLabor, 14.67);
  assert.equal(wage.totalCost, 89.33);
});

test('validation messages', () => {
  const empty = P.validateJob(job({ hours: '', workers: '1', laborRate: '10', materialCost: '0', overhead: '0', driveTime: '0', fuelCost: '0', margin: '20' }));
  assert.equal(empty.ok, false);
  assert.equal(empty.messages.hours.level, 'error');
  assert.match(empty.messages.hours.message, /number/i);

  const zero = P.validateJob(job({ hours: '0', workers: '1', laborRate: '0', materialCost: '0', overhead: '0', driveTime: '0', fuelCost: '0', margin: '0' }));
  assert.equal(zero.ok, true);
  assert.equal(zero.messages.hours.level, 'info');
  assert.match(zero.messages.hours.message, /zero/i);
  const priced = P.priceJob(zero.values);
  assert.equal(priced.price, 0);
  assert.ok(Number.isFinite(priced.price));

  const neg = P.validateJob(job({ hours: '1', workers: '1', laborRate: '-5', materialCost: '0', overhead: '0', driveTime: '0', fuelCost: '0', margin: '20' }));
  assert.equal(neg.ok, false);
  assert.match(neg.messages.laborRate.message, /negative/i);

  const text = P.validateJob(job({ hours: 'abc', workers: '1', laborRate: '10', materialCost: '0', overhead: '0', driveTime: '0', fuelCost: '0', margin: '20' }));
  assert.equal(text.ok, false);
  assert.equal(text.messages.hours.level, 'error');

  const cap = P.validateJob(job({ hours: '1', workers: '1', laborRate: '10', materialCost: '0', overhead: '0', driveTime: '0', fuelCost: '0', margin: '95' }));
  assert.equal(cap.ok, false);
  assert.match(cap.messages.margin.message, /under 95/);

  const overCap = P.validateJob(job({ hours: '1', workers: '1', laborRate: '10', materialCost: '0', overhead: '0', driveTime: '0', fuelCost: '0', margin: '100' }));
  assert.equal(overCap.ok, false);

  const warn = P.validateJob(job({ hours: '1', workers: '1', laborRate: '10', materialCost: '0', overhead: '0', driveTime: '0', fuelCost: '0', margin: '61' }));
  assert.equal(warn.ok, true);
  assert.equal(warn.messages.margin.level, 'warn');
  assert.ok(P.priceJob(warn.values).price > 0);

  const atWarn = P.validateJob(job({ hours: '1', workers: '1', laborRate: '10', materialCost: '0', overhead: '0', driveTime: '0', fuelCost: '0', margin: '60' }));
  assert.equal(atWarn.messages.margin.level, 'ok');

  const huge = P.validateJob(job({ hours: '1', workers: '1', laborRate: '10', materialCost: '5000001', overhead: '0', driveTime: '0', fuelCost: '0', margin: '20' }));
  assert.equal(huge.ok, false);
  assert.match(huge.messages.materialCost.message, /Maximum/);

  const inf = P.priceJob(job({ hours: Infinity, laborRate: 10, margin: 20 }));
  assert.equal(inf.ok, false);
});

test('random inputs: quote lines sum to the price in cents', () => {
  let seed = 20261002;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function pick(min, max, step) {
    const n = Math.round((min + rnd() * (max - min)) / step) * step;
    return Math.min(max, Math.max(min, Math.round(n * 1000) / 1000));
  }
  for (let i = 0; i < 200; i++) {
    const input = {
      hours: pick(0, 40, 0.25),
      workers: pick(1, 8, 1),
      laborRate: pick(0, 120, 0.5),
      materialCost: pick(0, 20000, 0.01),
      overhead: pick(0, 40, 0.5),
      driveTime: pick(0, 4, 0.25),
      fuelCost: pick(0, 200, 0.01),
      margin: pick(0, 60, 0.5)
    };
    const r = P.priceJob(input);
    assert.equal(r.ok, true, JSON.stringify(input));
    assertIdentity(r, input.margin);
    for (const key of ['labor', 'driveLabor', 'fuel', 'materials', 'overhead', 'totalCost', 'price', 'profit']) {
      assert.ok(Number.isFinite(r[key]) && r[key] >= 0, key);
    }
  }
});

test('half-cent labor and high-margin price round half up', () => {
  // 0.75 × 44.62 = 33.465 → 33.47
  const a = P.priceJob(job({ hours: 0.75, workers: 1, laborRate: 44.62 }));
  assert.equal(a.labor, 33.47);
  // 0.75 × 106.10 = 79.575 → 79.58
  const b = P.priceJob(job({ hours: 0.75, workers: 1, laborRate: 106.10 }));
  assert.equal(b.labor, 79.58);
  // 0.3 × 3 × 41.65 = 37.485 → 37.49
  const c = P.priceJob(job({ hours: 0.3, workers: 3, laborRate: 41.65 }));
  assert.equal(c.labor, 37.49);
  // 1554.06 / (1 − 0.84) = 9712.875 → 9712.88
  const d = P.priceJob(job({ materialCost: 1554.06, margin: 84 }));
  assert.equal(d.totalCost, 1554.06);
  assert.equal(d.price, 9712.88);
});

test('workers must be a whole number', () => {
  const v = P.validateJob(job({
    hours: '1', workers: '1.5', laborRate: '40', materialCost: '0',
    overhead: '0', driveTime: '0', fuelCost: '0', margin: '20'
  }));
  assert.equal(v.ok, false);
  assert.equal(v.messages.workers.level, 'error');
  assert.match(v.messages.workers.message, /whole number/i);
  assert.equal(P.priceJob(job({ hours: 1, workers: 1.5, laborRate: 40, margin: 20 })).ok, false);
  const whole = P.validateJob(job({
    hours: '1', workers: '2', laborRate: '40', materialCost: '0',
    overhead: '0', driveTime: '0', fuelCost: '0', margin: '20'
  }));
  assert.equal(whole.ok, true);
});

test('margin display does not round 94.9999 up to 95.0%', () => {
  assert.equal(P.formatPercent(0.949999), '94.9%');
  assert.notEqual(P.formatPercent(0.949999), '95.0%');
  // 19.999…% still shows as 20.0%, which is what the blog cases display.
  assert.equal(P.formatPercent(1777.79 / 8888.96), '20.0%');
});

test('markup 0 matches the no-markup formula on representative jobs', () => {
  // Independent copy of the engine from before material markup was added.
  // Overhead stays on materials at cost. Markup dollars are not in this path.
  function legacyCents(input) {
    const rc = P.rc;
    const hours = +input.hours;
    const workers = +input.workers;
    const laborRate = +input.laborRate;
    const materialCost = +input.materialCost;
    const overheadPct = +input.overhead;
    const driveTime = +input.driveTime;
    const fuelCost = +input.fuelCost;
    const marginPct = +input.margin;
    const salesTaxPct = input.salesTaxRate == null ? 0 : +input.salesTaxRate;
    const labor = rc(hours * workers * laborRate * 100);
    const driveLabor = rc(driveTime * workers * laborRate * 100);
    const materials = rc(materialCost * 100);
    const fuel = rc(fuelCost * 100);
    const direct = labor + driveLabor + materials;
    const overhead = rc(direct * overheadPct / 100);
    const totalCost = direct + overhead + fuel;
    let price = rc(totalCost * 100 / Number((100 - marginPct).toPrecision(12)));
    if (totalCost > 0 && price >= totalCost * 20) price = totalCost * 20 - 1;
    const profit = price - totalCost;
    const ohParts = P.allocateCents(overhead, [labor, driveLabor, materials]);
    const laborWithOh = labor + ohParts[0];
    const driveWithOh = driveLabor + ohParts[1];
    const matWithOh = materials + ohParts[2];
    const profitParts = P.allocateCents(profit, [laborWithOh, driveWithOh, matWithOh, fuel]);
    const quoteMaterials = matWithOh + profitParts[2];
    const salesTax = rc(quoteMaterials * salesTaxPct / 100);
    const setAside = rc(profit * P.SE_NET_FACTOR * P.SE_RATE);
    return {
      labor, driveLabor, fuel, materials, directCost: direct, overhead, totalCost,
      price, profit, setAside, salesTax, customerTotal: price + salesTax,
      quoteLabor: laborWithOh + profitParts[0],
      quoteMaterials,
      quoteDrive: driveWithOh + profitParts[1],
      quoteFuel: fuel + profitParts[3]
    };
  }

  const samples = [
    { hours: 4, workers: 1, laborRate: 75, materialCost: 200, overhead: 15, driveTime: 0.5, fuelCost: 10, margin: 20 },
    { hours: 10, workers: 2, laborRate: 45, materialCost: 6000, overhead: 15, driveTime: 1, fuelCost: 40, margin: 20 },
    { hours: 10, workers: 2, laborRate: 45, materialCost: 6000, overhead: 15, driveTime: 0, fuelCost: 0, margin: 20 },
    { hours: 1.5, workers: 1, laborRate: 48, materialCost: 5.65, overhead: 25, driveTime: 0.5, fuelCost: 8.93, margin: 20 },
    { hours: 6, workers: 2, laborRate: 45, materialCost: 5432.54, overhead: 17, driveTime: 1, fuelCost: 18, margin: 20 },
    { hours: 6, workers: 2, laborRate: 45, materialCost: 9571.95, overhead: 17, driveTime: 1, fuelCost: 18, margin: 20 },
    { hours: 0, workers: 1, laborRate: 0, materialCost: 500, overhead: 10, driveTime: 0, fuelCost: 0, margin: 15 },
    { hours: 8, workers: 1, laborRate: 40, materialCost: 0, overhead: 10, driveTime: 0, fuelCost: 0, margin: 25 },
    { hours: 0.75, workers: 1, laborRate: 44.62, materialCost: 12.5, overhead: 18, driveTime: 0.25, fuelCost: 4.5, margin: 33 },
    { hours: 1, workers: 1, laborRate: 10, materialCost: 3611.04, overhead: 0, driveTime: 0, fuelCost: 0, margin: 94.88 },
    { hours: 2, workers: 3, laborRate: 55.5, materialCost: 80.01, overhead: 12.5, driveTime: 1.25, fuelCost: 9.99, margin: 0, salesTaxRate: 8.25 },
    { hours: 0, workers: 1, laborRate: 0, materialCost: 0, overhead: 0, driveTime: 0, fuelCost: 0, margin: 0 }
  ];
  const keys = ['labor', 'driveLabor', 'fuel', 'materials', 'directCost', 'overhead', 'totalCost', 'price', 'profit', 'setAside', 'salesTax', 'customerTotal', 'quoteLabor', 'quoteMaterials', 'quoteDrive', 'quoteFuel'];
  for (const input of samples) {
    const old = legacyCents(input);
    for (const markup of [0, '0', '', null, undefined]) {
      const next = P.priceJob(job(Object.assign({}, input, { materialMarkup: markup })));
      assert.equal(next.ok, true, JSON.stringify(input));
      for (const key of keys) {
        assert.equal(next.cents[key], old[key], key + ' ' + JSON.stringify(input) + ' markup=' + String(markup));
      }
      assert.equal(next.markup, 0);
      assert.equal(next.cents.markup, 0);
    }
  }
});

test('exact-decimal reference matches every line on seeded jobs', () => {
  // Integer significand / 10^scale. Round half up (away from zero on a tie).
  function dec(value) {
    const s = String(value);
    const neg = s.startsWith('-');
    const body = neg ? s.slice(1) : s;
    if (!/^\d+(\.\d+)?$/.test(body)) throw new Error('bad decimal ' + s);
    const parts = body.split('.');
    const frac = parts[1] || '';
    const digits = (parts[0] + frac).replace(/^0+(?=\d)/, '') || '0';
    return { sign: neg ? -1n : 1n, int: BigInt(digits), scale: frac.length };
  }
  function mul(a, b) {
    return { sign: a.sign * b.sign, int: a.int * b.int, scale: a.scale + b.scale };
  }
  function add(a, b) {
    const scale = Math.max(a.scale, b.scale);
    const ai = a.sign * a.int * (10n ** BigInt(scale - a.scale));
    const bi = b.sign * b.int * (10n ** BigInt(scale - b.scale));
    const sum = ai + bi;
    const sign = sum < 0n ? -1n : 1n;
    const int = sum < 0n ? -sum : sum;
    return { sign, int, scale };
  }
  function centsHalfUp(value) {
    const target = 2;
    let int = value.int;
    let scale = value.scale;
    if (scale < target) {
      int *= 10n ** BigInt(target - scale);
      scale = target;
    }
    const div = 10n ** BigInt(scale - target);
    const base = int / div;
    const rem = int % div;
    const rounded = rem * 2n >= div ? base + 1n : base;
    return value.sign < 0n ? -rounded : rounded;
  }
  function ref(input) {
    const labor = centsHalfUp(mul(mul(dec(input.hours), dec(input.workers)), dec(input.laborRate)));
    const drive = centsHalfUp(mul(mul(dec(input.driveTime), dec(input.workers)), dec(input.laborRate)));
    const materials = centsHalfUp(dec(input.materialCost));
    const fuel = centsHalfUp(dec(input.fuelCost));
    const direct = labor + drive + materials;
    const overhead = centsHalfUp(mul(dec(direct), mul(dec(input.overhead), { sign: 1n, int: 1n, scale: 2 })));
    // direct cents × overhead% / 100, which is mul by overhead/100.
    // dec(direct) has scale 0. overhead/100 = overhead with scale + 2.
    const total = direct + overhead + fuel;
    const price = input.margin === '0' || input.margin === '0.0' || Number(input.margin) === 0
      ? total
      : centsHalfUp(mul(dec(total), divPercent(input.margin)));
    const profit = price - total;
    const setAside = centsHalfUp(mul(mul(dec(profit), dec('0.9235')), dec('0.153')));
    return { labor, driveLabor: drive, materials, fuel, overhead, totalCost: total, price, profit, setAside };
  }
  function divPercent(marginStr) {
    // 100 / (100 − margin), as a decimal, so price cents = round(totalCents × that).
    const hundred = { sign: 1n, int: 100n, scale: 0 };
    const margin = dec(marginStr);
    const scale = Math.max(hundred.scale, margin.scale);
    const denom = hundred.int * (10n ** BigInt(scale - hundred.scale)) - margin.int * (10n ** BigInt(scale - margin.scale));
    // Represent 100 / denom with enough fractional digits, then the caller multiplies by total cents.
    // Easier: price = roundHalfUp(total * 100 / (100 - margin)).
    return { denom, scale };
  }
  function priceCents(total, marginStr) {
    if (Number(marginStr) === 0) return total;
    const margin = dec(marginStr);
    const scale = margin.scale;
    const denom = 100n * (10n ** BigInt(scale)) - margin.int;
    const numer = total * 100n * (10n ** BigInt(scale));
    const base = numer / denom;
    const rem = numer % denom;
    return rem * 2n >= denom ? base + 1n : base;
  }
  function overheadCents(direct, overheadStr) {
    const oh = dec(overheadStr);
    const numer = direct * oh.int;
    const denom = 100n * (10n ** BigInt(oh.scale));
    const base = numer / denom;
    const rem = numer % denom;
    return rem * 2n >= denom ? base + 1n : base;
  }

  let seed = 20261002;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function digits(lo, hi, places) {
    const scale = 10 ** places;
    const n = Math.floor(lo * scale + rnd() * ((hi - lo) * scale + 1));
    const clamped = Math.min(hi * scale, Math.max(lo * scale, n));
    const whole = Math.floor(clamped / scale);
    const frac = String(clamped % scale).padStart(places, '0');
    return places ? whole + '.' + frac : String(whole);
  }
  let mismatches = 0;
  const samples = [];
  const bands = [
    { count: 4000, margin: [0, 60] },
    { count: 2000, margin: [90, 94.99] }
  ];
  for (const band of bands) {
  for (let i = 0; i < band.count; i++) {
    const input = {
      hours: digits(0, 40, 2),
      workers: digits(1, 8, 0),
      laborRate: digits(0, 150, 2),
      materialCost: digits(0, 20000, 2),
      overhead: digits(0, 40, 2),
      driveTime: digits(0, 4, 2),
      fuelCost: digits(0, 80, 2),
      margin: digits(band.margin[0], band.margin[1], 2)
    };
    const got = P.priceJob({
      hours: Number(input.hours),
      workers: Number(input.workers),
      laborRate: Number(input.laborRate),
      materialCost: Number(input.materialCost),
      overhead: Number(input.overhead),
      driveTime: Number(input.driveTime),
      fuelCost: Number(input.fuelCost),
      margin: Number(input.margin)
    });
    const labor = centsHalfUp(mul(mul(dec(input.hours), dec(input.workers)), dec(input.laborRate)));
    const driveLabor = centsHalfUp(mul(mul(dec(input.driveTime), dec(input.workers)), dec(input.laborRate)));
    const materials = centsHalfUp(dec(input.materialCost));
    const fuel = centsHalfUp(dec(input.fuelCost));
    const direct = labor + driveLabor + materials;
    const overhead = overheadCents(direct, input.overhead);
    const totalCost = direct + overhead + fuel;
    let price = priceCents(totalCost, input.margin);
    if (totalCost > 0n && price >= 20n * totalCost) price = 20n * totalCost - 1n;
    const profit = price - totalCost;
    const setNumer = profit * 9235n * 153n;
    const setDenom = 10000000n;
    const setBase = setNumer / setDenom;
    const setRem = setNumer % setDenom;
    const setAside = setRem * 2n >= setDenom ? setBase + 1n : setBase;
    const expect = { labor, driveLabor, materials, fuel, overhead, totalCost, price, profit, setAside };
    const keys = Object.keys(expect);
    const bad = keys.filter((k) => got.cents[k] !== Number(expect[k]));
    if (!got.ok || bad.length) {
      mismatches += 1;
      if (samples.length < 5) samples.push({ input, bad, got: got.cents, expect });
    }
  }
  }
  assert.equal(mismatches, 0, JSON.stringify(samples));
});

test('high-margin prices match the exact half-up cent', () => {
  const a = P.priceJob(job({ materialCost: 3611.04, margin: 94.88 }));
  assert.equal(a.totalCost, 3611.04);
  assert.equal(a.price, 70528.13);
  const b = P.priceJob(job({ materialCost: 3886.84, margin: 93.6 }));
  assert.equal(b.totalCost, 3886.84);
  assert.equal(b.price, 60731.88);
});

test('margin inputs keep at most 2 decimal places, and the cap stays under 95%', () => {
  const furnace = {
    hours: '1.5', workers: '1', laborRate: '48', materialCost: '5.65',
    overhead: '25', driveTime: '0.5', fuelCost: '8.93', margin: '94.9999999'
  };
  const rejected = P.validateJob(furnace);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.messages.margin.level, 'error');
  assert.match(rejected.messages.margin.message, /2 decimal places/);

  const twoPlaces = P.validateJob(Object.assign({}, furnace, { margin: '94.99' }));
  assert.equal(twoPlaces.ok, true);

  function underCap(result) {
    assert.equal(result.ok, true);
    assert.ok(result.cents.price > 0);
    assert.ok((result.cents.price - result.cents.totalCost) / result.cents.price < 0.95);
    assert.notEqual(P.formatPercent(result.profit / result.price), '95.0%');
  }

  const direct = P.priceJob(job({
    hours: 1.5, workers: 1, laborRate: 48, materialCost: 5.65,
    overhead: 25, driveTime: 0.5, fuelCost: 8.93, margin: 94.9999999
  }));
  underCap(direct);
  assert.notEqual(direct.price, 2719.8);

  const twentyOne = P.priceJob(job({ fuelCost: 0.21, margin: 94.9986 }));
  assert.equal(twentyOne.totalCost, 0.21);
  underCap(twentyOne);
  assert.notEqual(twentyOne.price, 4.2);

  const penny = P.priceJob(job({ fuelCost: 0.01, margin: 94.99 }));
  assert.equal(penny.totalCost, 0.01);
  underCap(penny);
  assert.notEqual(penny.price, 0.2);
});

test('trailing zeros on a margin do not count as extra decimal places', () => {
  const base = {
    hours: '1', workers: '1', laborRate: '40', materialCost: '0',
    overhead: '0', driveTime: '0', fuelCost: '0'
  };
  const zeros = P.validateJob(Object.assign({}, base, { margin: '20.000' }));
  assert.equal(zeros.ok, true);
  assert.equal(zeros.messages.margin.level, 'ok');
  assert.equal(zeros.values.margin, 20);
  const trailingDot = P.validateJob(Object.assign({}, base, { margin: '20.' }));
  assert.equal(trailingDot.ok, true);
  assert.equal(trailingDot.messages.margin.level, 'ok');
  assert.equal(trailingDot.values.margin, 20);
  const extra = P.validateJob(Object.assign({}, base, { margin: '20.001' }));
  assert.equal(extra.ok, false);
  assert.match(extra.messages.margin.message, /2 decimal places/);
});

test('markup 25 adds profit after the margin and does not change overhead', () => {
  // Page defaults, markup 0: total cost $628.13, price $785.16, profit $157.03.
  // Materials at cost $200. Markup 25% = $50.00, added after the gross-up.
  // price = 785.16 + 50.00 = 835.16
  // profit = 157.03 + 50.00 = 207.03
  // overhead stays $80.63 (15% of direct cost, materials still at $200)
  const base = job({
    hours: 4, workers: 1, laborRate: 75, materialCost: 200,
    overhead: 15, driveTime: 0.5, fuelCost: 10, margin: 20
  });
  const zero = P.priceJob(base);
  const marked = P.priceJob(Object.assign({}, base, { materialMarkup: 25 }));
  assert.equal(zero.price, 785.16);
  assert.equal(marked.overhead, zero.overhead);
  assert.equal(marked.overhead, 80.63);
  assert.equal(marked.totalCost, zero.totalCost);
  assert.equal(marked.materials, 200);
  assert.equal(marked.markup, 50);
  assert.equal(marked.cents.price, zero.cents.price + marked.cents.markup);
  assert.equal(marked.price, 835.16);
  assert.equal(marked.profit, 207.03);
  assert.equal(marked.cents.quoteLabor, zero.cents.quoteLabor);
  assert.equal(marked.cents.quoteDrive, zero.cents.quoteDrive);
  assert.equal(marked.cents.quoteFuel, zero.cents.quoteFuel);
  assert.equal(marked.cents.quoteMaterials, zero.cents.quoteMaterials + marked.cents.markup);
  assert.equal(
    marked.cents.quoteLabor + marked.cents.quoteMaterials + marked.cents.quoteDrive + marked.cents.quoteFuel,
    marked.cents.price
  );
});

test('hand-checked markup: labor $300, materials $400, 15% overhead, $10 fuel, 20% margin, 25% markup', () => {
  // hours 4 x 1 x $75 = $300.00 labor. Drive time is 0.
  // materials at cost = $400.00
  // direct = 300 + 400 = $700.00
  // overhead = 15% x 700 = $105.00 exactly. Markup dollars are not in this base.
  // fuel = $10.00
  // total = 700 + 105 + 10 = $815.00
  // base price = 815 / (1 - 0.20) = 815 / 0.80 = $1,018.75
  // markup $ = 400 x 25 / 100 = $100.00
  // price = 1,018.75 + 100.00 = $1,118.75
  // profit = 1,118.75 - 815.00 = $303.75
  // effective margin = 303.75 / 1,118.75 = 27.1508...% which displays as 27.2%
  //
  // Customer quote (cents), margin profit allocated first, then the $100 markup on materials:
  // labor $431.25, materials $675.00, drive $0.00, fuel $12.50
  // 431.25 + 675.00 + 0.00 + 12.50 = 1,118.75
  const r = P.priceJob(job({
    hours: 4, workers: 1, laborRate: 75, materialCost: 400,
    overhead: 15, driveTime: 0, fuelCost: 10, margin: 20, materialMarkup: 25
  }));
  assert.equal(r.ok, true);
  assert.equal(r.labor, 300);
  assert.equal(r.materials, 400);
  assert.equal(r.directCost, 700);
  assert.equal(r.overhead, 105);
  assert.equal(r.fuel, 10);
  assert.equal(r.totalCost, 815);
  assert.equal(r.cents.basePrice, 101875);
  assert.equal(r.markup, 100);
  assert.equal(r.price, 1118.75);
  assert.equal(r.profit, 303.75);
  assert.equal(r.cents.profit, r.cents.price - r.cents.totalCost);
  assert.equal(r.quote.labor, 431.25);
  assert.equal(r.quote.materials, 675);
  assert.equal(r.quote.driveLabor, 0);
  assert.equal(r.quote.fuel, 12.5);
  assert.equal(r.cents.quoteLabor + r.cents.quoteMaterials + r.cents.quoteDrive + r.cents.quoteFuel, r.cents.price);
  assert.equal(P.formatPercent(r.profit / r.price), '27.2%');
  // SE set-aside follows the larger profit: round(30375 x 0.9235 x 0.153) = 4292 cents.
  assert.equal(r.setAside, 42.92);
});

test('material markup guards: blank, bad, and negative are 0; huge values clamp at 500%', () => {
  const base = {
    hours: 2, workers: 1, laborRate: 40, materialCost: 100,
    overhead: 10, driveTime: 0, fuelCost: 0, margin: 20
  };
  const clean = P.priceJob(job(base));
  // 100 x 500% = $500 markup. Overhead stays on the $100 cost.
  const capped = P.priceJob(job(Object.assign({}, base, { materialMarkup: 500 })));
  assert.equal(capped.markupPct, 500);
  assert.equal(capped.markup, 500);
  assert.equal(capped.overhead, clean.overhead);
  assert.equal(capped.cents.price, clean.cents.price + 50000);

  for (const raw of ['', '   ', 'abc', 'not-a-number', '25%', -5, '-3', null, undefined, NaN, false]) {
    const got = P.priceJob(job(Object.assign({}, base, { materialMarkup: raw })));
    assert.equal(got.ok, true, String(raw));
    assert.equal(got.markupPct, 0, String(raw));
    assert.equal(got.price, clean.price, String(raw));
    assert.equal(got.cents.quoteMaterials, clean.cents.quoteMaterials, String(raw));
  }

  for (const raw of [500.01, 1000, '9999', 1e6]) {
    const got = P.priceJob(job(Object.assign({}, base, { materialMarkup: raw })));
    assert.equal(got.markupPct, 500, String(raw));
    assert.equal(got.price, capped.price, String(raw));
    assert.equal(got.markup, capped.markup, String(raw));
  }
});

test('half-up markup cents stay on the materials quote line', () => {
  // materials $10.05 = 1005 cents. 10% = 100.5 cents, half up to 101 cents ($1.01).
  // margin 0, so the base price is the $10.05 cost.
  // price = 10.05 + 1.01 = $11.06
  // the whole $1.01 lands on the materials quote line.
  const r = P.priceJob(job({
    hours: 0, workers: 1, laborRate: 0, materialCost: 10.05,
    overhead: 0, driveTime: 0, fuelCost: 0, margin: 0, materialMarkup: 10
  }));
  assert.equal(r.materials, 10.05);
  assert.equal(r.cents.markup, 101);
  assert.equal(r.price, 11.06);
  assert.equal(r.quote.materials, 11.06);
  assert.equal(r.quote.labor, 0);
  assert.equal(r.quote.driveLabor, 0);
  assert.equal(r.quote.fuel, 0);
  assert.equal(r.cents.quoteLabor + r.cents.quoteMaterials + r.cents.quoteDrive + r.cents.quoteFuel, r.cents.price);
});

test('allocateCents ranks integer remainders and breaks ties toward the lower index', () => {
  // 33,330 cents over 39,647 / 59,531 / 812. Each remainder is 66,660,
  // so the two leftover cents belong to indexes 0 and 1.
  // Float fractions are .6667 but not equal, and the old sort handed
  // those cents to indexes 1 and 2: [13215, 19844, 271].
  assert.deepEqual(P.allocateCents(33330, [39647, 59531, 812]), [13216, 19844, 270]);

  // Equal weights. Leftover cents walk the lower indexes.
  assert.deepEqual(P.allocateCents(2, [1, 1, 1]), [1, 1, 0]);
  assert.deepEqual(P.allocateCents(4, [1, 1, 1]), [2, 1, 1]);
  assert.deepEqual(P.allocateCents(1, [1, 1, 1]), [1, 0, 0]);
  assert.deepEqual(P.allocateCents(5, [1, 1]), [3, 2]);

  // Unequal remainders: 10 * [1, 2, 3] / 6 leaves remainders 4, 2, 0.
  // The extra cent goes to index 0, the largest remainder.
  assert.deepEqual(P.allocateCents(10, [1, 2, 3]), [2, 3, 5]);

  assert.deepEqual(P.allocateCents(0, [1, 2, 3]), [0, 0, 0]);
  assert.deepEqual(P.allocateCents(8, [0, 0, 0]), [8, 0, 0]);

  function assertSplit(total, weights) {
    const parts = P.allocateCents(total, weights);
    assert.equal(parts.reduce((sum, n) => sum + n, 0), total);
    return parts;
  }

  // 3e9 * 4e9 = 1.2e19, past Number.MAX_SAFE_INTEGER, and it divides evenly.
  assert.deepEqual(
    assertSplit(3000000000, [4000000000, 4000000000, 2000000000]),
    [1200000000, 1200000000, 600000000]
  );

  // Odd total duplicated. The product does not fit in a safe integer,
  // both remainders match, and the leftover cent goes to index 0.
  const odd = 1000000000001;
  assert.deepEqual(assertSplit(odd, [odd, odd]), [500000000001, 500000000000]);

  // Three equal weights, two leftover cents, still on the BigInt path.
  assert.deepEqual(
    assertSplit(odd, [odd, odd, odd]),
    [333333333334, 333333333334, 333333333333]
  );
});

test('tied overhead at a 94.99% margin keeps the price and moves quote cents', () => {
  // labor 39,647 cents, drive 59,531, materials 812, overhead exactly 1/3.
  // Float tie-break quoted labor 1,055,130 and materials 21,617.
  // Integer ties quote labor 1,055,150 and materials 21,597.
  // Drive stays 1,584,331. The price stays 2,661,078.
  const r = P.priceJob(job({
    hours: 6.56,
    workers: 1,
    laborRate: 60.4375,
    materialCost: 8.12,
    overhead: 100 / 3,
    driveTime: 9.85,
    fuelCost: 0,
    margin: 94.99
  }));
  assert.equal(r.ok, true);
  assert.equal(r.cents.labor, 39647);
  assert.equal(r.cents.driveLabor, 59531);
  assert.equal(r.cents.materials, 812);
  assert.equal(r.cents.overhead, 33330);
  assert.equal(r.cents.price, 2661078);
  assert.equal(r.cents.profit, 2527758);
  assert.equal(r.cents.quoteLabor, 1055150);
  assert.equal(r.cents.quoteDrive, 1584331);
  assert.equal(r.cents.quoteMaterials, 21597);
  assert.equal(r.cents.quoteFuel, 0);
  assert.equal(
    r.cents.quoteLabor + r.cents.quoteDrive + r.cents.quoteMaterials + r.cents.quoteFuel,
    r.cents.price
  );
});

test('quote remainder cents are assigned to materials', () => {
  const up = { labor: 100, driveLabor: 40, materials: 200, fuel: 10 };
  P.settleQuoteRemainder(up, 353);
  assert.equal(up.materials, 203);
  assert.equal(up.labor, 100);
  assert.equal(up.driveLabor, 40);
  assert.equal(up.fuel, 10);
  assert.equal(up.labor + up.driveLabor + up.materials + up.fuel, 353);

  const down = { labor: 100, driveLabor: 40, materials: 200, fuel: 10 };
  P.settleQuoteRemainder(down, 349);
  assert.equal(down.materials, 199);
  assert.equal(down.labor + down.driveLabor + down.materials + down.fuel, 349);

  const exact = { labor: 10, driveLabor: 0, materials: 5, fuel: 0 };
  P.settleQuoteRemainder(exact, 15);
  assert.equal(exact.materials, 5);
});

test('marked-up quote lines sum to the price', () => {
  let seed = 20261003;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function pick(min, max, step) {
    const n = Math.round((min + rnd() * (max - min)) / step) * step;
    return Math.min(max, Math.max(min, Math.round(n * 1000) / 1000));
  }
  for (let i = 0; i < 80; i++) {
    const input = {
      hours: pick(0, 20, 0.25),
      workers: pick(1, 4, 1),
      laborRate: pick(0, 90, 0.5),
      materialCost: pick(0, 5000, 0.01),
      overhead: pick(0, 30, 0.5),
      driveTime: pick(0, 2, 0.25),
      fuelCost: pick(0, 40, 0.01),
      margin: pick(0, 40, 0.5),
      materialMarkup: pick(0, 80, 0.01)
    };
    const r = P.priceJob(input);
    const zero = P.priceJob(Object.assign({}, input, { materialMarkup: 0 }));
    assert.equal(r.ok, true, JSON.stringify(input));
    assert.equal(r.overhead, zero.overhead);
    assert.equal(r.totalCost, zero.totalCost);
    assert.equal(r.cents.price, zero.cents.price + r.cents.markup);
    assert.equal(r.cents.quoteLabor, zero.cents.quoteLabor);
    assert.equal(r.cents.quoteDrive, zero.cents.quoteDrive);
    assert.equal(r.cents.quoteFuel, zero.cents.quoteFuel);
    assert.equal(r.cents.quoteMaterials, zero.cents.quoteMaterials + r.cents.markup);
    assert.equal(
      r.cents.quoteLabor + r.cents.quoteMaterials + r.cents.quoteDrive + r.cents.quoteFuel,
      r.cents.price
    );
  }
});

test('coerceMarkup parses scientific notation and clamps', () => {
  assert.equal(P.coerceMarkup('1e3'), 500);
  assert.equal(P.coerceMarkup('abc'), 0);
  assert.equal(P.coerceMarkup('-5'), 0);
  assert.equal(P.coerceMarkup(''), 0);
  assert.equal(P.coerceMarkup('600'), 500);
  assert.equal(P.coerceMarkup('25'), 25);
  assert.equal(P.coerceMarkup('0x10'), 0);
  assert.equal(P.coerceMarkup('0b1'), 0);
  assert.equal(P.coerceMarkup('0o7'), 0);
  assert.equal(P.coerceMarkup('Infinity'), 0);
  assert.equal(P.coerceMarkup('-'), 0);
  assert.equal(P.coerceMarkup('.'), 0);
  assert.equal(P.coerceMarkup('1e'), 0);
});

test('material markup persists under jpc_materialMarkup_v2', () => {
  const fs = require('fs');
  const path = require('path');
  const mem = new Map();
  const storage = {
    getItem(key) { return mem.has(key) ? mem.get(key) : null; },
    setItem(key, value) { mem.set(key, String(value)); },
    removeItem(key) { mem.delete(key); }
  };
  assert.equal(P.MARKUP_STORAGE_KEY, 'jpc_materialMarkup_v2');
  assert.equal(P.readStoredMarkup(storage), null);
  P.writeStoredMarkup(storage, '25');
  assert.equal(storage.getItem('jpc_materialMarkup_v2'), '25');
  assert.equal(storage.getItem('jpc_materialMarkup'), null);
  assert.equal(P.readStoredMarkup(storage), '25');
  P.writeStoredMarkup(storage, '0');
  assert.equal(P.readStoredMarkup(storage), '0');

  const src = fs.readFileSync(path.join(__dirname, '../js/calculator.js'), 'utf8');
  assert.match(src, /writeStoredMarkup/);
  assert.match(src, /readStoredMarkup/);
  assert.match(src, /['"]jpc_materialMarkup['"]/);
  assert.doesNotMatch(src, /removeItem\(\s*['"]jpc_materialMarkup_v2['"]\s*\)/);
  assert.doesNotMatch(src, /jpc_qs_materialMarkup/);
  assert.doesNotMatch(src, /materialMarkup\/i/);
});
