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
  const expectedPrice = marginPct === 0
    ? result.cents.totalCost
    : Math.round(Number((result.cents.totalCost * 100 / (100 - marginPct)).toPrecision(15)));
  assert.equal(result.cents.price, expectedPrice);
  assert.ok(Math.abs(result.price - result.totalCost / (1 - marginPct / 100)) <= 0.01);
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

test('a leftover material markup value does not change the price', () => {
  const clean = P.priceJob(job({ hours: 2, workers: 1, laborRate: 40, materialCost: 100, overhead: 10, margin: 20 }));
  const stale = P.priceJob(job({
    hours: 2, workers: 1, laborRate: 40, materialCost: 100, overhead: 10, margin: 20,
    materialMarkup: 'not-a-number'
  }));
  assert.equal(stale.ok, true);
  assert.equal(stale.price, clean.price);
  assert.equal(stale.totalCost, clean.totalCost);
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
  for (let i = 0; i < 4000; i++) {
    const input = {
      hours: digits(0, 40, 2),
      workers: digits(1, 8, 0),
      laborRate: digits(0, 150, 2),
      materialCost: digits(0, 20000, 2),
      overhead: digits(0, 40, 2),
      driveTime: digits(0, 4, 2),
      fuelCost: digits(0, 80, 2),
      margin: digits(0, 60, 2)
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
    const price = priceCents(totalCost, input.margin);
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
  assert.equal(mismatches, 0, JSON.stringify(samples));
});
