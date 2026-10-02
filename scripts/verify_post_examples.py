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
    "Overhead &amp; Burden", "Overhead & Burden", "Effective $/hr", "20.3%",
]
# Old example figures that must be gone after the rerun.
STALE = {
    LEAF: ["$322.55", "$258.04", "$402.25", "$93.98", "$452.25", "$417.29", "$152.25",
           "$456.76", "$39.85", "$264.66", "$214.50"],
    SPRINK: ["$98.16", "$123.84", "$134.47", "$61.84", "$75.23", "$127.86", "$84.93",
             "$153.98", "$117.61", "$484.35", "$387.48", "$79.79", "$177.95", "$3.21"],
}


def main():
    missing = 0
    current_post = None
    ordered = []
    for post in dict.fromkeys(e[0] for e in EXAMPLES):
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
