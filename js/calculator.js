/* Job profit calculator UI. Math lives in pricing.js (JobPricing). */
const P = window.JobPricing;
const DEFAULTS = P.TRADE_DEFAULTS;

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
  bdLabor:  G('bd-labor'),
  bdDrive:  G('bd-drive'),
  bdFuel:   G('bd-fuel'),
  bdMat:    G('bd-mat'),
  bdMarkup: G('bd-markup'),
  bdMarkupRow: G('bd-markup-row'),
  effMarginLine: G('effMarginLine'),
  effMargin: G('effMargin'),
  bdOH:     G('bd-oh'),
  bdTotal:  G('bd-total'),
  bdSet:    G('bd-setaside'),
  qLabor:   G('q-labor'),
  qMat:     G('q-mat'),
  qDrive:   G('q-drive'),
  qFuel:    G('q-fuel'),
  qTotal:   G('q-total'),
  reset:    G('resetBtn'),
  pdf:      G('pdfBtn'),
  custPdf:  G('custPdfBtn'),
  cust:     G('custBtn'),
  copy:     G('copyBtn'),
  bkToggle: G('bkToggle'),
  bkBody:   G('bkBody'),
  bkLabel:  G('bkToggleLabel'),
  toast:    G('toast'),
  bizName:  G('bizName'),
  bizPhone: G('bizPhone'),
  bizEmail: G('bizEmail'),
  inclBiz:  G('includeBizInfo'),
  payTerms: G('paymentTerms'),
  inclTerms:G('includeTerms'),
  qvDays:   G('quoteValid'),
  inclValid:G('includeValid'),
  staxRate: G('salesTaxRate'),
  inclStax: G('includeSalesTax')
};

const FIELD_IDS = {
  hours: 'hours',
  workers: 'workers',
  laborRate: 'laborRate',
  materialCost: 'materialCost',
  overhead: 'overhead',
  driveTime: 'driveTime',
  fuelCost: 'fuelCost',
  margin: 'profitMargin',
  salesTaxRate: 'salesTaxRate'
};

// Job inputs other than material markup are not stored and are not read from the URL.
// Drop leftover tax keys from older builds. Drop the old markup key so a saved
// value from before jpc_materialMarkup_v2 cannot come back. The new key is restored below.
try {
  ['jpc_seTax', 'jpc_stateTax', 'jpc_qs_seTax', 'jpc_qs_stateTax', 'jpc_materialMarkup'].forEach(function (key) {
    localStorage.removeItem(key);
  });
} catch (e) { /* private mode */ }

function saveMarkup() {
  if (!$.matMark) return;
  try { P.writeStoredMarkup(localStorage, $.matMark.value); } catch (e) { /* private mode */ }
}

function restoreMarkup() {
  if (!$.matMark) return;
  try {
    var stored = P.readStoredMarkup(localStorage);
    if (stored !== null) $.matMark.value = stored;
  } catch (e) { /* private mode */ }
  // A restored 600 or -5 is committed once on load. Typing is not in progress.
  // Write the clamped 500 or 0 back so storage matches the field.
  showMarkupMessage(true);
  saveMarkup();
}

function fmtD(n, dec) {
  if (!Number.isFinite(n)) return dec === 0 ? '$0' : '$0.00';
  return P.formatDollars(Math.round(n * 100), dec == null ? 2 : dec);
}
function fmtP(n) {
  if (!Number.isFinite(n)) return '0.0%';
  return P.formatPercent(n / 100);
}

function pop(el) {
  if (!el) return;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}
function marginClass(m) {
  if (m >= 20) return 'c-green';
  if (m >= 10) return 'c-warn';
  return 'c-red';
}

function readRaw() {
  return {
    hours: $.hours.value,
    workers: $.workers.value,
    laborRate: $.labor.value,
    materialCost: $.matCost.value,
    materialMarkup: $.matMark ? $.matMark.value : '0',
    overhead: $.overhead.value,
    driveTime: $.drive.value,
    fuelCost: $.fuel.value,
    margin: $.profit.value,
    salesTaxRate: $.staxRate ? $.staxRate.value : '0'
  };
}

function showMessages(messages) {
  Object.keys(FIELD_IDS).forEach(function (key) {
    const id = FIELD_IDS[key];
    const input = G(id);
    const msg = G('msg-' + id);
    const info = messages[key];
    if (!input) return;
    const field = input.closest('.ifield');
    const level = info ? info.level : 'ok';
    input.setAttribute('aria-invalid', level === 'error' ? 'true' : 'false');
    if (field) field.classList.toggle('has-error', level === 'error');
    if (!msg) return;
    msg.textContent = info && info.message ? info.message : '';
    msg.className = 'field-msg' + (level === 'ok' || !info || !info.message ? '' : ' is-' + level);
  });
}

function blankMoney() {
  $.price.textContent = '$0.00';
  $.netP.textContent = '$0.00';
  $.margin.textContent = '0.0%';
  $.eff.textContent = '$0.00/hr';
  $.netP.className = 'metric-val c-white';
  $.margin.className = 'metric-val c-white';
  $.eff.className = 'metric-val c-white';
  [$.bdLabor, $.bdDrive, $.bdFuel, $.bdMat, $.bdMarkup, $.bdOH, $.bdTotal, $.bdSet,
   $.qLabor, $.qMat, $.qDrive, $.qFuel, $.qTotal].forEach(function (el) {
    if (el) el.textContent = '$0.00';
  });
  if ($.bdMarkupRow) $.bdMarkupRow.hidden = true;
  if ($.effMarginLine) $.effMarginLine.hidden = true;
  const srP = G('srPrice');
  const srM = G('srMargin');
  const srF = G('srProfit');
  if (srP) srP.textContent = '$0.00';
  if (srM) srM.textContent = '0.0%';
  if (srF) srF.textContent = '$0.00';
}

let lastResult = null;

function currentResult() {
  const checked = P.validateJob(readRaw());
  showMessages(checked.messages);
  if (!checked.ok) return { ok: false, messages: checked.messages };
  const chargeTax = $.inclStax && $.inclStax.checked;
  const values = Object.assign({}, checked.values, {
    salesTaxRate: chargeTax ? checked.values.salesTaxRate : 0,
    materialMarkup: $.matMark ? $.matMark.value : '0'
  });
  const priced = P.priceJob(values);
  if (!priced.ok) return { ok: false, messages: checked.messages };
  return { ok: true, messages: checked.messages, result: priced, values: values };
}

// Set when a cap or negative entry is committed. Cleared on the next keystroke
// in this field, so the note stays up after blur instead of vanishing with the rewrite.
var markupNote = '';

function partialMarkup(s) {
  return s === '+' || s === '-' || s === '.' || s === '+.' || s === '-.'
    || /^[+-]?(?:\d+\.?\d*|\.\d+)[eE][+-]?$/.test(s);
}

function decimalMarkup(s) {
  return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(s);
}

function showMarkupMessage(commit) {
  if (!$.matMark) return;
  var msg = G('msg-materialMarkup');
  var s = String($.matMark.value).trim();
  var text = '';
  // Blank, a lone "-", and an unfinished entry (".", "1e") stay as typed and add nothing.
  if (s !== '' && !partialMarkup(s)) {
    var n = Number(s);
    if (!decimalMarkup(s) || !Number.isFinite(n) || n < 0) {
      text = 'Enter 0 or more. Using 0.';
      if (commit) $.matMark.value = '0';
    } else if (n > P.MARKUP_MAX) {
      text = 'Capped at 500%.';
      if (commit) $.matMark.value = String(P.MARKUP_MAX);
    }
  }
  if (commit) {
    if (text) markupNote = text;
    else if (markupNote && ($.matMark.value === '0' || $.matMark.value === String(P.MARKUP_MAX))) {
      // change and blur both commit. The second one sees the rewritten 0 or 500.
      text = markupNote;
    } else markupNote = '';
  } else if (markupNote) {
    text = markupNote;
  }
  if (!msg) return;
  msg.textContent = text;
  msg.className = 'field-msg' + (text ? ' is-warn' : '');
}

function update() {
  showMarkupMessage(false);
  const state = currentResult();
  const resultsEl = G('resultsPanel');
  lastResult = state.ok ? state.result : null;

  if (!state.ok) {
    if (resultsEl) resultsEl.classList.add('is-empty');
    blankMoney();
    $.note.textContent = 'Fix the fields marked above. The price stays blank until every entry is a valid number.';
    if ($.staxLive) $.staxLive.hidden = true;
    $.badge.className = 'money-badge no';
    $.badgeTxt.textContent = 'CHECK INPUTS';
    updateStickyBar();
    return;
  }

  const r = state.result;
  const isEmpty = r.price === 0 && r.totalCost === 0;
  if (resultsEl) resultsEl.classList.toggle('is-empty', isEmpty);

  pop($.price);
  $.price.textContent = fmtD(r.price, 2);
  $.note.textContent = isEmpty
    ? 'Enter hours, a labor rate, or materials to see a suggested charge.'
    : 'Total cost: ' + fmtD(r.totalCost, 2) + '  ·  Target margin: ' + state.values.margin + '%';

  const showStax = $.inclStax && $.inclStax.checked;
  if ($.staxLive) {
    $.staxLive.hidden = !showStax;
    if (showStax) {
      $.staxTotal.textContent = fmtD(r.customerTotal, 2);
      $.staxDetail.textContent = r.salesTax > 0
        ? 'Includes ' + fmtD(r.salesTax, 2) + ' sales tax (' + state.values.salesTaxRate + '% on the materials line)'
        : 'Sales tax is on — rate is 0%, so the customer total matches the suggested charge.';
    }
  }

  pop($.netP);
  $.netP.textContent = fmtD(r.profit, 2);
  $.netP.className = 'metric-val ' + (isEmpty ? 'c-white' : marginClass(r.marginPct));

  pop($.margin);
  $.margin.textContent = fmtP(r.marginPct);
  $.margin.className = 'metric-val ' + (isEmpty ? 'c-white' : marginClass(r.marginPct));

  pop($.eff);
  if (r.profitPerLaborHour == null) {
    $.eff.textContent = '—';
    $.eff.className = 'metric-val c-white';
  } else {
    $.eff.textContent = fmtD(r.profitPerLaborHour, 2) + '/hr';
    $.eff.className = 'metric-val ' + (isEmpty ? 'c-white' : (r.profitPerLaborHour >= 30 ? 'c-green' : r.profitPerLaborHour >= 15 ? 'c-warn' : 'c-red'));
  }

  if (isEmpty) {
    $.badge.className = 'money-badge idle';
    $.badgeTxt.textContent = 'ENTER JOB DETAILS';
  } else if (r.marginPct >= 10) {
    $.badge.className = 'money-badge yes';
    $.badgeTxt.textContent = '✓ MAKING MONEY';
  } else if (r.marginPct > 0) {
    $.badge.className = 'money-badge warn';
    $.badgeTxt.textContent = '⚠ THIN MARGIN';
  } else {
    $.badge.className = 'money-badge no';
    $.badgeTxt.textContent = '✗ NOT PROFITABLE';
  }

  $.bdLabor.textContent = fmtD(r.labor, 2);
  $.bdDrive.textContent = fmtD(r.driveLabor, 2);
  $.bdFuel.textContent = fmtD(r.fuel, 2);
  $.bdMat.textContent = fmtD(r.materials, 2);
  if ($.bdMarkup) $.bdMarkup.textContent = fmtD(r.markup, 2);
  if ($.bdMarkupRow) $.bdMarkupRow.hidden = !(r.markup > 0);
  if ($.effMarginLine) {
    var showEff = r.markupPct > 0;
    $.effMarginLine.hidden = !showEff;
    if (showEff && $.effMargin) $.effMargin.textContent = fmtP(r.marginPct);
  }
  $.bdOH.textContent = fmtD(r.overhead, 2);
  $.bdTotal.textContent = fmtD(r.totalCost, 2);
  $.bdSet.textContent = fmtD(r.setAside, 2);
  $.qLabor.textContent = fmtD(r.quote.labor, 2);
  $.qMat.textContent = fmtD(r.quote.materials, 2);
  $.qDrive.textContent = fmtD(r.quote.driveLabor, 2);
  $.qFuel.textContent = fmtD(r.quote.fuel, 2);
  $.qTotal.textContent = fmtD(r.price, 2);

  G('srPrice').textContent = fmtD(r.price, 2);
  G('srMargin').textContent = fmtP(r.marginPct);
  G('srProfit').textContent = fmtD(r.profit, 2);
  updateStickyBar();
}

function applyTrade(d) {
  $.hours.value = d.hours;
  $.workers.value = d.workers;
  $.labor.value = d.laborRate;
  $.matCost.value = d.materialCost;
  $.overhead.value = d.overhead;
  $.drive.value = d.driveTime;
  $.fuel.value = d.fuelCost;
}

$.trade.addEventListener('change', function (event) {
  const d = DEFAULTS[this.value];
  if (!d) return;
  applyTrade(d);
  // Trade pages fire change on load to apply defaults. That event is not a user
  // action, so it must not wipe a saved markup. A real trade change resets it to 0.
  if (event.isTrusted && $.matMark) {
    markupNote = '';
    $.matMark.value = '0';
    saveMarkup();
  }
  update();
});

$.reset.addEventListener('click', function () {
  const d = DEFAULTS[$.trade.value];
  if (d) applyTrade(d);
  else applyTrade(P.PAGE_DEFAULTS);
  if ($.matMark) {
    markupNote = '';
    $.matMark.value = '0';
    saveMarkup();
  }
  $.profit.value = 20;
  update();
});

const CUST_BUILD_NOTE = 'Labor, materials, and drive each include that line\'s share of overhead and profit. Fuel includes its share of profit only.';

function quoteText(r) {
  const lbl = $.jobLabel.value || 'Job';
  const trd = $.trade.options[$.trade.selectedIndex] ? $.trade.options[$.trade.selectedIndex].text : 'Contractor';
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const lines = [
    '═══════════════════════════════════',
    '  JOB QUOTE — ' + lbl.toUpperCase(),
    '  Trade: ' + trd,
    '  Date:  ' + date,
    '═══════════════════════════════════',
    '',
    '  CHARGE TO CUSTOMER:   ' + fmtD(r.price, 2),
    '',
    '  ── COST BREAKDOWN ──────────────',
    '  Labor:                ' + fmtD(r.labor, 2),
    '  Drive labor:          ' + fmtD(r.driveLabor, 2),
    '  Fuel:                 ' + fmtD(r.fuel, 2),
    '  Materials (at cost):  ' + fmtD(r.materials, 2),
    '  Overhead:             ' + fmtD(r.overhead, 2),
    '  ──────────────────────────────',
    '  Total Cost:           ' + fmtD(r.totalCost, 2),
    ''
  ];
  if (r.markup > 0) {
    lines.push('  Material markup:      ' + fmtD(r.markup, 2));
    lines.push('');
  }
  lines.push(
    '  PROFIT:               ' + fmtD(r.profit, 2),
    '  PROFIT MARGIN:        ' + fmtP(r.marginPct),
    '  PROFIT PER LABOR HR:  ' + (r.profitPerLaborHour == null ? '—' : fmtD(r.profitPerLaborHour, 2) + '/hr'),
    '  SE TAX SET-ASIDE:     ' + fmtD(r.setAside, 2) + '  (estimate, not in price)',
    '',
    '  Generated by JobProfitCalc.com',
    '═══════════════════════════════════'
  );
  return lines.join('\n');
}

function copyText(text, okMsg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () { toast(okMsg); });
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast(okMsg);
  }
}

$.copy.addEventListener('click', function () {
  const state = currentResult();
  if (!state.ok) { toast('Fix the highlighted fields first.'); return; }
  copyText(quoteText(state.result), '✓ Quote copied to clipboard!');
});

$.pdf.addEventListener('click', function () {
  const lbl = $.jobLabel.value.trim();
  const trd = ($.trade.options[$.trade.selectedIndex] ? $.trade.options[$.trade.selectedIndex].text : 'Contractor').replace(/^\W+/, '').trim() || 'Contractor';
  const now = new Date();
  const dateShort = now.toLocaleDateString('en-US', { month: 'short' }) + ' ' + now.getDate() + ' ' + now.getFullYear();
  const dateLong = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  document.getElementById('printHeaderTitle').textContent = lbl || trd;
  document.getElementById('printHeaderMeta').textContent =
    (lbl ? trd + ' · ' + lbl + ' · ' : trd + ' · ') + dateLong + ' · Generated by JobProfitCalc.com';
  const origTitle = document.title;
  const safeName = (lbl || trd).replace(/[<>:"/\\|?*]+/g, '').trim();
  document.title = safeName + ' · ' + dateShort + ' · JobProfitCalc';
  window.print();
  const restore = function () { document.title = origTitle; };
  window.addEventListener('afterprint', restore, { once: true });
  setTimeout(restore, 2000);
});

['bizName', 'bizPhone', 'bizEmail', 'paymentTerms', 'quoteValid', 'salesTaxRate'].forEach(function (id) {
  const el = G(id);
  if (!el) return;
  const key = 'jpc_qs_' + id;
  const stored = localStorage.getItem(key);
  if (stored !== null) el.value = stored;
  el.addEventListener('input', function () { localStorage.setItem(key, el.value); });
});
['includeBizInfo', 'includeTerms', 'includeValid', 'includeSalesTax'].forEach(function (id) {
  const el = G(id);
  if (!el) return;
  const key = 'jpc_qs_' + id;
  const stored = localStorage.getItem(key);
  if (stored !== null) el.checked = (stored === 'true');
  el.addEventListener('change', function () { localStorage.setItem(key, el.checked); });
});

function customerLines(r) {
  function col(label, val) {
    const spaces = Math.max(1, 26 - label.length);
    return '  ' + label + ' '.repeat(spaces) + val;
  }
  return { col: col };
}

$.custPdf.addEventListener('click', function () {
  const state = currentResult();
  if (!state.ok) { toast('Fix the highlighted fields first.'); return; }
  const r = state.result;
  const lbl = $.jobLabel.value.trim() || 'Job';
  const trd = ($.trade.options[$.trade.selectedIndex] ? $.trade.options[$.trade.selectedIndex].text : 'Contractor').replace(/^\W+/, '').trim() || 'Contractor';
  const now = new Date();
  const dateShort = now.toLocaleDateString('en-US', { month: 'short' }) + ' ' + now.getDate() + ' ' + now.getFullYear();
  const dateLong = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  G('custPrintTitle').textContent = lbl || trd;
  G('custPrintMeta').textContent = (lbl ? trd + ' · ' + lbl + ' · ' : trd + ' · ') + dateLong + ' · Generated by JobProfitCalc.com';

  const bizBlock = G('custBizBlock');
  if ($.inclBiz.checked && ($.bizName.value || $.bizPhone.value || $.bizEmail.value)) {
    G('custBizName').textContent = $.bizName.value.trim();
    G('custBizContact').textContent = [$.bizPhone.value.trim(), $.bizEmail.value.trim()].filter(Boolean).join('  ·  ');
    bizBlock.style.display = '';
  } else {
    bizBlock.style.display = 'none';
  }

  G('custTotalDisplay').textContent = fmtD(r.customerTotal, 2);
  if ($.inclValid.checked && $.qvDays.value) {
    const exp = new Date(now);
    exp.setDate(exp.getDate() + parseInt($.qvDays.value, 10));
    G('custValidNote').textContent = 'Quote valid until ' + exp.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } else {
    G('custValidNote').textContent = dateLong;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function mkRow(label, val) {
    return '<div class="bk-row"><span class="bk-rowlbl">' + escapeHtml(label) + '</span><span class="bk-rowval">' + escapeHtml(fmtD(val, 2)) + '</span></div>';
  }
  let itemsHtml = mkRow('Labor', r.quote.labor);
  itemsHtml += mkRow('Materials', r.quote.materials);
  itemsHtml += mkRow('Drive labor', r.quote.driveLabor);
  itemsHtml += mkRow('Fuel', r.quote.fuel);
  if (r.salesTax > 0) itemsHtml += mkRow('Sales tax (' + state.values.salesTaxRate + '%)', r.salesTax);
  itemsHtml += '<p class="cust-quote-note">' + CUST_BUILD_NOTE + '</p>';
  G('custLineItems').innerHTML = itemsHtml;

  let footerHtml = '<div class="bk-total"><span class="bk-totallbl">Total Due</span><span class="bk-totalval">' + fmtD(r.customerTotal, 2) + '</span></div>';
  if ($.inclTerms.checked && $.payTerms.value.trim()) {
    footerHtml += '<div class="bk-row" style="border-top:1px solid var(--border);padding:12px 20px"><span class="bk-rowlbl">Payment Terms</span><span class="bk-rowval" style="font-size:13px;text-align:right">' + escapeHtml($.payTerms.value.trim()) + '</span></div>';
  }
  G('custFooterRows').innerHTML = footerHtml;

  const origTitle = document.title;
  const safeName = (lbl || trd).replace(/[<>:"/\\|?*]+/g, '').trim();
  document.title = safeName + ' · Customer Quote · ' + dateShort + ' · JobProfitCalc';
  document.body.classList.add('print-customer');
  window.print();
  const restore = function () {
    document.body.classList.remove('print-customer');
    document.title = origTitle;
  };
  window.addEventListener('afterprint', restore, { once: true });
  setTimeout(restore, 2000);
});

$.cust.addEventListener('click', function () {
  const state = currentResult();
  if (!state.ok) { toast('Fix the highlighted fields first.'); return; }
  const r = state.result;
  const lbl = $.jobLabel.value.trim() || 'Job';
  const trd = $.trade.options[$.trade.selectedIndex] ? $.trade.options[$.trade.selectedIndex].text : 'Contractor';
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const col = customerLines(r).col;

  let validLine = '';
  if ($.inclValid.checked && $.qvDays.value) {
    const exp = new Date(now);
    exp.setDate(exp.getDate() + parseInt($.qvDays.value, 10));
    validLine = '  Valid Until:         ' + exp.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  const lines = ['═══════════════════════════════════'];
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
  lines.push(col('Labor:', fmtD(r.quote.labor, 2)));
  lines.push(col('Materials:', fmtD(r.quote.materials, 2)));
  lines.push(col('Drive labor:', fmtD(r.quote.driveLabor, 2)));
  lines.push(col('Fuel:', fmtD(r.quote.fuel, 2)));
  if (r.salesTax > 0) lines.push(col('Sales tax (' + state.values.salesTaxRate + '%):', fmtD(r.salesTax, 2)));
  lines.push('  ─────────────────────────────────');
  lines.push(col('TOTAL DUE:', fmtD(r.customerTotal, 2)));
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
  copyText(lines.join('\n'), '✓ Customer quote copied!');
});

let toastTimer;
function toast(msg) {
  clearTimeout(toastTimer);
  $.toast.textContent = msg;
  $.toast.classList.add('show');
  toastTimer = setTimeout(function () { $.toast.classList.remove('show'); }, 3200);
}

$.bkToggle.addEventListener('click', function () {
  const open = $.bkBody.classList.toggle('open');
  this.classList.toggle('open', open);
  this.setAttribute('aria-expanded', open);
  $.bkLabel.textContent = open ? 'Hide Cost Breakdown' : 'View Full Cost Breakdown';
});

function closeTips(except) {
  document.querySelectorAll('.tip').forEach(function (o) {
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
document.querySelectorAll('.tip').forEach(function (t) {
  if (!t.hasAttribute('aria-expanded')) t.setAttribute('aria-expanded', 'false');
  t.addEventListener('pointerdown', function () { t._tipPointer = true; });
  t.addEventListener('focusin', function () {
    if (t._tipPointer) return;
    setTipOpen(t, true);
  });
  t.addEventListener('focusout', function () {
    t._tipPointer = false;
    setTipOpen(t, false);
  });
  t.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    t._tipPointer = false;
    setTipOpen(t, !t.classList.contains('active'));
  });
  t.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      setTipOpen(t, false);
      t.blur();
    }
  });
});
document.addEventListener('click', function () { closeTips(); });
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape' && e.key !== 'Esc') return;
  closeTips();
  const focused = document.activeElement;
  if (focused && focused.classList && focused.classList.contains('tip')) focused.blur();
});

document.querySelectorAll('.tip-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    const item = this.closest('.tip-item');
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.tip-item').forEach(function (el) {
      el.classList.remove('open');
      el.querySelector('.tip-btn').setAttribute('aria-expanded', 'false');
    });
    if (!wasOpen) {
      item.classList.add('open');
      this.setAttribute('aria-expanded', 'true');
    }
  });
});

document.querySelectorAll('.faq-q').forEach(function (btn) {
  btn.addEventListener('click', function () {
    const item = this.closest('.faq-item');
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(function (el) {
      el.classList.remove('open');
      el.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
    });
    if (!wasOpen) {
      item.classList.add('open');
      this.setAttribute('aria-expanded', 'true');
    }
  });
});

G('qsToggle').addEventListener('click', function () {
  const open = G('qsPanel').classList.toggle('open');
  this.classList.toggle('open', open);
  this.setAttribute('aria-expanded', open);
  updateStickyBar();
});

const stickyBar = G('stickyResults');
const resultsPanel = G('resultsPanel');
const calcCardEl = document.querySelector('.calc-card');
function updateStickyBar() {
  if (!stickyBar || !resultsPanel || !calcCardEl) return;
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
G('stickyResultsBtn').addEventListener('click', function () {
  resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
updateStickyBar();

[$.hours, $.workers, $.labor, $.matCost, $.overhead, $.drive, $.fuel, $.profit].forEach(function (el) {
  if (!el) return;
  el.addEventListener('input', update);
  el.addEventListener('change', update);
});
if ($.matMark) {
  $.matMark.addEventListener('input', function () {
    markupNote = '';
    update();
    saveMarkup();
  });
  ['change', 'blur'].forEach(function (ev) {
    $.matMark.addEventListener(ev, function () {
      showMarkupMessage(true);
      saveMarkup();
      update();
    });
  });
}

restoreMarkup();
[$.staxRate, $.inclStax].forEach(function (el) {
  if (!el) return;
  el.addEventListener('input', update);
  el.addEventListener('change', update);
});

update();
