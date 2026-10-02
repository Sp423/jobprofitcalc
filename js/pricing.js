/* Pure pricing math for JobProfitCalc.
   Runs in the browser (global JobPricing) and in Node (module.exports).
   No build step.

   Formula (matches the worked examples the pricing posts teach):
     labor        = roundCents(hours × workers × rate)
     driveLabor   = roundCents(driveHours × workers × rate)
     materials    = roundCents(material cost)          // at cost
     directCost   = labor + driveLabor + materials     // overhead base; fuel is NOT in it
     overhead     = roundCents(directCost × overhead%)
     fuel         = roundCents(fuel)                   // added after overhead
     totalCost    = directCost + overhead + fuel
     price        = roundCents(totalCost / (1 − margin))
   No self-employment tax and no state income tax in the cost or the price.

   Material markup is reported only. It is not a cost and it is not added
   on top of the margin (that would charge profit twice).
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.JobPricing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // IRS self-employment tax on net earnings: 92.35% × 15.3%.
  // https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax
  // Informational set-aside only. Not an income-tax rate. Not added to the price.
  var SE_NET_FACTOR = 0.9235;
  var SE_RATE = 0.153;

  // Hard cap is exclusive: margin must be under 95%. Warning above 60%.
  var MARGIN_CAP = 95;
  var MARGIN_WARN = 60;

  var LIMITS = {
    hours:          { min: 0, max: 1000,    label: 'Estimated hours' },
    workers:        { min: 1, max: 100,     label: 'Number of workers' },
    laborRate:      { min: 0, max: 1000,    label: 'Hourly labor rate' },
    materialCost:   { min: 0, max: 5000000, label: 'Material cost' },
    materialMarkup: { min: 0, max: 200,     label: 'Material markup' },
    overhead:       { min: 0, max: 100,     label: 'Overhead' },
    driveTime:      { min: 0, max: 100,     label: 'Drive time' },
    fuelCost:       { min: 0, max: 50000,   label: 'Fuel' },
    margin:         { min: 0, max: MARGIN_CAP, exclusiveMax: true, warnAbove: MARGIN_WARN, label: 'Desired profit margin' },
    salesTaxRate:   { min: 0, max: 20,      label: 'Sales tax' }
  };

  /* Trade labor rates are example loaded costs, not billing rates.
     Median hourly wage: BLS OEWS May 2024, Table 1 of the April 2, 2025
     news release (https://www.bls.gov/news.release/archives/ocwage_04022025.htm).
     Burden: BLS ECEC, construction industry, September 2024
     (https://www.bls.gov/news.release/archives/ecec_12172024.htm):
     total compensation $47.54 / wages and salaries $33.14.
     Loaded default = round(median × 47.54 / 33.14).
     Hours, materials, markup, overhead, drive, and fuel below are example
     job shapes carried forward — replace them. */
  var BURDEN = 47.54 / 33.14;
  function loaded(median) { return Math.round(median * BURDEN); }

  var TRADE_DEFAULTS = {
    plumber:     { hours: 3,  workers: 1, laborRate: loaded(30.27), materialCost: 150, materialMarkup: 25, overhead: 18, driveTime: 0.5, fuelCost: 10 },
    electrician: { hours: 4,  workers: 1, laborRate: loaded(29.98), materialCost: 200, materialMarkup: 20, overhead: 18, driveTime: 0.5, fuelCost: 10 },
    hvac:        { hours: 4,  workers: 2, laborRate: loaded(28.75), materialCost: 350, materialMarkup: 20, overhead: 20, driveTime: 1.0, fuelCost: 15 },
    roofer:      { hours: 8,  workers: 3, laborRate: loaded(24.51), materialCost: 800, materialMarkup: 15, overhead: 22, driveTime: 1.0, fuelCost: 20 },
    painter_int: { hours: 6,  workers: 2, laborRate: loaded(23.40), materialCost: 120, materialMarkup: 20, overhead: 15, driveTime: 0.5, fuelCost: 10 },
    painter_ext: { hours: 10, workers: 2, laborRate: loaded(23.40), materialCost: 250, materialMarkup: 20, overhead: 15, driveTime: 1.0, fuelCost: 15 },
    landscaper:  { hours: 5,  workers: 2, laborRate: loaded(18.31), materialCost: 100, materialMarkup: 20, overhead: 15, driveTime: 1.0, fuelCost: 20 },
    // First-line supervisors of construction trades (47-1011), median $37.83 — a field crew cost, not the salaried construction-manager occupation.
    gc:          { hours: 8,  workers: 2, laborRate: loaded(37.83), materialCost: 500, materialMarkup: 15, overhead: 20, driveTime: 1.0, fuelCost: 20 },
    carpenter:   { hours: 6,  workers: 1, laborRate: loaded(28.51), materialCost: 200, materialMarkup: 20, overhead: 15, driveTime: 0.5, fuelCost: 10 },
    flooring:    { hours: 6,  workers: 2, laborRate: loaded(26.13), materialCost: 400, materialMarkup: 15, overhead: 15, driveTime: 0.5, fuelCost: 10 },
    concrete:    { hours: 8,  workers: 2, laborRate: loaded(26.28), materialCost: 300, materialMarkup: 15, overhead: 20, driveTime: 1.0, fuelCost: 20 },
    drywall:     { hours: 6,  workers: 2, laborRate: loaded(27.95), materialCost: 150, materialMarkup: 20, overhead: 15, driveTime: 0.5, fuelCost: 10 },
    // No OEWS "handyman" occupation. Proxy: Maintenance and Repair Workers, General (49-9071), median $23.38.
    handyman:    { hours: 2,  workers: 1, laborRate: loaded(23.38), materialCost: 50,  materialMarkup: 20, overhead: 15, driveTime: 0.5, fuelCost: 10 }
  };

  // Blank-form values in the HTML. $75 is a placeholder, not a BLS figure.
  var PAGE_DEFAULTS = {
    hours: 4, workers: 1, laborRate: 75, materialCost: 200, materialMarkup: 20,
    overhead: 15, driveTime: 0.5, fuelCost: 10, margin: 20
  };

  function roundCentsFromDollars(dollars) {
    if (!Number.isFinite(dollars)) return null;
    return Math.round(dollars * 100);
  }

  function fromCents(cents) {
    return cents / 100;
  }

  // Single rounding helper. `cents` in, or dollars via roundCents.
  function roundCents(dollars) {
    var c = roundCentsFromDollars(dollars);
    return c == null ? NaN : fromCents(c);
  }

  // Split `total` cents across weights. Largest fractional remainder first.
  // Ties go to the lower index so the split is deterministic.
  function allocateCents(total, weights) {
    var n = weights.length;
    var out = [];
    var i;
    for (i = 0; i < n; i++) out.push(0);
    if (!total) return out;
    var sum = 0;
    for (i = 0; i < n; i++) sum += weights[i];
    if (sum <= 0) {
      out[0] = total;
      return out;
    }
    var exact = [];
    var baseSum = 0;
    for (i = 0; i < n; i++) {
      exact.push((total * weights[i]) / sum);
      out[i] = Math.floor(exact[i]);
      baseSum += out[i];
    }
    var left = total - baseSum;
    var order = exact.map(function (x, idx) {
      return { i: idx, frac: x - Math.floor(x) };
    });
    order.sort(function (a, b) {
      if (b.frac !== a.frac) return b.frac - a.frac;
      return a.i - b.i;
    });
    for (i = 0; i < left; i++) out[order[i].i] += 1;
    return out;
  }

  function formatDollars(cents, decimals) {
    if (!Number.isFinite(cents)) return '$0.00';
    var dec = decimals == null ? 2 : decimals;
    var neg = cents < 0;
    var abs = Math.abs(cents) / 100;
    var fixed = abs.toFixed(dec);
    var parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-$' : '$') + parts.join('.');
  }

  function formatPercent(ratio) {
    if (!Number.isFinite(ratio)) return '0.0%';
    return (ratio * 100).toFixed(1) + '%';
  }

  function priceJob(input) {
    var hours = +input.hours;
    var workers = +input.workers;
    var laborRate = +input.laborRate;
    var materialCost = +input.materialCost;
    var materialMarkup = +input.materialMarkup;
    var overheadPct = +input.overhead;
    var driveTime = +input.driveTime;
    var fuelCost = +input.fuelCost;
    var marginPct = +input.margin;
    var salesTaxPct = input.salesTaxRate == null ? 0 : +input.salesTaxRate;

    var nums = [hours, workers, laborRate, materialCost, materialMarkup, overheadPct, driveTime, fuelCost, marginPct, salesTaxPct];
    var i;
    for (i = 0; i < nums.length; i++) {
      if (!Number.isFinite(nums[i])) return { ok: false, error: 'Invalid input.' };
    }
    if (hours < 0 || workers < 1 || laborRate < 0 || materialCost < 0 || materialMarkup < 0 ||
        overheadPct < 0 || driveTime < 0 || fuelCost < 0 || marginPct < 0 || salesTaxPct < 0 ||
        marginPct >= MARGIN_CAP || overheadPct > 100 || materialMarkup > 200) {
      return { ok: false, error: 'Invalid input.' };
    }

    var labor = roundCentsFromDollars(hours * workers * laborRate);
    var driveLabor = roundCentsFromDollars(driveTime * workers * laborRate);
    var materials = roundCentsFromDollars(materialCost);
    var fuel = roundCentsFromDollars(fuelCost);
    var markup = roundCentsFromDollars(fromCents(materials) * (materialMarkup / 100));
    var direct = labor + driveLabor + materials;
    var overhead = Math.round(direct * (overheadPct / 100));
    var totalCost = direct + overhead + fuel;
    var margin = marginPct / 100;
    var price = margin === 0 ? totalCost : Math.round(totalCost / (1 - margin));
    if (price < 0 || totalCost < 0) return { ok: false, error: 'Invalid input.' };
    var profit = price - totalCost;

    var ohParts = allocateCents(overhead, [labor, driveLabor, materials]);
    var laborWithOh = labor + ohParts[0];
    var driveWithOh = driveLabor + ohParts[1];
    var matWithOh = materials + ohParts[2];
    var profitParts = allocateCents(profit, [laborWithOh, driveWithOh, matWithOh, fuel]);
    var quote = {
      labor: laborWithOh + profitParts[0],
      driveLabor: driveWithOh + profitParts[1],
      materials: matWithOh + profitParts[2],
      fuel: fuel + profitParts[3]
    };

    var salesTax = Math.round(quote.materials * (salesTaxPct / 100));
    var customerTotal = price + salesTax;
    var laborHours = hours * workers;
    var setAside = Math.round(profit * SE_NET_FACTOR * SE_RATE);

    return {
      ok: true,
      labor: fromCents(labor),
      driveLabor: fromCents(driveLabor),
      fuel: fromCents(fuel),
      materials: fromCents(materials),
      markup: fromCents(markup),
      directCost: fromCents(direct),
      overhead: fromCents(overhead),
      totalCost: fromCents(totalCost),
      price: fromCents(price),
      profit: fromCents(profit),
      marginPct: price > 0 ? (profit / price) * 100 : 0,
      profitPerLaborHour: laborHours > 0 ? fromCents(profit) / laborHours : null,
      laborHours: laborHours,
      setAside: fromCents(setAside),
      seTax: 0,
      stateTax: 0,
      taxes: 0,
      salesTax: fromCents(salesTax),
      customerTotal: fromCents(customerTotal),
      quote: {
        labor: fromCents(quote.labor),
        materials: fromCents(quote.materials),
        driveLabor: fromCents(quote.driveLabor),
        fuel: fromCents(quote.fuel)
      },
      cents: {
        labor: labor,
        driveLabor: driveLabor,
        fuel: fuel,
        materials: materials,
        markup: markup,
        directCost: direct,
        overhead: overhead,
        totalCost: totalCost,
        price: price,
        profit: profit,
        setAside: setAside,
        salesTax: salesTax,
        customerTotal: customerTotal,
        quoteLabor: quote.labor,
        quoteMaterials: quote.materials,
        quoteDrive: quote.driveLabor,
        quoteFuel: quote.fuel
      }
    };
  }

  function classifyRaw(raw, spec) {
    if (raw == null) return { level: 'error', message: 'Enter a number.' };
    var s = typeof raw === 'number' ? String(raw) : String(raw).trim();
    if (s === '') return { level: 'error', message: 'Enter a number.' };
    if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(s)) return { level: 'error', message: 'Enter a number.' };
    var n = Number(s);
    if (!Number.isFinite(n)) return { level: 'error', message: 'Enter a number.' };
    if (n < 0) return { level: 'error', message: "Can't be negative." };
    if (n < spec.min) {
      return { level: 'error', message: spec.min === 1 ? 'Enter at least 1.' : 'Minimum is ' + spec.min + '.' };
    }
    if (spec.exclusiveMax ? n >= spec.max : n > spec.max) {
      if (spec.exclusiveMax) return { level: 'error', message: 'Margin must be under ' + spec.max + '%.' };
      return { level: 'error', message: 'Maximum is ' + spec.max.toLocaleString('en-US') + '.' };
    }
    if (spec.warnAbove != null && n > spec.warnAbove) {
      return { level: 'warn', message: 'Margins above ' + spec.warnAbove + '% are unusual. Check that this is margin, not markup.', value: n };
    }
    if (n === 0 && spec.min === 0) {
      var zeroMsg = spec.warnAbove != null
        ? 'Zero margin prices the job at cost.'
        : 'Zero — this adds nothing.';
      return { level: 'info', message: zeroMsg, value: n };
    }
    return { level: 'ok', message: '', value: n };
  }

  function validateJob(raw) {
    var keys = ['hours', 'workers', 'laborRate', 'materialCost', 'materialMarkup', 'overhead', 'driveTime', 'fuelCost', 'margin'];
    if (Object.prototype.hasOwnProperty.call(raw, 'salesTaxRate')) keys.push('salesTaxRate');
    var messages = {};
    var values = {};
    var ok = true;
    keys.forEach(function (key) {
      var spec = LIMITS[key];
      var result = classifyRaw(raw[key], spec);
      messages[key] = result;
      if (result.level === 'error') ok = false;
      else values[key] = result.value;
    });
    if (values.salesTaxRate == null) values.salesTaxRate = 0;
    return { ok: ok, messages: messages, values: values };
  }

  return {
    priceJob: priceJob,
    validateJob: validateJob,
    classifyRaw: classifyRaw,
    allocateCents: allocateCents,
    roundCents: roundCents,
    formatDollars: formatDollars,
    formatPercent: formatPercent,
    fromCents: fromCents,
    LIMITS: LIMITS,
    MARGIN_CAP: MARGIN_CAP,
    MARGIN_WARN: MARGIN_WARN,
    TRADE_DEFAULTS: TRADE_DEFAULTS,
    PAGE_DEFAULTS: PAGE_DEFAULTS,
    SE_NET_FACTOR: SE_NET_FACTOR,
    SE_RATE: SE_RATE,
    BURDEN: BURDEN
  };
});
