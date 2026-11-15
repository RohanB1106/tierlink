"""
Market data for TierLink's Market Price Check (synthetic, deterministic).

Adds, without touching the existing purchase data:
  materials.csv           raw materials the plants buy (aluminum, steel, copper, resins)
  material_purchases.csv  24 months of raw-material POs, priced by the current supplier
  market_benchmarks.csv   a market price range (low / median / high) per material and top part
  vendor_quotes.csv       quotes from alternative vendors the company does not buy from today

The benchmarks are ILLUSTRATIVE. In production they would come from commodity indexes
(e.g. LME, Fastmarkets) and distributor price feeds; here they are generated so the demo
has items that are above, at and below market.

Usage:  python3 scripts/generate_market.py   (run after generate_data.py)
"""

from __future__ import annotations

import csv
import random
from collections import defaultdict
from datetime import date
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
rng = random.Random(7)  # separate seed: the original data stays byte-identical
SOURCE = "Illustrative demo index (production: LME / Fastmarkets / distributor feeds)"
AS_OF = "2026-10-31"

# key, name, category, unit, market median, monthly qty per plant, current supplier, supplier's markup vs market
MATERIALS = [
    ("AL-6061-BAR", "Aluminum 6061 bar stock", "metal", "oz", 0.26, {"PEO": 90000, "CHA": 70000, "FTW": 40000}, "S07", 1.19),
    ("STEEL-CRS-COIL", "Cold-rolled steel coil", "metal", "lb", 0.48, {"PEO": 30000, "CHA": 24000, "FTW": 36000}, "S07", 0.98),
    ("CU-MAGNET-WIRE", "Copper magnet wire, 18 AWG", "metal", "lb", 5.10, {"PEO": 2600, "CHA": 1900, "FTW": 1500}, "S05", 1.11),
    ("PA66-GF30", "Glass-filled nylon resin (PA66-GF30)", "polymer", "lb", 2.35, {"PEO": 9000, "CHA": 6000, "FTW": 6500}, "S06", 1.04),
    ("TPE-OVERMOLD", "TPE overmold resin", "polymer", "lb", 2.90, {"PEO": 2400, "CHA": 1600, "FTW": 1500}, "S06", 1.14),
]

ALT_VENDORS = {
    "metal": ["Keystone Metals", "Ridgeline Supply", "Lakeshore Alloys"],
    "polymer": ["Bluewater Polymers", "Ridgeline Supply", "Cardinal Resins"],
    "motor": ["Northstar Motion", "Lakeshore Components"],
    "battery": ["Northstar Cells", "Voltline Energy"],
    "pcb": ["Lakeshore Components", "Circuitry Midwest"],
    "switch": ["Lakeshore Components", "Circuitry Midwest"],
    "bearing": ["Cardinal Bearings", "Ridgeline Supply"],
    "chuck": ["Northstar Motion", "Ridgeline Supply"],
    "blade": ["Keystone Metals", "Ridgeline Supply"],
    "gear": ["Northstar Motion", "Keystone Metals"],
    "cord": ["Circuitry Midwest", "Ridgeline Supply"],
}


def read(name):
    with (DATA / name).open() as f:
        return list(csv.DictReader(f))


def write(name, rows):
    with (DATA / name).open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def months(start=(2024, 11), n=24):
    y, m = start
    for _ in range(n):
        yield y, m
        m += 1
        if m == 13:
            y, m = y + 1, 1


def quotes_for(key, category, median, base_unit_qty):
    vendors = ALT_VENDORS.get(category, ["Ridgeline Supply"])
    out = []
    for v in rng.sample(vendors, k=min(len(vendors), rng.choice([2, 3]))):
        out.append({
            "vendor": v,
            "item_key": key,
            "unit_price": round(median * rng.uniform(0.86, 1.06), 4),
            "min_qty": int(round(base_unit_qty * rng.choice([0.5, 1, 2]), -1)) or 10,
            "lead_time_days": rng.choice([5, 7, 10, 14, 21, 30, 45]),
            "terms": rng.choice(["Net 30", "Net 45", "Net 60"]),
        })
    return out


def main():
    materials, mat_purchases, benchmarks, quotes = [], [], [], []

    # ---- raw materials
    line = 0
    for key, name, cat, unit, median, monthly, sid, markup in MATERIALS:
        materials.append({"material_key": key, "name": name, "category": cat, "unit": unit})
        for (y, m) in months():
            elapsed = (y - 2024) * 12 + m - 11
            market_then = median * (1 - 0.003 * (23 - elapsed))  # market drifted up ~3.6%/yr to today's median
            for plant, qty in monthly.items():
                line += 1
                q = int(qty * rng.uniform(0.85, 1.15))
                price = round(market_then * markup * rng.uniform(0.97, 1.03), 4)
                mat_purchases.append({
                    "line_id": f"M{line:05d}",
                    "po_date": date(y, m, rng.randint(2, 26)).isoformat(),
                    "plant_id": plant,
                    "supplier_id": sid,
                    "material_key": key,
                    "qty": q,
                    "unit": unit,
                    "unit_price": price,
                    "amount": round(q * price, 2),
                })
        benchmarks.append({
            "item_key": key, "item_type": "material", "name": name, "unit": unit,
            "low": round(median * 0.9, 4), "median": median, "high": round(median * 1.12, 4),
            "source": SOURCE, "as_of": AS_OF,
        })
        quotes += quotes_for(key, cat, median, sum(monthly.values()))

    # ---- purchased parts: benchmark the 18 highest-spend production parts
    parts = {p["part_number"]: p for p in read("parts.csv")}
    purchases = {p["line_id"]: p for p in read("purchases.csv")}
    truth = read("_ground_truth.csv")  # generation only: the app never reads this file
    paid = defaultdict(lambda: [0.0, 0])
    spend = defaultdict(float)
    for t in truth:
        p = purchases[t["line_id"]]
        if p["order_type"] != "PRODUCTION":
            continue
        spend[t["part_number"]] += float(p["extended_amount"])
        if p["po_date"] >= "2026-08-01":  # recent price
            paid[t["part_number"]][0] += float(p["extended_amount"])
            paid[t["part_number"]][1] += int(t["units"])
    top = [pn for pn, _ in sorted(spend.items(), key=lambda kv: -kv[1]) if parts[pn]["category"] in ALT_VENDORS][:18]
    for pn in top:
        amount, units = paid[pn]
        our = amount / units
        median = our * rng.choice([0.84, 0.88, 0.9, 0.93, 0.97, 1.0, 1.03, 1.06])
        benchmarks.append({
            "item_key": pn, "item_type": "part", "name": parts[pn]["description"], "unit": "each",
            "low": round(median * 0.88, 4), "median": round(median, 4), "high": round(median * 1.14, 4),
            "source": SOURCE, "as_of": AS_OF,
        })
        quotes += quotes_for(pn, parts[pn]["category"], median, units / 3)

    write("materials.csv", materials)
    write("material_purchases.csv", mat_purchases)
    write("market_benchmarks.csv", benchmarks)
    write("vendor_quotes.csv", quotes)
    print(f"materials {len(materials)}, material POs {len(mat_purchases)}, "
          f"benchmarks {len(benchmarks)}, vendor quotes {len(quotes)}, "
          f"material spend 24m ${sum(r['amount'] for r in mat_purchases):,.0f}")


if __name__ == "__main__":
    main()
