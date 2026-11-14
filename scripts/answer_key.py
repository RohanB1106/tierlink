"""
Answer key: uses the hidden ground truth to report the savings planted in the synthetic data.
The real app must discover these WITHOUT _ground_truth.csv; this script tells us what "100% found" looks like.

Usage:  python3 scripts/answer_key.py
"""

import csv
from collections import defaultdict
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"


def load(name):
    with (DATA / name).open() as f:
        return list(csv.DictReader(f))


purchases = {r["line_id"]: r for r in load("purchases.csv")}
truth = {r["line_id"]: r for r in load("_ground_truth.csv")}
parts = {r["part_number"]: r for r in load("parts.csv")}
breaks = load("price_breaks.csv")

# description -> part via supplier sku (only for scoring here)
sku_to_part = {}
for lid, t in truth.items():
    sku_to_part[(purchases[lid]["supplier_id"], purchases[lid]["supplier_sku"])] = t["part_number"]

tiers = defaultdict(list)  # (supplier, part) -> [(min_units, price)]
for b in breaks:
    pn = sku_to_part.get((b["supplier_id"], b["supplier_sku"]))
    if pn:
        tiers[(b["supplier_id"], pn)].append((int(b["min_qty_units"]), float(b["unit_price"])))


def best_price(pn, units):
    best = None
    for (sid, p), ts in tiers.items():
        if p != pn:
            continue
        price = sorted(ts)[0][1]
        for mq, pr in sorted(ts):
            if units >= mq:
                price = pr
        if best is None or price < best[1]:
            best = (sid, price)
    return best


# 1) Supplier price variance: same part, unit price spread across suppliers
per_part_prices = defaultdict(lambda: defaultdict(list))
for lid, t in truth.items():
    p = purchases[lid]
    if p["order_type"] != "PRODUCTION":
        continue
    per_part_prices[t["part_number"]][p["supplier_id"]].append(float(p["extended_amount"]) / int(t["units"]))
spreads = []
for pn, by_sup in per_part_prices.items():
    if len(by_sup) < 2:
        continue
    avgs = {s: sum(v) / len(v) for s, v in by_sup.items()}
    lo, hi = min(avgs.values()), max(avgs.values())
    spreads.append((pn, len(by_sup), (hi - lo) / lo))
spreads.sort(key=lambda x: -x[2])

# 2) Consolidation: combine all plants' monthly production demand per part, buy at best tier
monthly = defaultdict(lambda: {"units": 0, "spend": 0.0})
for lid, t in truth.items():
    p = purchases[lid]
    if p["order_type"] != "PRODUCTION":
        continue
    key = (t["part_number"], p["po_date"][:7])
    monthly[key]["units"] += int(t["units"])
    monthly[key]["spend"] += float(p["extended_amount"])
actual = sum(v["spend"] for v in monthly.values())
consolidated = 0.0
savings_by_part = defaultdict(float)
for (pn, ym), v in monthly.items():
    sid, price = best_price(pn, v["units"])
    months_elapsed = (int(ym[:4]) - 2024) * 12 + int(ym[5:]) - 11
    cost = price * v["units"] * (1 + 0.0025 * months_elapsed)
    consolidated += min(cost, v["spend"])
    savings_by_part[pn] += max(0.0, v["spend"] - cost)

# 3) Lifecycle: spare/warranty spend by part (unlinked to products in the raw data)
svc = defaultdict(float)
for lid, t in truth.items():
    p = purchases[lid]
    if p["order_type"] != "PRODUCTION":
        svc[t["part_number"]] += float(p["extended_amount"])

# 4) Near-duplicates
brackets = [pn for pn in parts if pn.startswith("BRK-")]
m3 = [pn for pn in parts if pn.startswith("SCR-M3-")]

total = sum(float(p["extended_amount"]) for p in purchases.values())
print(f"Total spend (24 mo): ${total:,.0f}\n")
print("1) Price variance — parts bought from 2+ suppliers:", len(spreads))
for pn, n, s in spreads[:5]:
    print(f"   {pn:<16} {n} suppliers, {s:5.1%} spread")
print(f"\n2) Consolidation (all plants pooled, best supplier tier):")
print(f"   production spend ${actual:,.0f} -> ${consolidated:,.0f}  "
      f"= ${actual - consolidated:,.0f} saved ({(actual - consolidated) / actual:.1%}) over 24 months")
for pn, s in sorted(savings_by_part.items(), key=lambda x: -x[1])[:5]:
    print(f"   {pn:<16} ${s:,.0f}")
print(f"\n3) Spare/warranty spend not tied to products: ${sum(svc.values()):,.0f} "
      f"({sum(svc.values()) / total:.1%} of spend)")
print(f"\n4) Near-duplicate parts: {len(brackets)} brackets (3 natural groups), {len(m3)} M3 screw variants")
vague = sum(1 for t in truth.values() if t["vague"] == "True")
print(f"\n5) Vague invoice lines needing human review: {vague}")
