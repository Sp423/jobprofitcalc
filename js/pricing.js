/* Pure pricing math for JobProfitCalc.
   Runs in the browser (global JobPricing) and in Node (module.exports).
   No build step.

   Formula (matches the worked examples the pricing posts teach):
     labor        = roundCents(hours × workers × rate)
     driveLabor   = roundCents(driveHours × workers × rate)
     materials    = roundCents(material cost)          // at cost
     directCost   = labor + driveLabor + materials     // overhead base; fuel is NOT in it
     overhead     = roundCents(directCost × overhead%) // markup dollars are not in this base
     fuel         = roundCents(fuel)                   // added after overhead
     totalCost    = directCost + overhead + fuel
     basePrice    = roundCents(totalCost × 100 / (100 − margin))
     markup       = roundCents(materials × markup% / 100)
     price        = basePrice + markup                 // markup is profit, not grossed up again
     profit       = price − totalCost
   The (100 − margin) denominator is cleaned with toPrecision(12) before dividing,
   so a binary float does not leave the base price 1 cent low.
   If that rounded base price would make (basePrice − totalCost) / basePrice ≥ 95%,
   the base price steps down to the largest cent amount with margin under 95%.
   That cap clamp is the only exception to basePrice = cost / (1 − margin), to the cent.
   Markup is added after the clamp. Blank, non-numeric, or negative markup counts as 0.
   A markup above 500% is clamped to 500%. At 0%, price, profit, quote lines, and the
   SE set-aside match the no-markup formula to the cent.
   No self-employment tax and no state income tax in the cost or the price.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.JobPricing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // IRS self-employment tax on net earnings: 92.35% × 15.3%.
  // https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes
  // Informational set-aside only. Not an income-tax rate. Not added to the price.
  var SE_NET_FACTOR = 0.9235;
  var SE_RATE = 0.153;

  // Hard cap is exclusive: margin must be under 95%. Warning above 60%.
  var MARGIN_CAP = 95;
  var MARGIN_WARN = 60;
  // Material markup is optional profit on top of the margin. 500% is the ceiling.
  var MARKUP_MAX = 500;
  var MARKUP_STORAGE_KEY = 'jpc_materialMarkup';

  var LIMITS = {
    hours:          { min: 0, max: 1000,    label: 'Estimated hours' },
    workers:        { min: 1, max: 100, integer: true, label: 'Number of workers' },
    laborRate:      { min: 0, max: 1000,    label: 'Hourly labor rate' },
    materialCost:   { min: 0, max: 5000000, label: 'Material cost' },
    overhead:       { min: 0, max: 100,     label: 'Overhead' },
    driveTime:      { min: 0, max: 100,     label: 'Drive time' },
    fuelCost:       { min: 0, max: 50000,   label: 'Fuel' },
    margin:         { min: 0, max: MARGIN_CAP, exclusiveMax: true, maxDecimals: 2, warnAbove: MARGIN_WARN, label: 'Desired profit margin' },
    salesTaxRate:   { min: 0, max: 20,      label: 'Sales tax' }
  };

  /* Trade labor rates are example loaded costs, not billing rates.
     Median hourly wage: BLS OEWS May 2025, Table 1 of the May 15, 2026
     news release (https://www.bls.gov/news.release/archives/ocwage_05152026.htm).
     Burden: BLS ECEC, private industry, construction, June 2026, Table 4 of the
     September 9, 2026 release
     (https://www.bls.gov/news.release/archives/ecec_09092026.htm):
     total compensation $51.96 / wages and salaries $36.13.
     Loaded default = round(median × 51.96 / 36.13).
     Hours, materials, overhead, drive, and fuel below are example
     job shapes carried forward — replace them. */
  var OEWS_URL = 'https://www.bls.gov/news.release/archives/ocwage_05152026.htm';
  var ECEC_URL = 'https://www.bls.gov/news.release/archives/ecec_09092026.htm';
  var BURDEN = 51.96 / 36.13;
  function loaded(median) { return Math.round(median * BURDEN); }

  var TRADE_DEFAULTS = {
    plumber:     { hours: 3,  workers: 1, laborRate: loaded(30.67), medianWage: 30.67, soc: '47-2152', materialCost: 150, overhead: 18, driveTime: 0.5, fuelCost: 10 },
    electrician: { hours: 4,  workers: 1, laborRate: loaded(30.38), medianWage: 30.38, soc: '47-2111', materialCost: 200, overhead: 18, driveTime: 0.5, fuelCost: 10 },
    hvac:        { hours: 4,  workers: 2, laborRate: loaded(29.33), medianWage: 29.33, soc: '49-9021', materialCost: 350, overhead: 20, driveTime: 1.0, fuelCost: 15 },
    roofer:      { hours: 8,  workers: 3, laborRate: loaded(26.65), medianWage: 26.65, soc: '47-2181', materialCost: 800, overhead: 22, driveTime: 1.0, fuelCost: 20 },
    painter_int: { hours: 6,  workers: 2, laborRate: loaded(23.75), medianWage: 23.75, soc: '47-2141', materialCost: 120, overhead: 15, driveTime: 0.5, fuelCost: 10 },
    painter_ext: { hours: 10, workers: 2, laborRate: loaded(23.75), medianWage: 23.75, soc: '47-2141', materialCost: 250, overhead: 15, driveTime: 1.0, fuelCost: 15 },
    landscaper:  { hours: 5,  workers: 2, laborRate: loaded(18.82), medianWage: 18.82, soc: '37-3011', materialCost: 100, overhead: 15, driveTime: 1.0, fuelCost: 20 },
    // First-line supervisors of construction trades (47-1011), median $38.42 — a field crew cost, not the salaried construction-manager occupation.
    gc:          { hours: 8,  workers: 2, laborRate: loaded(38.42), medianWage: 38.42, soc: '47-1011', materialCost: 500, overhead: 20, driveTime: 1.0, fuelCost: 20 },
    carpenter:   { hours: 6,  workers: 1, laborRate: loaded(29.12), medianWage: 29.12, soc: '47-2031', materialCost: 200, overhead: 15, driveTime: 0.5, fuelCost: 10 },
    flooring:    { hours: 6,  workers: 2, laborRate: loaded(27.15), medianWage: 27.15, soc: '47-2042', materialCost: 400, overhead: 15, driveTime: 0.5, fuelCost: 10 },
    concrete:    { hours: 8,  workers: 2, laborRate: loaded(27.41), medianWage: 27.41, soc: '47-2051', materialCost: 300, overhead: 20, driveTime: 1.0, fuelCost: 20 },
    drywall:     { hours: 6,  workers: 2, laborRate: loaded(28.33), medianWage: 28.33, soc: '47-2081', materialCost: 150, overhead: 15, driveTime: 0.5, fuelCost: 10 },
    // No OEWS "handyman" occupation. Proxy: Maintenance and Repair Workers, General (49-9071), median $23.84.
    handyman:    { hours: 2,  workers: 1, laborRate: loaded(23.84), medianWage: 23.84, soc: '49-9071', materialCost: 50,  overhead: 15, driveTime: 0.5, fuelCost: 10 }
  };

  // Blank-form values in the HTML. $75 is a placeholder, not a BLS figure.
  var PAGE_DEFAULTS = {
    hours: 4, workers: 1, laborRate: 75, materialCost: 200,
    overhead: 15, driveTime: 0.5, fuelCost: 10, margin: 20
  };

  // Round half up in cents. toPrecision(15) keeps a true .5 from falling to .4999… in binary floats.
  function rc(x) {
    return Math.round(Number(x.toPrecision(15)));
  }

  function roundCentsFromDollars(dollars) {
    if (!Number.isFinite(dollars)) return null;
    return rc(dollars * 100);
  }

  function fromCents(cents) {
    return cents / 100;
  }

  // Blank, non-numeric, or negative markup is 0. Values above 500% clamp to 500%.
  function coerceMarkup(raw) {
    if (raw == null || typeof raw === 'boolean') return 0;
    var n;
    if (typeof raw === 'number') {
      n = raw;
    } else {
      var s = String(raw).trim();
      if (s === '') return 0;
      if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(s)) return 0;
      n = Number(s);
    }
    if (!Number.isFinite(n) || n < 0) return 0;
    if (n > MARKUP_MAX) return MARKUP_MAX;
    return n;
  }

  // Any cent gap between the quote lines and the price goes to materials.
  // Ties are not spread: the markup lives on that line, so the remainder does too.
  function settleQuoteRemainder(lines, priceCents) {
    var sum = lines.labor + lines.driveLabor + lines.materials + lines.fuel;
    var gap = priceCents - sum;
    if (gap !== 0) lines.materials += gap;
    return lines;
  }

  function readStoredMarkup(storage) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    try {
      var value = storage.getItem(MARKUP_STORAGE_KEY);
      return value == null ? null : String(value);
    } catch (e) {
      return null;
    }
  }

  function writeStoredMarkup(storage, value) {
    if (!storage || typeof storage.setItem !== 'function') return;
    try {
      storage.setItem(MARKUP_STORAGE_KEY, value == null ? '' : String(value));
    } catch (e) { /* private mode */ }
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
    var pct = ratio * 100;
    var shown = Number(pct.toFixed(1));
    // 94.9999 must not display as 95.0%. Ordinary 19.999…% still shows as 20.0%.
    if (shown >= 95 && pct < 95) {
      var floored = Math.floor(pct * 10 + 1e-9) / 10;
      return floored.toFixed(1) + '%';
    }
    return pct.toFixed(1) + '%';
  }

  function priceJob(input) {
    var hours = +input.hours;
    var workers = +input.workers;
    var laborRate = +input.laborRate;
    var materialCost = +input.materialCost;
    var overheadPct = +input.overhead;
    var driveTime = +input.driveTime;
    var fuelCost = +input.fuelCost;
    var marginPct = +input.margin;
    var salesTaxPct = input.salesTaxRate == null ? 0 : +input.salesTaxRate;

    var nums = [hours, workers, laborRate, materialCost, overheadPct, driveTime, fuelCost, marginPct, salesTaxPct];
    var i;
    for (i = 0; i < nums.length; i++) {
      if (!Number.isFinite(nums[i])) return { ok: false, error: 'Invalid input.' };
    }
    if (hours < 0 || workers < 1 || workers % 1 !== 0 || laborRate < 0 || materialCost < 0 ||
        overheadPct < 0 || driveTime < 0 || fuelCost < 0 || marginPct < 0 || salesTaxPct < 0 ||
        marginPct >= MARGIN_CAP || overheadPct > 100) {
      return { ok: false, error: 'Invalid input.' };
    }

    var labor = roundCentsFromDollars(hours * workers * laborRate);
    var driveLabor = roundCentsFromDollars(driveTime * workers * laborRate);
    var materials = roundCentsFromDollars(materialCost);
    var fuel = roundCentsFromDollars(fuelCost);
    var markupPct = coerceMarkup(input.materialMarkup);
    // Percent of the at-cost materials, in cents. Overhead is not charged on this.
    var markup = rc(materials * markupPct / 100);
    var direct = labor + driveLabor + materials;
    var overhead = rc(direct * overheadPct / 100);
    var totalCost = direct + overhead + fuel;
    var basePrice = rc(totalCost * 100 / Number((100 - marginPct).toPrecision(12)));
    // Rounded base price can land on exactly 95% (basePrice === 20 × cost). Stay under the cap.
    if (totalCost > 0 && basePrice >= totalCost * 20) basePrice = totalCost * 20 - 1;
    if (basePrice < 0 || totalCost < 0) return { ok: false, error: 'Invalid input.' };
    var price = basePrice + markup;
    var baseProfit = basePrice - totalCost;
    var profit = price - totalCost;

    var ohParts = allocateCents(overhead, [labor, driveLabor, materials]);
    var laborWithOh = labor + ohParts[0];
    var driveWithOh = driveLabor + ohParts[1];
    var matWithOh = materials + ohParts[2];
    // Spread only the margin profit. Markup is added to materials afterward.
    var profitParts = allocateCents(baseProfit, [laborWithOh, driveWithOh, matWithOh, fuel]);
    var quote = {
      labor: laborWithOh + profitParts[0],
      driveLabor: driveWithOh + profitParts[1],
      materials: matWithOh + profitParts[2] + markup,
      fuel: fuel + profitParts[3]
    };
    settleQuoteRemainder(quote, price);

    var salesTax = rc(quote.materials * salesTaxPct / 100);
    var customerTotal = price + salesTax;
    var laborHours = hours * workers;
    var setAside = rc(profit * SE_NET_FACTOR * SE_RATE);

    return {
      ok: true,
      labor: fromCents(labor),
      driveLabor: fromCents(driveLabor),
      fuel: fromCents(fuel),
      materials: fromCents(materials),
      markup: fromCents(markup),
      markupPct: markupPct,
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
        basePrice: basePrice,
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
    if (spec.integer && Math.floor(n) !== n) {
      return { level: 'error', message: 'Enter a whole number.' };
    }
    if (spec.maxDecimals != null) {
      var counted = s;
      if (counted.indexOf('.') !== -1) counted = counted.replace(/0+$/, '').replace(/\.$/, '');
      var dot = counted.indexOf('.');
      var places = dot === -1 ? 0 : counted.length - dot - 1;
      if (places > spec.maxDecimals) {
        return { level: 'error', message: 'Use at most ' + spec.maxDecimals + ' decimal places.' };
      }
    }
    if (spec.exclusiveMax ? n >= spec.max : n > spec.max) {
      if (spec.exclusiveMax) return { level: 'error', message: 'Margin must be under ' + spec.max + '%.' };
      return { level: 'error', message: 'Maximum is ' + spec.max.toLocaleString('en-US') + '.' };
    }
    if (spec.warnAbove != null && n > spec.warnAbove) {
      return { level: 'warn', message: 'Margins above ' + spec.warnAbove + '% are unusual. Check that this is the share of the price you want to keep.', value: n };
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
    var keys = ['hours', 'workers', 'laborRate', 'materialCost', 'overhead', 'driveTime', 'fuelCost', 'margin'];
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
    rc: rc,
    formatDollars: formatDollars,
    formatPercent: formatPercent,
    fromCents: fromCents,
    LIMITS: LIMITS,
    MARGIN_CAP: MARGIN_CAP,
    MARGIN_WARN: MARGIN_WARN,
    MARKUP_MAX: MARKUP_MAX,
    MARKUP_STORAGE_KEY: MARKUP_STORAGE_KEY,
    coerceMarkup: coerceMarkup,
    settleQuoteRemainder: settleQuoteRemainder,
    readStoredMarkup: readStoredMarkup,
    writeStoredMarkup: writeStoredMarkup,
    TRADE_DEFAULTS: TRADE_DEFAULTS,
    PAGE_DEFAULTS: PAGE_DEFAULTS,
    SE_NET_FACTOR: SE_NET_FACTOR,
    SE_RATE: SE_RATE,
    BURDEN: BURDEN,
    OEWS_URL: OEWS_URL,
    ECEC_URL: ECEC_URL
  };
});
