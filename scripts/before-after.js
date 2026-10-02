/* Compare the pre-change calculator with the current engine.
   Run: node scripts/before-after.js
*/
const P = require('../js/pricing.js');

function oldCalc(input) {
  const hours = input.hours;
  const workers = Math.max(input.workers, 1);
  const laborRate = input.laborRate;
  const matCost = input.materialCost;
  const matMark = input.materialMarkup / 100;
  const ohPct = input.overhead / 100;
  const driveTime = input.driveTime;
  const fuelCost = input.fuelCost;
  const profitPct = Math.min(input.margin, 89) / 100;
  const sePct = (input.seTax == null ? 15.3 : input.seTax) / 100;
  const statePct = (input.stateTax == null ? 5 : input.stateTax) / 100;
  const totalLabor = hours * workers * laborRate;
  const matTotal = matCost * (1 + matMark);
  const markup = matCost * matMark;
  const overhead = (totalLabor + matTotal) * ohPct;
  const travel = (driveTime * laborRate) + fuelCost;
  const subtotal = totalLabor + matTotal + overhead + travel;
  const seAmt = subtotal * sePct;
  const stateAmt = subtotal * statePct;
  const totalCost = subtotal + seAmt + stateAmt;
  const suggested = totalCost / (1 - profitPct);
  const netProfit = suggested - totalCost;
  const realMargin = suggested > 0 ? (netProfit / suggested) * 100 : 0;
  const totalHrs = hours * workers;
  const effRate = totalHrs > 0 ? netProfit / totalHrs : 0;
  return {
    labor: totalLabor,
    materials: matTotal,
    materialsAtCost: matCost,
    markup,
    overhead,
    drive: travel,
    taxes: seAmt + stateAmt,
    totalCost,
    price: suggested,
    profit: netProfit,
    marginPct: realMargin,
    profitPerLaborHour: effRate
  };
}

function money(n) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const fixed = abs.toFixed(2);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + '$' + parts.join('.');
}

function row(label, before, after) {
  return '| ' + label + ' | ' + before + ' | ' + after + ' |';
}

function table(title, input) {
  const before = oldCalc(input);
  const after = P.priceJob({
    hours: input.hours,
    workers: input.workers,
    laborRate: input.laborRate,
    materialCost: input.materialCost,
    materialMarkup: input.materialMarkup,
    overhead: input.overhead,
    driveTime: input.driveTime,
    fuelCost: input.fuelCost,
    margin: input.margin
  });
  const lines = [
    '### ' + title,
    '',
    '| Line | Before | After |',
    '| --- | ---: | ---: |',
    row('Labor', money(before.labor), money(after.labor)),
    row('Materials', money(before.materialsAtCost), money(after.materials)),
    row('Materials markup', money(before.markup) + ' (inside old cost)', 'removed'),
    row('Overhead', money(before.overhead), money(after.overhead)),
    row('Drive labor', money(before.drive - input.fuelCost), money(after.driveLabor)),
    row('Fuel', money(input.fuelCost), money(after.fuel)),
    row('Taxes in the price (SE + state)', money(before.taxes), money(after.taxes)),
    row('Total cost', money(before.totalCost), money(after.totalCost)),
    row('Price', money(before.price), money(after.price)),
    row('Profit', money(before.profit), money(after.profit)),
    row('Margin %', before.marginPct.toFixed(1) + '%', after.marginPct.toFixed(1) + '%'),
    row('Profit per labor hour', money(before.profitPerLaborHour), after.profitPerLaborHour == null ? '—' : money(after.profitPerLaborHour)),
    ''
  ];
  return lines.join('\n');
}

const pageDefault = {
  hours: 4, workers: 1, laborRate: 75, materialCost: 200, materialMarkup: 20,
  overhead: 15, driveTime: 0.5, fuelCost: 10, margin: 20, seTax: 15.3, stateTax: 5
};
const hvac = {
  hours: 10, workers: 2, laborRate: 45, materialCost: 6000, materialMarkup: 10,
  overhead: 15, driveTime: 1, fuelCost: 40, margin: 20, seTax: 15.3, stateTax: 5
};

process.stdout.write(table('(a) Calculator page defaults', pageDefault));
process.stdout.write('\n');
process.stdout.write(table('(b) HVAC changeout', hvac));
