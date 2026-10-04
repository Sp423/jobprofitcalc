#!/usr/bin/env python3
"""Recompute every worked example in the blog posts under the PR #47 engine.

Port of priceJob() in js/pricing.js at PR #47 head 86eb071:
  labor       = rc(hours * workers * rate * 100)
  drive_labor = rc(drive_hours * workers * rate * 100)
  materials   = rc(material cost * 100)                 at cost; there is no markup
  direct      = labor + drive_labor + materials         overhead base, fuel excluded
  overhead    = rc(direct * overhead% / 100)
  total_cost  = direct + overhead + fuel
  price       = rc(total_cost * 100 / (100 - margin%))  clamped so margin stays under 95%
  profit      = price - total_cost
  set_aside   = rc(profit * 0.9235 * 0.153)             SE tax only, informational, not in price

Amounts are integer cents. rc() is JavaScript Math.round (half up) applied after
toPrecision(15), the same as the browser, so results match to the cent.

For each example the script prints the computed lines and checks that every
figure it returns appears verbatim in the post's HTML, then checks that no
stale strings from the old engine remain. Exit code 1 on any problem.

Usage: python3 scripts/verify_post_examples.py [--summary]
  --summary  print one count per example instead of every figure
"""

import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLOG = os.path.join(ROOT, "blog")

SE_NET_FACTOR = 0.9235
SE_RATE = 0.153


def js_round(x):
    """JavaScript Math.round: nearest integer, halves toward +infinity."""
    f = math.floor(x)
    return f + 1 if x - f >= 0.5 else f


def rc(x):
    """pricing.js rc(): Math.round(Number(x.toPrecision(15)))."""
    return js_round(float("{:.15g}".format(x)))


def cents(dollars):
    return rc(dollars * 100)


MARGIN_CAP = 95


def price_job(hours, workers, rate, materials, overhead, drive, fuel, margin):
    assert 0 <= margin < MARGIN_CAP
    labor = cents(hours * workers * rate)
    drive_labor = cents(drive * workers * rate)
    mat = cents(materials)
    fuel_c = cents(fuel)
    direct = labor + drive_labor + mat
    oh = rc(direct * overhead / 100)
    total = direct + oh + fuel_c
    price = rc(total * 100 / float("{:.12g}".format(100 - margin)))
    if total > 0 and price >= total * 20:
        price = total * 20 - 1
    profit = price - total
    labor_hours = hours * workers
    return {
        "labor": labor,
        "drive_labor": drive_labor,
        "materials": mat,
        "direct": direct,
        "overhead": oh,
        "fuel": fuel_c,
        "total_cost": total,
        "price": price,
        "profit": profit,
        "margin_pct": (profit / price * 100) if price else 0.0,
        "profit_per_labor_hour": rc(profit / labor_hours) if labor_hours else None,
        "set_aside": rc(profit * SE_NET_FACTOR * SE_RATE),
    }


def usd(c):
    neg = c < 0
    s = "${:,.2f}".format(abs(c) / 100)
    return "-" + s if neg else s


def usd0(c):
    """Whole dollars, for prose that rounds (e.g. '$73 an hour')."""
    return "${:,}".format(js_round(c / 100))


# ---------------------------------------------------------------------------
# Examples. Each entry: post file, example name, inputs, and a function that
# returns {label: display string} for every figure the post prints. Every
# display string must appear verbatim in the HTML.
# ---------------------------------------------------------------------------

EXAMPLES = []


def example(post, name, **inputs):
    def deco(fn):
        EXAMPLES.append((post, name, inputs, fn))
        return fn
    return deco


def std_lines(r):
    return {
        "labor": usd(r["labor"]),
        "drive labor": usd(r["drive_labor"]),
        "materials": usd(r["materials"]),
        "direct": usd(r["direct"]),
        "overhead": usd(r["overhead"]),
        "fuel": usd(r["fuel"]),
        "total cost": usd(r["total_cost"]),
        "price": usd(r["price"]),
        "profit": usd(r["profit"]),
    }


# ---- how-to-price-leaf-cleanup.html ---------------------------------------
LEAF = "how-to-price-leaf-cleanup.html"
LEAF_BASE = dict(workers=1, rate=40, overhead=15, margin=20)


@example(LEAF, "Solo, dry", hours=3, materials=30, drive=0.75, fuel=12, **LEAF_BASE)
def _(r):
    return std_lines(r)


@example(LEAF, "Two-person crew, dry", hours=1.75, materials=30, drive=0.75, fuel=12,
         **{**LEAF_BASE, "workers": 2})
def _(r):
    return std_lines(r)


@example(LEAF, "Minimum charge job", hours=0.75, materials=0, drive=0.5, fuel=8, **LEAF_BASE)
def _(r):
    return std_lines(r)


@example(LEAF, "Solo, wet", hours=4.25, materials=55, drive=0.75, fuel=12, **LEAF_BASE)
def _(r):
    return std_lines(r)


@example(LEAF, "Solo, dry, overtime $55", hours=3, materials=30, drive=0.75, fuel=12,
         **{**LEAF_BASE, "rate": 55})
def _(r):
    return std_lines(r)


@example(LEAF, "Fall program visit", hours=1.5, materials=15, drive=0.25, fuel=5, **LEAF_BASE)
def _(r):
    return std_lines(r)


@example(LEAF, "Skipped-visit trip fee", hours=0.25, materials=0, drive=0.25, fuel=5, **LEAF_BASE)
def _(r):
    return {"price": usd(r["price"])}


@example(LEAF, "Catch-up visit", hours=2.75, materials=30, drive=0.25, fuel=5, **LEAF_BASE)
def _(r):
    return {"price": usd(r["price"])}


def leaf_derived():
    solo = price_job(hours=3, materials=30, drive=0.75, fuel=12, **LEAF_BASE)
    crew = price_job(hours=1.75, materials=30, drive=0.75, fuel=12, **{**LEAF_BASE, "workers": 2})
    wet = price_job(hours=4.25, materials=55, drive=0.75, fuel=12, **LEAF_BASE)
    visit = price_job(hours=1.5, materials=15, drive=0.25, fuel=5, **LEAF_BASE)
    program_price = 3 * visit["price"]
    program_profit = 3 * visit["profit"]
    discounted_profit = program_profit - 3000
    discounted_margin = discounted_profit / (program_price - 3000) * 100
    return {
        "crew minus solo price": usd(crew["price"] - solo["price"]),
        "crew minus solo cost": usd(crew["total_cost"] - solo["total_cost"]),
        "overhead on extra crew labor": usd(crew["overhead"] - solo["overhead"]),
        "wet minus dry price": usd(wet["price"] - solo["price"]),
        "wet vs dry price, % more": "{:.0f}%".format((wet["price"] / solo["price"] - 1) * 100),
        "wet cost minus dry price (loss)": usd(wet["total_cost"] - solo["price"]),
        "solo travel (drive labor + fuel)": usd0(solo["drive_labor"] + solo["fuel"]),
        "solo drive + fuel + dump": usd(solo["drive_labor"] + solo["fuel"] + solo["materials"]),
        "solo price per shop hour (3.75)": usd0(solo["price"] / 3.75),
        "program price (3 visits)": usd(program_price),
        "program profit (3 visits)": usd(program_profit),
        "program profit after $30 discount": usd(discounted_profit),
        "program margin after $30 discount": "{:.1f}%".format(discounted_margin),
    }


DERIVED = {LEAF: leaf_derived}

# ---- how-to-price-sprinkler-blowouts.html ---------------------------------
SPRINK = "how-to-price-sprinkler-blowouts.html"
SPRINK_BASE = dict(hours=0.5, workers=1, rate=45, materials=21, overhead=15, drive=0.25, fuel=4, margin=20)


def sprink(**over):
    return {**SPRINK_BASE, **over}


@example(SPRINK, "Baseline, 6 zones, solo", **sprink())
def _(r):
    return std_lines(r)


@example(SPRINK, "14 zones (0.83 hr)", **sprink(hours=0.83))
def _(r):
    return {"price": usd(r["price"])}


@example(SPRINK, "Scenario B, 6 stops ($42 compressor)", **sprink(materials=42))
def _(r):
    return {"price": usd(r["price"])}


@example(SPRINK, "Scenario C, no compressor cost", **sprink(materials=0))
def _(r):
    return {"price": usd(r["price"])}


@example(SPRINK, "Dense route (0 drive, $0 fuel)", **sprink(drive=0, fuel=0))
def _(r):
    return {"price": usd(r["price"])}


@example(SPRINK, "Scattered route (0.6 hr, $8 fuel)", **sprink(drive=0.6, fuel=8))
def _(r):
    return {"price": usd(r["price"])}


@example(SPRINK, "2-zone minimum (0.33 hr)", **sprink(hours=0.33))
def _(r):
    return {"labor": usd(r["labor"]), "price": usd(r["price"])}


@example(SPRINK, "Two-person crew", **sprink(workers=2))
def _(r):
    return std_lines(r)


@example(SPRINK, "Late season, priced like a route stop", **sprink(hours=0.75))
def _(r):
    return {"price": usd(r["price"])}


@example(SPRINK, "Late season one-off", **sprink(hours=0.75, rate=67.5, drive=0.75, fuel=12, materials=175))
def _(r):
    return {"total cost": usd(r["total_cost"]), "price": usd(r["price"])}


@example(SPRINK, "Spring start-up", **sprink(hours=0.75, materials=0, fuel=3))
def _(r):
    return {"price": usd(r["price"])}


def sprink_derived():
    base = price_job(**sprink())
    big = price_job(**sprink(hours=0.83))
    b = price_job(**sprink(materials=42))
    dense = price_job(**sprink(drive=0, fuel=0))
    scattered = price_job(**sprink(drive=0.6, fuel=8))
    mini = price_job(**sprink(hours=0.33))
    crew = price_job(**sprink(workers=2))
    spring = price_job(**sprink(hours=0.75, materials=0, fuel=3))
    gap = big["price"] - base["price"]
    return {
        "14-zone minus 6-zone price": usd(gap),
        "per added zone (gap / 8)": usd(js_round(gap / 8)),
        "Scenario B minus A": usd0(b["price"] - base["price"]),
        "scattered minus dense": usd0(scattered["price"] - dense["price"]),
        "6-zone minus 2-zone": usd0(base["price"] - mini["price"]),
        "crew minus solo": usd(crew["price"] - base["price"]),
        "compressor + travel": usd(base["materials"] + base["drive_labor"] + base["fuel"]),
        "fall + spring package": usd(base["price"] + spring["price"]),
    }


DERIVED[SPRINK] = sprink_derived


# ---- how-to-price-a-contractor-job.html -----------------------------------
JOB = "how-to-price-a-contractor-job.html"
JOB_IN = dict(hours=3, workers=1, rate=71.43, materials=650, overhead=20, drive=0.5, fuel=15, margin=20)


@example(JOB, "Water heater replacement", **JOB_IN)
def _(r):
    out = std_lines(r)
    out["set-aside"] = usd(r["set_aside"])
    return out


def job_derived():
    r = price_job(**JOB_IN)
    drive_one_person = cents(1.5 * 71.43)
    return {
        "loaded rate ($100,000 / 1,400)": "${:.2f}".format(100000 / 1400),
        "profit at $1,100 gut-feel price": usd(110000 - r["total_cost"]),
        "profit at $1,200 gut-feel price": usd(120000 - r["total_cost"]),
        "1.5 hr drive at $71.43": usd(drive_one_person),
        "x 200 calls": "${:,}".format(js_round(200 * drive_one_person / 100)),
        "SE tax on $500 profit": usd(js_round(50000 * SE_NET_FACTOR * SE_RATE)),
    }


DERIVED[JOB] = job_derived


# ---- hvac-component-swap-vs-changeout.html --------------------------------
HVAC = "hvac-component-swap-vs-changeout.html"


@example(HVAC, "Path A, component swap", hours=5, workers=1, rate=45, materials=2000,
         overhead=15, drive=0.5, fuel=17.5, margin=25)
def _(r):
    out = std_lines(r)
    out["profit per labor hour"] = usd(r["profit_per_labor_hour"])
    return out


@example(HVAC, "Path B, full changeout", hours=9, workers=2, rate=45, materials=4110,
         overhead=15, drive=1.0, fuel=35, margin=25)
def _(r):
    out = std_lines(r)
    out["profit per labor hour"] = usd(r["profit_per_labor_hour"])
    return out


# ---- after-hours-rate-for-contractors.html --------------------------------
AFTER = "after-hours-rate-for-contractors.html"
AFTER_IN = dict(hours=1.5, workers=1, rate=55.50, materials=32, overhead=18, drive=0.5, fuel=0, margin=40)


@example(AFTER, "Saturday no-cool call, after-hours $55.50", **AFTER_IN)
def _(r):
    return std_lines(r)


@example(AFTER, "Same call priced at daytime $37.00", **{**AFTER_IN, "rate": 37})
def _(r):
    return {"price": usd(r["price"])}


def after_derived():
    ot = price_job(**AFTER_IN)
    day = price_job(**{**AFTER_IN, "rate": 37})
    profit = day["price"] - ot["total_cost"]
    return {
        "safe method $37.00 x 1.5": "${:.2f}".format(37 * 1.5),
        "precise method": "${:.2f}".format((28 + 4.30) * 1.5 + 4.70),
        "weighted rate (6 ST + 2 OT)": "${:.2f}".format(js_round((6 * 37 + 2 * 55.5) / 8 * 100) / 100),
        "daytime price minus real cost": usd(profit),
        "resulting margin": "{:.1f}%".format(profit / day["price"] * 100),
    }


DERIVED[AFTER] = after_derived


# ---- callback-reserve-for-contractors.html --------------------------------
CALLBACK = "callback-reserve-for-contractors.html"
CB_IN = dict(hours=8, workers=1, rate=65, materials=1400, overhead=18, drive=0.5, fuel=27.5, margin=20)
CB_RESERVE = 4150      # 0.20 x 2.5 hr x $65 + 0.20 x $45, in cents
CB_COST = 13000 + 4500  # one return: 2 hr x $65 + $45 drive and fuel
CB_RATE = 0.20


def cb_reserve_pct():
    direct = price_job(**CB_IN)["direct"]
    return round(CB_RESERVE / direct * 100, 2)


@example(CALLBACK, "Install, no callback buffer", **CB_IN)
def _(r):
    out = std_lines(r)
    out["profit after one callback"] = usd(r["profit"] - CB_COST)
    out["margin after one callback"] = "{:.1f}%".format((r["profit"] - CB_COST) / r["price"] * 100)
    return out


@example(CALLBACK, "Install, reserve folded into Overhead % (18% + 2.13%)",
         **{**CB_IN, "overhead": 18 + 2.13})
def _(r):
    return {"overhead": usd(r["overhead"]), "total cost": usd(r["total_cost"]),
            "price": usd(r["price"]), "profit": usd(r["profit"])}


def cb_derived():
    base = price_job(**CB_IN)
    pct = cb_reserve_pct()
    res = price_job(**{**CB_IN, "overhead": 18 + pct})
    real_no_cb = res["price"] - base["total_cost"]
    real_cb = real_no_cb - CB_COST
    return {
        "reserve per job": usd(CB_RESERVE),
        "reserve / (1 - margin)": usd(js_round(CB_RESERVE / 0.8)),
        "reserve % of direct cost": "{:.2f}%".format(pct),
        "price increase": usd(res["price"] - base["price"]),
        "reserve collected in cost": usd(res["total_cost"] - base["total_cost"]),
        "no-callback job, real profit": usd(real_no_cb),
        "no-callback job, real margin": "{:.1f}%".format(real_no_cb / res["price"] * 100),
        "callback job with reserve": usd(real_cb),
        "callback job with reserve, margin": "{:.1f}%".format(real_cb / res["price"] * 100),
        "category avg margin, with reserve": "{:.1f}%".format(
            (real_no_cb - CB_RATE * CB_COST) / res["price"] * 100),
        "category avg margin, without": "{:.1f}%".format(
            (base["profit"] - CB_RATE * CB_COST) / base["price"] * 100),
    }


DERIVED[CALLBACK] = cb_derived


# ---- should-contractors-waive-diagnostic-fee.html -------------------------
DIAG = "should-contractors-waive-diagnostic-fee.html"
# 30 min each way = 1.0 hr round-trip Drive Time.
DIAG_IN = dict(hours=1, workers=1, rate=75, materials=0, overhead=22, drive=1.0, fuel=0, margin=35)
REPAIR_IN = dict(hours=2.5, workers=1, rate=75, materials=320, overhead=22, drive=0, fuel=0, margin=35)
SMALL_IN = dict(hours=0.5, workers=1, rate=75, materials=40, overhead=22, drive=0, fuel=0, margin=35)
DIAG_FEE = 16500


def pct(num, den):
    return "{:.1f}%".format(num / den * 100)


@example(DIAG, "Pass 1, diagnostic visit (30 min each way)", **DIAG_IN)
def _(r):
    loss = r["total_cost"] - DIAG_FEE
    assert loss > 0
    return {"labor": usd(r["labor"]), "drive labor": usd(r["drive_labor"]),
            "direct": usd(r["direct"]), "overhead": usd(r["overhead"]),
            "total cost": usd(r["total_cost"]),
            "loss at $165 flat fee": "−" + usd(loss),
            "loss as % of the $165 fee": pct(loss, DIAG_FEE) + " loss",
            "fee that hits 35% (suggested charge)": usd(r["price"]),
            "profit at that fee": usd(r["profit"])}


@example(DIAG, "Pass 2, repair, no drive", **REPAIR_IN)
def _(r):
    return std_lines(r)


@example(DIAG, "Small same-visit repair", **SMALL_IN)
def _(r):
    return {"labor": usd(r["labor"]), "overhead": usd(r["overhead"]), "total cost": usd(r["total_cost"])}


def diag_derived():
    d = price_job(**DIAG_IN)["total_cost"]
    rep = price_job(**REPAIR_IN)
    small = price_job(**SMALL_IN)["total_cost"]
    cost = d + rep["total_cost"]
    p = rep["price"]
    out = {"combined cost": usd(cost)}
    a_rev = DIAG_FEE + p
    out["A revenue"] = usd(a_rev)
    out["A profit"] = usd(a_rev - cost)
    out["A margin"] = pct(a_rev - cost, a_rev)
    out["B repair charged"] = usd(p - DIAG_FEE)
    out["B profit"] = usd(p - cost)
    out["B margin"] = pct(p - cost, p)
    c_rev = a_rev - 8200
    out["C repair charged"] = usd(p - 8200)
    out["C revenue"] = usd(c_rev)
    out["C profit"] = usd(c_rev - cost)
    out["C margin"] = pct(c_rev - cost, c_rev)
    need = rc(cost * 100 / 65)
    out["D revenue needed"] = usd(need)
    out["D repair invoice before credit"] = usd(need)
    out["D customer pays on repair"] = usd(need - DIAG_FEE)
    out["D profit"] = usd(need - cost)
    out["D margin"] = pct(need - cost, need)
    p75 = a_rev - 7500
    out["$75 partial revenue"] = usd(p75)
    out["$75 partial margin"] = pct(p75 - cost, p75)
    big_cost = d + rc(240000 * 0.65)
    out["$2,400 repair, keep fee, margin"] = "{:.0f}%".format((240000 + DIAG_FEE - big_cost) / (240000 + DIAG_FEE) * 100)
    out["$2,400 repair, credit, margin"] = "{:.0f}%".format((240000 - big_cost) / 240000 * 100)
    out["small combined cost"] = usd(d + small)
    out["small keep-both profit"] = usd(DIAG_FEE + 20000 - d - small)
    out["small credit loss"] = usd(d + small - 20000)
    fee_ok = price_job(**DIAG_IN)["price"]
    out["fee priced off cost + repair"] = usd(fee_ok + p)
    out["fee priced off cost, combined margin"] = pct(fee_ok + p - cost, fee_ok + p)
    return out


DERIVED[DIAG] = diag_derived


# ---- change-order-premium-for-contractors.html ----------------------------
CO = "change-order-premium-for-contractors.html"
CO_A = dict(hours=4, workers=2, rate=45, materials=240, overhead=16, drive=0, fuel=0, margin=22)
# One of two plumbers makes a 0.75 hr supply run; Drive Time is x workers, so enter 0.375.
CO_B = dict(hours=4.5, workers=2, rate=45, materials=240, overhead=16, drive=0.375, fuel=0, margin=22)


@example(CO, "Pass A, bid-rate baseline", **CO_A)
def _(r):
    return {"labor": usd(r["labor"]), "materials": usd(r["materials"]), "direct": usd(r["direct"]),
            "overhead": usd(r["overhead"]), "total cost": usd(r["total_cost"]), "price": usd(r["price"])}


@example(CO, "Pass B, friction hours captured, same rate", **CO_B)
def _(r):
    return std_lines(r)


def co_derived():
    a = price_job(**CO_A)
    b = price_job(**CO_B)
    friction_labor = cents(1.75 * 45)
    friction_oh = js_round(friction_labor * 0.16)
    true_cost = a["total_cost"] + friction_labor + friction_oh
    return {
        "friction labor (1.75 x $45)": usd(friction_labor),
        "overhead on friction": usd(friction_oh),
        "unrecovered friction": usd(friction_labor + friction_oh),
        "true cost of Pass A work": usd(true_cost),
        "Pass A true margin": "{:.1f}%".format((a["price"] - true_cost) / a["price"] * 100),
        "Pass B minus Pass A": usd(b["price"] - a["price"]),
        "ten change orders": "${:,}".format((b["price"] - a["price"]) * 10 // 100 // 100 * 100),
    }


DERIVED[CO] = co_derived


HOURLY = "how-to-calculate-contractor-hourly-rate.html"


def se_tax(net_dollars):
    """SE tax per IRS: net SE earnings x 92.35% x 15.3%, in cents."""
    return js_round(cents(net_dollars) * SE_NET_FACTOR * SE_RATE)


# 2026 federal figures, single filer (IRS Rev. Proc. 2025-32).
STD_DEDUCTION_2026 = 16100
BRACKETS_2026 = [(12400, 0.10), (50400, 0.12), (105700, 0.22)]
# Idaho Form 40 TY2025 (latest posted, EFO00089 03-02-2026): federal AGI, minus
# the $15,750 single standard deduction, minus federal QBI, then the TY2025
# schedule (first $4,811 at 0%, the rest at 5.3%).
IDAHO_STD_DEDUCTION = 15750
IDAHO_ZERO_BRACKET = 4811
IDAHO_RATE = 0.053
QBI_RATE = 0.20


def qbi_deduction(qbi, taxable_before):
    """Lesser of 20% of QBI or 20% of taxable income before the QBI deduction."""
    return min(js_round(qbi * QBI_RATE), js_round(taxable_before * QBI_RATE))


def federal_tax_2026(taxable):
    tax, lower = 0, 0
    for upper, rate in BRACKETS_2026:
        tax += max(0, min(taxable, upper) - lower) * rate
        lower = upper
    return js_round(tax)


def idaho_taxable_income(agi, qbi_ded):
    return max(0, agi - IDAHO_STD_DEDUCTION - qbi_ded)


def idaho_tax(idaho_ti):
    return js_round(max(0, idaho_ti - IDAHO_ZERO_BRACKET) * IDAHO_RATE)


def hourly_derived():
    target = 72000
    se = js_round(se_tax(target) / 100)
    half = js_round(se / 2)
    agi = target - half
    taxable_before = agi - STD_DEDUCTION_2026
    qbi_ded = qbi_deduction(agi, taxable_before)
    taxable = taxable_before - qbi_ded
    fed = federal_tax_2026(taxable)
    idaho_ti = idaho_taxable_income(agi, qbi_ded)
    state = idaho_tax(idaho_ti)
    need = target + se + fed + state + 7200 + 3600
    working = -(-need // 1000) * 1000  # post rounds the need up to the next $1,000
    floor = cents(working / 1400)
    return {
        "SE tax on $72,000 (whole dollars)": "${:,}".format(se),
        "half SE deduction": "${:,}".format(half),
        "taxable income before QBI": "${:,}".format(taxable_before),
        "QBI deduction": "${:,}".format(qbi_ded),
        "federal taxable income": "${:,}".format(taxable),
        "federal income tax (2026, single)": "${:,}".format(fed),
        "Idaho standard deduction (single)": "${:,}".format(IDAHO_STD_DEDUCTION),
        "Idaho taxable income": "${:,}".format(idaho_ti),
        "Idaho tax (Form 40)": "${:,}".format(state),
        "total annual need": "${:,}".format(need),
        "rounded working number": "${:,}".format(working),
        "minimum hourly rate": usd(floor) + "/hr",
        "buffered sanity-check rate": usd(js_round(floor * 1.20)) + "/hr",
    }


DERIVED[HOURLY] = hourly_derived


SETAX = "self-employment-tax-for-contractors.html"


def setax_derived():
    net = 78000
    se_base = js_round(net * SE_NET_FACTOR)
    se = js_round(net * SE_NET_FACTOR * SE_RATE)
    half = js_round(se / 2)
    agi = net - half
    taxable_before = agi - STD_DEDUCTION_2026
    qbi_ded = qbi_deduction(agi, taxable_before)
    taxable = taxable_before - qbi_ded
    fed, lower, rows = 0, 0, {}
    for upper, rate in BRACKETS_2026:
        portion = max(0, min(taxable, upper) - lower)
        if portion <= 0:
            lower = upper
            continue
        tax = js_round(portion * rate)
        rows["{:.0f}% bracket tax".format(rate * 100)] = "${:,}".format(tax)
        rows["{:.0f}% bracket portion".format(rate * 100)] = "${:,}".format(portion)
        fed += portion * rate
        lower = upper
    fed = js_round(fed)
    idaho_ti = idaho_taxable_income(agi, qbi_ded)
    state = idaho_tax(idaho_ti)
    burden = se + fed + state
    eff = burden / net
    out = {
        "net x 92.35%": "${:,}".format(se_base),
        "SE tax": "${:,}".format(se),
        "half SE deduction": "${:,}".format(half),
        "2026 standard deduction": "${:,}".format(STD_DEDUCTION_2026),
        "taxable income before QBI": "${:,}".format(taxable_before),
        "QBI deduction": "${:,}".format(qbi_ded),
        "federal taxable income": "${:,}".format(taxable),
    }
    out.update(rows)
    out.update({
        "federal income tax": "${:,}".format(fed),
        "Idaho standard deduction (single)": "${:,}".format(IDAHO_STD_DEDUCTION),
        "Idaho taxable income": "${:,}".format(idaho_ti),
        "Idaho tax (Form 40)": "${:,}".format(state),
        "total tax burden": "${:,}".format(burden),
        "take-home": "${:,}".format(net - burden),
        "effective rate": "~{:.1f}%".format(eff * 100),
        "after-tax on $1,000 profit": "${:,}".format(js_round(1000 * (1 - eff))),
        "after-tax on $500 profit": "${:,}".format(js_round(500 * (1 - eff))),
        "cents kept per profit dollar": "about {:.0f} cents".format((1 - eff) * 100),
    })
    return out


DERIVED[SETAX] = setax_derived


ESTIMATE = "how-to-write-contractor-estimate.html"
OVERHEAD = "contractor-overhead-percentage.html"


# $500 labor (10 hrs x 1 worker x $50 example cost) + $800 materials, 20% overhead.
@example(OVERHEAD, "Apply overhead to a bid", hours=10, workers=1, rate=50, materials=800,
         overhead=20, drive=0, fuel=0, margin=0)
def _(r):
    return {"labor": usd0(r["labor"]), "materials": usd0(r["materials"]), "direct": usd0(r["direct"]),
            "overhead": usd0(r["overhead"]), "cost basis before profit": usd0(r["total_cost"])}


def overhead_derived():
    return {"overhead rate from the books": "{:.1f}%".format(12500 / (38000 + 22000) * 100)}


DERIVED[OVERHEAD] = overhead_derived


# Strings from the old engine that must not appear in any post in scope.
POSTS = [
    "how-to-use-the-job-profit-calculator.html",
    "how-to-price-leaf-cleanup.html",
    "how-to-price-sprinkler-blowouts.html",
    "how-to-price-a-contractor-job.html",
    "hvac-component-swap-vs-changeout.html",
    "after-hours-rate-for-contractors.html",
    "callback-reserve-for-contractors.html",
    "should-contractors-waive-diagnostic-fee.html",
    "change-order-premium-for-contractors.html",
    "how-to-calculate-contractor-hourly-rate.html",
    "self-employment-tax-for-contractors.html",
    "how-to-write-contractor-estimate.html",
    "contractor-overhead-percentage.html",
]
STALE_EVERYWHERE = [
    "SE + State Tax", "SE Tax (on costs)", "State Tax (on costs)", "SE Tax Rate",
    "Overhead &amp; Burden", "Overhead & Burden", "Effective $/hr", "effective $/hr", "20.3%",
    # PR #47 head 86eb071 has no Material Markup field or breakdown row.
    # The estimate post may name the optional field that is coming back.
    "Material Markup", "Material markup", "0% markup", "markup (not added)", "reported in dollars",
    "reported only", "markup box", "Rate: $26", "$26 an hour",
    # Unsourced figures replaced with sourced ones (Pulse sourcing check, Oct 2026).
    "1,000–1,600", "1,200–1,400 hours", "$80–$130/hr", "between $75 and $150 per hour",
    "$15–$20 extra per additional assembly", "$50,000+", "earning enough to make it worthwhile",
    "between 1,000 and 1,500 hours", "1,400–1,600", "800–1,000", "realistic starting point",
    "the realistic number is 1,200",
    # Final QA (Hank, Oct 2 2026): Idaho is not a flat 5.3%; first $4,811 is taxed at 0%.
    "flat 5.3%", "5.3% flat", "Idaho 5.3%",
]
# Old example figures that must be gone after the rerun.
STALE = {
    LEAF: ["$322.55", "$258.04", "$402.25", "$93.98", "$452.25", "$417.29", "$152.25",
           "$456.76", "$39.85", "$264.66", "$214.50"],
    SPRINK: ["$98.16", "$123.84", "$134.47", "$61.84", "$75.23", "$127.86", "$84.93",
             "$153.98", "$117.61", "$484.35", "$387.48", "$79.79", "$177.95", "$3.21",
             "the Workers field"],
    HVAC: ["$5,548.50", "$2,800 marked-up", "Tax % fields", "$1,530"],
    AFTER: ["~$263", "~$183", "This matches two separate runs"],
    CALLBACK: ["$3,200", "19.3%", "19.5%", "$469", "14.7%", "18.6%", "Gross margin", "of revenue)",
               "it has to raise the price"],
    DIAG: ["$845", "$678", "$129", "$1,010", "$1,043", "$878", "$713", "21.8%", "32.9%",
           "19.8%", "$96.00", "$227", "15 min each way", "$137.25", "$27.75", "16.8%", "$756.40",
           "$1,163.69", "$998.69", "$361.14", "$196.14", "$279.14", "$407.29", "$231.80",
           "$31.80", "32.3%", "20.6%", "27.0%", "27.4%", "about 29%", "only profitable hour",
           "only profitable line", "In this article's example, the suggested charge is $281.54",
           "sits $18.00 below"],
    CO: ["$185.80", "$1,352.05", "$1,733", "$1,428", "$1,113.60", "$157.50", "$305",
         "$90 / hr", "$95 / hr", "overhead dilution", "charge-out rate to",
         '<span class="calc-val">0.75 hrs</span>'],
    HOURLY: ["$11,016", "5.8%", "$4,176", "$107,992", "$108,000", "$77.14", "$77/hr",
             "rate you should be quoting for your direct labor", "Self-employment and state income tax",
             "typically 15–30% above your cost", "$3,816", "$106,789", "$107,000", "$76.43",
             "$91.72", "about $92", "$92 as the labor rate", "Federal income tax (est.)",
             "$8,000–$12,000", "22% federal bracket", "$75 – $150", "$80 – $130", "$85 – $150",
             "Roofer", "General Contractor", "Carpenter (finish)", "Flooring Installer", "Painter",
             "Landscaper</td>", "$55 – $90", "rough illustrations",
             "$5,891", "$102,425", "$103,000", "$73.57", "$88.28",
             "$3,561", "$101,164", "$102,000", "$72.86", "$87.43"],
    SETAX: ["$14,600", "$57,889", "$7,788", "$2,362", "$23,209", "$54,791", "29.8%", "5.8%",
            "2024", "$160,000–$170,000", "full tax burden", "gross payments", "Enter your SE tax rate",
            "price it into every job", "$4,134", "$22,273", "$55,727", "$55,700", "28.6%",
            "71 cents", "about $71", "$0.71", "$714", "$357",
            "$7,118", "$22,018", "$55,982", "28.2%", "$718", "$359",
            "$3,879", "$20,065", "$57,935", "25.7%", "$743", "$371", "$0.74"],
    ESTIMATE: ["and tax rates"],
    OVERHEAD: ["before profit and taxes", "(labor + materials) on every job", "5–8 percentage points",
               "5–8 points", "Studies of trade contractor", "3–5 points", "a healthy range is"],
    "how-to-use-the-job-profit-calculator.html": [
        "very top of the calculator", "Adjust them once", "stored anywhere", "stored on a server",
        "Revisit your default inputs", "settings and defaults are dialed in"],
    JOB: ["$1,933.28", "$1,546.62", "$386.66", "$208.12", "$812.50", "$85/hr", "$25,500"],
}
# Approved estimate copy names the optional Material Markup field.
STALE_ALLOW = {
    ESTIMATE: ["Material Markup"],
    JOB: ["Material Markup"],
    DIAG: ["Material Markup"],
}


def main():
    summary = "--summary" in sys.argv[1:]
    missing = 0
    current_post = None
    ordered = []
    for post in POSTS:
        ordered += [e for e in EXAMPLES if e[0] == post]
        if post in DERIVED:
            ordered.append((post, "Derived figures", None, DERIVED[post]))
    for post, name, inputs, fn in ordered:
        path = os.path.join(BLOG, post)
        html = open(path, encoding="utf-8").read()
        if post != current_post:
            print("=" * 72)
            print(post)
            print("=" * 72)
            current_post = post
        if inputs is None:
            figures = fn()
            print("\n  {}".format(name))
        else:
            r = price_job(**inputs)
            figures = fn(r)
            print("\n  {}".format(name))
            print("    inputs: " + ", ".join("{}={}".format(k, v) for k, v in inputs.items()))
            print("    labor {}  drive labor {}  materials {}  direct {}  overhead {}  fuel {}".format(
                usd(r["labor"]), usd(r["drive_labor"]), usd(r["materials"]), usd(r["direct"]),
                usd(r["overhead"]), usd(r["fuel"])))
            print("    total cost {}  price {}  profit {}  margin {:.1f}%  set-aside {}".format(
                usd(r["total_cost"]), usd(r["price"]), usd(r["profit"]), r["margin_pct"],
                usd(r["set_aside"])))
        found = 0
        for label, text in figures.items():
            ok = text in html
            if ok:
                found += 1
            else:
                missing += 1
            if not summary or not ok:
                print("    [{}] {:<38} {}".format("ok" if ok else "MISSING", label, text))
        if summary:
            print("    {}/{} figures found in post".format(found, len(figures)))
    print()
    print("=" * 72)
    print("Stale strings from the old engine")
    print("=" * 72)
    stale_found = 0
    for post in POSTS:
        html = open(os.path.join(BLOG, post), encoding="utf-8").read()
        allow = STALE_ALLOW.get(post, [])
        hits = [t for t in STALE_EVERYWHERE + STALE.get(post, []) if t in html and t not in allow]
        stale_found += len(hits)
        print("  [{}] {}{}".format("ok" if not hits else "STALE", post,
                                    "" if not hits else ": " + ", ".join(hits)))
    print()
    missing += stale_found
    if missing:
        print("FAIL: {} problem(s): missing figures or stale strings.".format(missing))
        return 1
    print("PASS: every figure appears in its post and no stale strings remain.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
