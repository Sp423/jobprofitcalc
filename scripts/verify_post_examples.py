#!/usr/bin/env python3
"""Recompute every worked example in the blog posts under the PR #47 engine.

Port of priceJob() in js/pricing.js (PR #47):
  labor       = round_cents(hours * workers * rate)
  drive_labor = round_cents(drive_hours * workers * rate)
  materials   = round_cents(material cost)              at cost, no markup
  direct      = labor + drive_labor + materials         overhead base, fuel excluded
  overhead    = round(direct * overhead%)
  total_cost  = direct + overhead + fuel
  price       = round(total_cost / (1 - margin))
  profit      = price - total_cost
  set_aside   = round(profit * 0.9235 * 0.153)          informational, not in price

Amounts are integer cents. Rounding is JavaScript Math.round (half up), so the
results match the browser to the cent.

For each example the script prints the computed lines and checks that every
figure listed under "expect" appears in the post's HTML. Exit code 1 if any
figure is missing.

Usage: python3 scripts/verify_post_examples.py
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


def cents(dollars):
    return js_round(dollars * 100)


def price_job(hours, workers, rate, materials, overhead, drive, fuel, margin):
    labor = cents(hours * workers * rate)
    drive_labor = cents(drive * workers * rate)
    mat = cents(materials)
    fuel_c = cents(fuel)
    direct = labor + drive_labor + mat
    oh = js_round(direct * (overhead / 100))
    total = direct + oh + fuel_c
    m = margin / 100
    price = total if m == 0 else js_round(total / (1 - m))
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
        "profit_per_labor_hour": js_round(profit / labor_hours) if labor_hours else None,
        "set_aside": js_round(profit * SE_NET_FACTOR * SE_RATE),
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
        "markup reported (35% of $32)": "$11.20",
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
DIAG_IN = dict(hours=1, workers=1, rate=75, materials=0, overhead=22, drive=0.5, fuel=0, margin=35)
REPAIR_IN = dict(hours=2.5, workers=1, rate=75, materials=320, overhead=22, drive=0, fuel=0, margin=35)
SMALL_IN = dict(hours=0.5, workers=1, rate=75, materials=40, overhead=22, drive=0, fuel=0, margin=35)
DIAG_FEE = 16500


def pct(num, den):
    return "{:.1f}%".format(num / den * 100)


@example(DIAG, "Pass 1, diagnostic visit (15 min each way)", **DIAG_IN)
def _(r):
    return {"labor": usd(r["labor"]), "drive labor": usd(r["drive_labor"]),
            "overhead": usd(r["overhead"]), "total cost": usd(r["total_cost"]),
            "profit at $165 flat fee": usd(DIAG_FEE - r["total_cost"]),
            "margin at $165 flat fee": pct(DIAG_FEE - r["total_cost"], DIAG_FEE)}


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
    need = js_round(cost / 0.65)
    out["D revenue needed"] = usd(need)
    out["D repair invoice before credit"] = usd(need)
    out["D customer pays on repair"] = usd(need - DIAG_FEE)
    out["D profit"] = usd(need - cost)
    out["D margin"] = pct(need - cost, need)
    p75 = a_rev - 7500
    out["$75 partial revenue"] = usd(p75)
    out["$75 partial margin"] = pct(p75 - cost, p75)
    big_cost = d + js_round(240000 * 0.65)
    out["$2,400 repair, keep fee, margin"] = "{:.0f}%".format((240000 + DIAG_FEE - big_cost) / (240000 + DIAG_FEE) * 100)
    out["$2,400 repair, credit, margin"] = "{:.0f}%".format((240000 - big_cost) / 240000 * 100)
    out["small combined cost"] = usd(d + small)
    out["small credit loss"] = usd(d + small - 20000)
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


def hourly_derived():
    target = 72000
    se = se_tax(target)
    state = cents(target * 0.053)
    need = cents(target) + js_round(se / 100) * 100 + cents(10000) + state + cents(7200) + cents(3600)
    working = 107000  # post rounds the need up to the next $1,000
    floor = cents(working / 1400)
    return {
        "SE tax on $72,000 (whole dollars)": usd0(se),
        "Idaho 5.3% on $72,000": usd0(state),
        "total annual need": usd0(need),
        "rounded working number": "${:,}".format(working),
        "minimum hourly rate": usd(floor) + "/hr",
        "buffered sanity-check rate": usd(js_round(floor * 1.20)) + "/hr",
    }


DERIVED[HOURLY] = hourly_derived


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
]
# Old example figures that must be gone after the rerun.
STALE = {
    LEAF: ["$322.55", "$258.04", "$402.25", "$93.98", "$452.25", "$417.29", "$152.25",
           "$456.76", "$39.85", "$264.66", "$214.50"],
    SPRINK: ["$98.16", "$123.84", "$134.47", "$61.84", "$75.23", "$127.86", "$84.93",
             "$153.98", "$117.61", "$484.35", "$387.48", "$79.79", "$177.95", "$3.21"],
    HVAC: ["$5,548.50", "$2,800 marked-up", "Tax % fields", "$1,530"],
    AFTER: ["~$263", "~$183"],
    CALLBACK: ["$3,200", "19.3%", "19.5%", "$469", "14.7%", "18.6%", "Gross margin", "of revenue)"],
    DIAG: ["$845", "$678", "$129", "$1,010", "$1,043", "$878", "$713", "21.8%", "32.9%",
           "19.8%", "$96.00", "$227", "30 min each way"],
    CO: ["$185.80", "$1,352.05", "$1,733", "$1,428", "$1,113.60", "$157.50", "$305",
         "$90 / hr", "$95 / hr", "overhead dilution", "charge-out rate to"],
    HOURLY: ["$11,016", "5.8%", "$4,176", "$107,992", "$108,000", "$77.14", "$77/hr",
             "rate you should be quoting for your direct labor", "Self-employment and state income tax",
             "typically 15–30% above your cost"],
    JOB: ["$1,933.28", "$1,546.62", "$386.66", "$208.12", "$812.50", "$85/hr", "$25,500"],
}


def main():
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
        for label, text in figures.items():
            ok = text in html
            if not ok:
                missing += 1
            print("    [{}] {:<38} {}".format("ok" if ok else "MISSING", label, text))
    print()
    print("=" * 72)
    print("Stale strings from the old engine")
    print("=" * 72)
    stale_found = 0
    for post in POSTS:
        html = open(os.path.join(BLOG, post), encoding="utf-8").read()
        hits = [t for t in STALE_EVERYWHERE + STALE.get(post, []) if t in html]
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
