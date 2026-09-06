/* ============================================================
   TRADE DEFAULTS
   Hours | Workers | LaborRate | MaterialCost | MatMarkup% | Overhead% | DriveTime | FuelCost
============================================================ */
const DEFAULTS = {
  plumber:     { hours:3,  workers:1, laborRate:85,  materialCost:150, materialMarkup:25, overhead:18, driveTime:0.5, fuelCost:10 },
  electrician: { hours:4,  workers:1, laborRate:90,  materialCost:200, materialMarkup:20, overhead:18, driveTime:0.5, fuelCost:10 },
  hvac:        { hours:4,  workers:2, laborRate:85,  materialCost:350, materialMarkup:20, overhead:20, driveTime:1.0, fuelCost:15 },
  roofer:      { hours:8,  workers:3, laborRate:65,  materialCost:800, materialMarkup:15, overhead:22, driveTime:1.0, fuelCost:20 },
  painter_int: { hours:6,  workers:2, laborRate:55,  materialCost:120, materialMarkup:20, overhead:15, driveTime:0.5, fuelCost:10 },
  painter_ext: { hours:10, workers:2, laborRate:55,  materialCost:250, materialMarkup:20, overhead:15, driveTime:1.0, fuelCost:15 },
  landscaper:  { hours:5,  workers:2, laborRate:45,  materialCost:100, materialMarkup:20, overhead:15, driveTime:1.0, fuelCost:20 },
  gc:          { hours:8,  workers:2, laborRate:75,  materialCost:500, materialMarkup:15, overhead:20, driveTime:1.0, fuelCost:20 },
  carpenter:   { hours:6,  workers:1, laborRate:70,  materialCost:200, materialMarkup:20, overhead:15, driveTime:0.5, fuelCost:10 },
  flooring:    { hours:6,  workers:2, laborRate:60,  materialCost:400, materialMarkup:15, overhead:15, driveTime:0.5, fuelCost:10 },
  concrete:    { hours:8,  workers:2, laborRate:65,  materialCost:300, materialMarkup:15, overhead:20, driveTime:1.0, fuelCost:20 },
  drywall:     { hours:6,  workers:2, laborRate:55,  materialCost:150, materialMarkup:20, overhead:15, driveTime:0.5, fuelCost:10 },
  handyman:    { hours:2,  workers:1, laborRate:60,  materialCost:50,  materialMarkup:20, overhead:15, driveTime:0.5, fuelCost:10 },
};

/* ============================================================
   GET ELEMENTS
============================================================ */
const G = id => document.getElementById(id);
const $ = {
  trade:    G('tradeSelect'),
  jobLabel: G('jobLabel'),
  hours:    G('hours'),
  workers:  G('workers'),
  labor:    G('laborRate'),
  matCost:  G('materialCost'),
  matMark:  G('materialMarkup'),
  overhead: G('overhead'),
  drive:    G('driveTime'),
  fuel:     G('fuelCost'),
  profit:   G('profitMargin'),
  se:       G('seTax'),
  state:    G('stateTax'),
  // Results
  price:    G('suggestedPrice'),
  note:     G('priceNote'),
  staxLive: G('salesTaxLive'),
  staxTotal:G('salesTaxTotal'),
  staxDetail:G('salesTaxDetail'),
  netP:     G('netProfit'),
  margin:   G('marginDisplay'),
  eff:      G('effRate'),
  badge:    G('moneyBadge'),
  badgeTxt: G('moneyText'),
  // Breakdown
  bdLabor:  G('bd-labor'),
  bdMat:    G('bd-mat'),
  bdOH:     G('bd-oh'),
  bdTravel: G('bd-travel'),
  bdSE:     G('bd-se'),
  bdState:  G('bd-state'),
  bdTotal:  G('bd-total'),
  // UI
  reset:    G('resetBtn'),
  pdf:      G('pdfBtn'),
  custPdf:  G('custPdfBtn'),
  cust:     G('custBtn'),
  copy:     G('copyBtn'),
  bkToggle: G('bkToggle'),
  bkBody:   G('bkBody'),
  bkLabel:  G('bkToggleLabel'),
  toast:    G('toast'),
  // Quote Settings
  bizName:  G('bizName'),
  bizPhone: G('bizPhone'),
  bizEmail: G('bizEmail'),
  inclBiz:  G('includeBizInfo'),
  payTerms: G('paymentTerms'),
  inclTerms:G('includeTerms'),
  qvDays:   G('quoteValid'),
  inclValid:G('includeValid'),
  staxRate: G('salesTaxRate'),
  inclStax: G('includeSalesTax'),
};

/* ============================================================
   FORMATTING
============================================================ */
function fmtD(n, dec = 0) {
  if (!isFinite(n) || isNaN(n)) return '$0';
  const absStr = Math.abs(n).toFixed(dec);
  const zero = /^0+(?:\.0+)?$/.test(absStr);
  const sign = !zero && n < 0 ? '-' : '';
  return sign + '$' + absStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function fmtP(n, dec = 1) {
  if (!isFinite(n) || isNaN(n)) return '0%';
  return n.toFixed(dec) + '%';
}
function attrBound(el, name) {
  if (!el || el[name] === '' || el[name] == null) return NaN;
  return parseFloat(el[name]);
}
function parseBound(el) {
  const v = parseFloat(el.value);
  if (!isFinite(v)) return 0;
  let out = v;
  const min = attrBound(el, 'min');
  const max = attrBound(el, 'max');
  if (isFinite(min) && out < min) out = min;
  if (isFinite(max) && out > max) out = max;
  return out;
}
function num(el) { return parseBound(el); }
function snapBounds(el, fromBlur) {
  const raw = String(el.value).trim();
  if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
    if (fromBlur) {
      const min = attrBound(el, 'min');
      el.value = String(isFinite(min) ? min : 0);
    }
    return;
  }
  const v = parseFloat(raw);
  if (!isFinite(v)) return;
  const bounded = parseBound(el);
  if (bounded !== v) el.value = String(bounded);
}

/* ============================================================
   CALCULATE — all math verified to spec
============================================================ */
function calc() {
  const hours      = num($.hours);
  const workers    = Math.max(num($.workers), 1);
  const laborRate  = num($.labor);
  const matCost    = num($.matCost);
  const matMark    = num($.matMark) / 100;
  const ohPct      = num($.overhead) / 100;
  const driveTime  = num($.drive);
  const fuelCost   = num($.fuel);
  const profitPct  = Math.min(num($.profit), 89) / 100;
  const sePct      = num($.se) / 100;
  const statePct   = num($.state) / 100;

  // Labor
  const totalLabor = hours * workers * laborRate;
  // Materials with markup
  const matTotal   = matCost * (1 + matMark);
  // Overhead on labor + materials
  const overhead   = (totalLabor + matTotal) * ohPct;
  // Travel: drive hours billed once at labor rate (not × workers) + flat fuel
  const travel     = (driveTime * laborRate) + fuelCost;
  // Subtotal of all direct costs
  const subtotal   = totalLabor + matTotal + overhead + travel;
  // Tax allowances on the cost subtotal (not earnings / suggested price)
  const seAmt      = subtotal * sePct;
  const stateAmt   = subtotal * statePct;
  // Total cost
  const totalCost  = subtotal + seAmt + stateAmt;
  // Suggested price to achieve desired profit margin
  const suggested  = totalCost / (1 - profitPct);
  // Net profit and margin
  const netProfit  = suggested - totalCost;
  const realMargin = suggested > 0 ? (netProfit / suggested) * 100 : 0;
  // Effective $/hr = profit ÷ job hours only (hours × workers; excludes drive)
  const totalHrs   = hours * workers;
  const effRate    = totalHrs > 0 ? netProfit / totalHrs : 0;

  return { totalLabor, matTotal, overhead, travel, subtotal, seAmt, stateAmt, totalCost, suggested, netProfit, realMargin, effRate, totalHrs };
}

/* ============================================================
   ANIMATE NUMBERS
============================================================ */
function pop(el) {
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

/* ============================================================
   COLOR CLASS BY MARGIN
============================================================ */
function marginClass(m) {
  if (m >= 20) return 'c-green';
  if (m >= 10) return 'c-warn';
  return 'c-red';
}

/* ============================================================
   UPDATE UI
============================================================ */
function update() {
  const r = calc();

  // Price
  pop($.price);
  $.price.textContent = fmtD(r.suggested, 2);
  $.note.textContent  = `Total cost: ${fmtD(r.totalCost, 2)}  ·  Target margin: ${num($.profit)}%`;

  const { staxPct, staxAmt, grandTotal } = customerQuoteParts(r);
  const showStax = $.inclStax.checked;
  if ($.staxLive) {
    $.staxLive.hidden = !showStax;
    if (showStax) {
      $.staxTotal.textContent = fmtD(grandTotal, 2);
      $.staxDetail.textContent = staxAmt > 0
        ? `Includes ${fmtD(staxAmt, 2)} sales tax (${staxPct}% on marked-up materials)`
        : 'Sales tax is on — rate is 0%, so the customer total matches the suggested charge.';
    }
  }

  // Net profit
  pop($.netP);
  $.netP.textContent  = fmtD(r.netProfit, 0);
  $.netP.className    = 'metric-val ' + marginClass(r.realMargin);

  // Margin
  pop($.margin);
  $.margin.textContent = fmtP(r.realMargin, 1);
  $.margin.className   = 'metric-val ' + marginClass(r.realMargin);

  // Effective rate
  pop($.eff);
  $.eff.textContent  = fmtD(r.effRate, 0) + '/hr';
  $.eff.className    = 'metric-val ' + (r.effRate >= 30 ? 'c-green' : r.effRate >= 15 ? 'c-warn' : 'c-red');

  // Money badge
  if (r.realMargin >= 10) {
    $.badge.className = 'money-badge yes';
    $.badgeTxt.textContent = '✓ MAKING MONEY';
  } else if (r.realMargin > 0) {
    $.badge.className = 'money-badge warn';
    $.badgeTxt.textContent = '⚠ THIN MARGIN';
  } else {
    $.badge.className = 'money-badge no';
    $.badgeTxt.textContent = '✗ NOT PROFITABLE';
  }

  // Breakdown
  $.bdLabor.textContent  = fmtD(r.totalLabor, 2);
  $.bdMat.textContent    = fmtD(r.matTotal,   2);
  $.bdOH.textContent     = fmtD(r.overhead,   2);
  $.bdTravel.textContent = fmtD(r.travel,     2);
  $.bdSE.textContent     = fmtD(r.seAmt,      2);
  $.bdState.textContent  = fmtD(r.stateAmt,   2);
  $.bdTotal.textContent  = fmtD(r.totalCost,  2);

  // Sticky mini-bar
  G('srPrice').textContent  = fmtD(r.suggested, 2);
  G('srMargin').textContent = fmtP(r.realMargin, 1);
  G('srProfit').textContent = fmtD(r.netProfit, 0);
  updateStickyBar();
}

/* ============================================================
   TRADE SELECT
============================================================ */
$.trade.addEventListener('change', function() {
  const d = DEFAULTS[this.value];
  if (!d) return;
  $.hours.value   = d.hours;
  $.workers.value = d.workers;
  $.labor.value   = d.laborRate;
  $.matCost.value = d.materialCost;
  $.matMark.value = d.materialMarkup;
  $.overhead.value= d.overhead;
  $.drive.value   = d.driveTime;
  $.fuel.value    = d.fuelCost;
  update();
});

/* ============================================================
   RESET
============================================================ */
$.reset.addEventListener('click', function() {
  const d = DEFAULTS[$.trade.value];
  if (d) {
    $.hours.value   = d.hours;
    $.workers.value = d.workers;
    $.labor.value   = d.laborRate;
    $.matCost.value = d.materialCost;
    $.matMark.value = d.materialMarkup;
    $.overhead.value= d.overhead;
    $.drive.value   = d.driveTime;
    $.fuel.value    = d.fuelCost;
  } else {
    $.hours.value   = 4;  $.workers.value = 1;  $.labor.value   = 75;
    $.matCost.value = 200; $.matMark.value = 20; $.overhead.value= 15;
    $.drive.value   = 0.5; $.fuel.value    = 10;
  }
  $.profit.value = 20;
  $.se.value     = 15.3;
  $.state.value  = 5;
  update();
});

/* ============================================================
   COPY QUOTE
============================================================ */
$.copy.addEventListener('click', function() {
  const r    = calc();
  const lbl  = $.jobLabel.value || 'Job';
  const trd  = $.trade.options[$.trade.selectedIndex]?.text || 'Contractor';
  const date = new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });

  const lines = [
    '═══════════════════════════════════',
    `  JOB QUOTE — ${lbl.toUpperCase()}`,
    `  Trade: ${trd}`,
    `  Date:  ${date}`,
    '═══════════════════════════════════',
    '',
    `  CHARGE TO CUSTOMER:   ${fmtD(r.suggested, 2)}`,
    '',
    '  ── COST BREAKDOWN ──────────────',
    `  Labor Cost:           ${fmtD(r.totalLabor, 2)}`,
    `  Materials (w/ markup):${fmtD(r.matTotal,   2)}`,
    `  Overhead & Burden:    ${fmtD(r.overhead,   2)}`,
    `  Travel Cost:          ${fmtD(r.travel,     2)}`,
    `  SE Tax (on costs):    ${fmtD(r.seAmt,      2)}`,
    `  State Tax (on costs): ${fmtD(r.stateAmt,   2)}`,
    `  ──────────────────────────────`,
    `  Total Cost:           ${fmtD(r.totalCost,  2)}`,
    '',
    `  NET PROFIT:           ${fmtD(r.netProfit,  2)}`,
    `  PROFIT MARGIN:        ${fmtP(r.realMargin, 1)}`,
    `  EFFECTIVE $/HR:       ${fmtD(r.effRate,    2)}/hr`,
    '',
    '  Generated by JobProfitCalc.com',
    '═══════════════════════════════════',
  ].join('\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(lines).then(() => toast('✓ Quote copied to clipboard!'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = lines;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
    toast('✓ Quote copied to clipboard!');
  }
});

/* ============================================================
   SAVE AS PDF
============================================================ */
$.pdf.addEventListener('click', function() {
  const lbl = $.jobLabel.value.trim();
  const trd = $.trade.options[$.trade.selectedIndex]?.text.replace(/^\W+/, '').trim() || 'Contractor';
  const now  = new Date();
  const mon  = now.toLocaleDateString('en-US', { month: 'short' });
  const day  = now.getDate();
  const yr   = now.getFullYear();
  const dateShort = mon + ' ' + day + ' ' + yr;
  const dateLong  = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Populate print-only header
  document.getElementById('printHeaderTitle').textContent = lbl || trd;
  document.getElementById('printHeaderMeta').textContent =
    (lbl ? trd + ' · ' + lbl + ' · ' : trd + ' · ') + dateLong + ' · Generated by JobProfitCalc.com';

  // Set suggested filename (becomes default in Save As PDF dialog)
  const origTitle = document.title;
  const safeName  = (lbl || trd).replace(/[<>:"/\\|?*]+/g, '').trim();
  document.title  = safeName + ' · ' + dateShort + ' · JobProfitCalc';

  window.print();

  // Restore title after print dialog closes (afterprint fires on most browsers;
  // setTimeout is the fallback for browsers that don't support it)
  const restore = function() { document.title = origTitle; };
  window.addEventListener('afterprint', restore, { once: true });
  setTimeout(restore, 2000);
});

/* ============================================================
   QUOTE SETTINGS — localStorage persistence + toggle
============================================================ */
// Persist text fields
['bizName','bizPhone','bizEmail','paymentTerms','quoteValid','salesTaxRate'].forEach(function(id) {
  const el = G(id);
  const key = 'jpc_qs_' + id;
  const stored = localStorage.getItem(key);
  if (stored !== null) el.value = stored;
  el.addEventListener('input', function() { localStorage.setItem(key, el.value); });
});
// Persist checkboxes
['includeBizInfo','includeTerms','includeValid','includeSalesTax'].forEach(function(id) {
  const el = G(id);
  const key = 'jpc_qs_' + id;
  const stored = localStorage.getItem(key);
  if (stored !== null) el.checked = (stored === 'true');
  el.addEventListener('change', function() { localStorage.setItem(key, el.checked); });
});

/* ============================================================
   CUSTOMER QUOTE LINE ITEMS
   Labor is a loaded remainder (suggested − materials − travel).
   Materials already include markup. Disclose both on the quote.
============================================================ */
const CUST_BUILD_NOTE = 'Labor is loaded: it includes overhead, taxes, and target profit. Materials include markup.';

function customerQuoteParts(r) {
  const travel      = r.travel > 0 ? r.travel : 0;
  const laborCharge = r.suggested - r.matTotal - travel;
  const staxPct     = $.inclStax.checked ? (parseFloat($.staxRate.value) || 0) : 0;
  const staxAmt     = r.matTotal * (staxPct / 100);
  const grandTotal  = r.suggested + staxAmt;
  return { travel, laborCharge, staxPct, staxAmt, grandTotal };
}

/* ============================================================
   CUSTOMER PDF
============================================================ */
$.custPdf.addEventListener('click', function() {
  const r   = calc();
  const lbl = $.jobLabel.value.trim() || 'Job';
  const trd = $.trade.options[$.trade.selectedIndex]?.text.replace(/^\W+/, '').trim() || 'Contractor';
  const now = new Date();
  const mon = now.toLocaleDateString('en-US', { month: 'short' });
  const dateShort = mon + ' ' + now.getDate() + ' ' + now.getFullYear();
  const dateLong  = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const { travel, laborCharge, staxPct, staxAmt, grandTotal } = customerQuoteParts(r);

  // Populate print header
  G('custPrintTitle').textContent = lbl || trd;
  G('custPrintMeta').textContent  = (lbl ? trd + ' · ' + lbl + ' · ' : trd + ' · ') + dateLong + ' · Generated by JobProfitCalc.com';

  // Business info block
  const bizBlock = G('custBizBlock');
  if ($.inclBiz.checked && ($.bizName.value || $.bizPhone.value || $.bizEmail.value)) {
    G('custBizName').textContent    = $.bizName.value.trim();
    G('custBizContact').textContent = [$.bizPhone.value.trim(), $.bizEmail.value.trim()].filter(Boolean).join('  ·  ');
    bizBlock.style.display = '';
  } else {
    bizBlock.style.display = 'none';
  }

  // Big price + valid-until note
  G('custTotalDisplay').textContent = fmtD(grandTotal, 2);
  if ($.inclValid.checked && $.qvDays.value) {
    const exp = new Date(now);
    exp.setDate(exp.getDate() + parseInt($.qvDays.value, 10));
    G('custValidNote').textContent = 'Quote valid until ' + exp.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } else {
    G('custValidNote').textContent = dateLong;
  }

  // Line items (bk-row elements built dynamically)
  function mkRow(label, val) {
    return '<div class="bk-row"><span class="bk-rowlbl">' + label + '</span><span class="bk-rowval">' + fmtD(val, 2) + '</span></div>';
  }
  let itemsHtml = mkRow('Labor (loaded)', laborCharge);
  itemsHtml += mkRow('Materials (incl. markup)', r.matTotal);
  if (staxAmt > 0) itemsHtml += mkRow('Sales Tax (' + staxPct + '%)', staxAmt);
  if (travel  > 0) itemsHtml += mkRow('Travel', travel);
  itemsHtml += '<p class="cust-quote-note">' + CUST_BUILD_NOTE + '</p>';
  G('custLineItems').innerHTML = itemsHtml;

  // Footer: total row + optional payment terms
  let footerHtml = '<div class="bk-total"><span class="bk-totallbl">Total Due</span><span class="bk-totalval">' + fmtD(grandTotal, 2) + '</span></div>';
  if ($.inclTerms.checked && $.payTerms.value.trim()) {
    footerHtml += '<div class="bk-row" style="border-top:1px solid var(--border);padding:12px 20px"><span class="bk-rowlbl">Payment Terms</span><span class="bk-rowval" style="font-size:13px;text-align:right">' + $.payTerms.value.trim() + '</span></div>';
  }
  G('custFooterRows').innerHTML = footerHtml;

  // Set filename for Save dialog
  const origTitle = document.title;
  const safeName  = (lbl || trd).replace(/[<>:"/\\|?*]+/g, '').trim();
  document.title  = safeName + ' · Customer Quote · ' + dateShort + ' · JobProfitCalc';

  // Switch to customer print mode, print, then restore
  document.body.classList.add('print-customer');
  window.print();
  const restore = function() {
    document.body.classList.remove('print-customer');
    document.title = origTitle;
  };
  window.addEventListener('afterprint', restore, { once: true });
  setTimeout(restore, 2000);
});

/* ============================================================
   CUSTOMER QUOTE
============================================================ */
$.cust.addEventListener('click', function() {
  const r   = calc();
  const lbl = $.jobLabel.value.trim() || 'Job';
  const trd = $.trade.options[$.trade.selectedIndex]?.text || 'Contractor';
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });

  const { travel, laborCharge, staxPct, staxAmt, grandTotal } = customerQuoteParts(r);

  // Column alignment helper
  function col(label, val) {
    const spaces = Math.max(1, 26 - label.length);
    return '  ' + label + ' '.repeat(spaces) + val;
  }

  // Valid-until date
  let validLine = '';
  if ($.inclValid.checked && $.qvDays.value) {
    const exp = new Date(now);
    exp.setDate(exp.getDate() + parseInt($.qvDays.value, 10));
    const expStr = exp.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
    validLine = '  Valid Until:         ' + expStr;
  }

  const lines = ['═══════════════════════════════════'];

  // Business header block
  if ($.inclBiz.checked && ($.bizName.value || $.bizPhone.value || $.bizEmail.value)) {
    if ($.bizName.value) lines.push('  ' + $.bizName.value.trim());
    const contact = [$.bizPhone.value.trim(), $.bizEmail.value.trim()].filter(Boolean).join('  |  ');
    if (contact) lines.push('  ' + contact);
    lines.push('  ─────────────────────────────────');
  }

  lines.push('  QUOTE — ' + lbl.toUpperCase());
  lines.push('  Trade:  ' + trd);
  lines.push('  Date:   ' + date);
  if (validLine) lines.push(validLine);
  lines.push('═══════════════════════════════════');
  lines.push('');
  lines.push(col('Labor (loaded):',          fmtD(laborCharge, 2)));
  lines.push(col('Materials (incl. markup):', fmtD(r.matTotal,  2)));
  if (staxAmt > 0) lines.push(col('Sales Tax (' + staxPct + '%):',  fmtD(staxAmt, 2)));
  if (travel > 0)  lines.push(col('Travel:',     fmtD(travel,       2)));
  lines.push('  ─────────────────────────────────');
  lines.push(col('TOTAL DUE:', fmtD(grandTotal,  2)));
  lines.push('');
  lines.push('  ' + CUST_BUILD_NOTE);
  lines.push('');
  if ($.inclTerms.checked && $.payTerms.value.trim()) {
    lines.push('  Payment Terms:');
    lines.push('  ' + $.payTerms.value.trim());
    lines.push('');
  }
  lines.push('  Generated by JobProfitCalc.com');
  lines.push('═══════════════════════════════════');

  const text = lines.join('\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() { toast('✓ Customer quote copied!'); });
  } else {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
    toast('✓ Customer quote copied!');
  }
});

/* ============================================================
   TOAST
============================================================ */
let toastTimer;
function toast(msg) {
  clearTimeout(toastTimer);
  $.toast.textContent = msg;
  $.toast.classList.add('show');
  toastTimer = setTimeout(() => $.toast.classList.remove('show'), 3200);
}

/* ============================================================
   BREAKDOWN ACCORDION
============================================================ */
$.bkToggle.addEventListener('click', function() {
  const open = $.bkBody.classList.toggle('open');
  this.classList.toggle('open', open);
  this.setAttribute('aria-expanded', open);
  $.bkLabel.textContent = open ? 'Hide Cost Breakdown' : 'View Full Cost Breakdown';
});

/* ============================================================
   TOOLTIP TAP / KEYBOARD TOGGLE
============================================================ */
function closeTips(except) {
  document.querySelectorAll('.tip').forEach(function(o) {
    if (except && o === except) return;
    o.classList.remove('active');
    o.setAttribute('aria-expanded', 'false');
  });
}
function setTipOpen(tip, open) {
  closeTips(open ? tip : null);
  tip.classList.toggle('active', open);
  tip.setAttribute('aria-expanded', String(open));
}
document.querySelectorAll('.tip').forEach(function(t) {
  if (!t.hasAttribute('aria-expanded')) t.setAttribute('aria-expanded', 'false');
  t.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    setTipOpen(t, !t.classList.contains('active'));
  });
  t.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      setTipOpen(t, false);
      t.blur();
    }
  });
});
document.addEventListener('click', function() { closeTips(); });
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape' && e.key !== 'Esc') return;
  closeTips();
  const focused = document.activeElement;
  if (focused && focused.classList && focused.classList.contains('tip')) focused.blur();
});

/* ============================================================
   TRADE TIPS ACCORDION
============================================================ */
document.querySelectorAll('.tip-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    const item = this.closest('.tip-item');
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.tip-item').forEach(el => {
      el.classList.remove('open');
      el.querySelector('.tip-btn').setAttribute('aria-expanded', 'false');
    });
    if (!wasOpen) {
      item.classList.add('open');
      this.setAttribute('aria-expanded', 'true');
    }
  });
});

/* ============================================================
   FAQ ACCORDION
============================================================ */
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', function() {
    const item = this.closest('.faq-item');
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(el => {
      el.classList.remove('open');
      el.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
    });
    if (!wasOpen) {
      item.classList.add('open');
      this.setAttribute('aria-expanded', 'true');
    }
  });
});

/* ============================================================
   QUOTE SETTINGS ACCORDION
============================================================ */
G('qsToggle').addEventListener('click', function() {
  const open = G('qsPanel').classList.toggle('open');
  this.classList.toggle('open', open);
  this.setAttribute('aria-expanded', open);
  updateStickyBar();
});

/* ============================================================
   STICKY RESULTS MINI-BAR
   Visible while the calculator is on screen but the full
   results panel hasn't scrolled into view yet.
============================================================ */
const stickyBar    = G('stickyResults');
const resultsPanel = G('resultsPanel');
const calcCardEl   = document.querySelector('.calc-card');
function updateStickyBar() {
  const rRect = resultsPanel.getBoundingClientRect();
  const cRect = calcCardEl.getBoundingClientRect();
  const resultsBelowFold = rRect.top > window.innerHeight - 40;
  const calcOnScreen = cRect.top < window.innerHeight && cRect.bottom > 0;
  const show = calcOnScreen && resultsBelowFold;
  stickyBar.classList.toggle('show', show);
  stickyBar.setAttribute('aria-hidden', String(!show));
  document.body.classList.toggle('has-sticky-results', show);
}
window.addEventListener('scroll', updateStickyBar, { passive: true });
window.addEventListener('resize', updateStickyBar, { passive: true });
G('stickyResultsBtn').addEventListener('click', function() {
  resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
updateStickyBar();

/* ============================================================
   LIVE INPUT LISTENERS
============================================================ */
[$.hours, $.workers, $.labor, $.matCost, $.matMark,
 $.overhead, $.drive, $.fuel, $.profit, $.se, $.state
].forEach(el => {
  el.addEventListener('input', function() { snapBounds(el); update(); });
  el.addEventListener('change', function() { snapBounds(el); update(); });
  el.addEventListener('blur', function() { snapBounds(el, true); update(); });
});
[$.staxRate, $.inclStax].forEach(el => {
  if (!el) return;
  el.addEventListener('input', update);
  el.addEventListener('change', update);
});

/* ============================================================
   INITIAL RENDER
============================================================ */
update();
