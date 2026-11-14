"""
Synthetic data generator for TierLink.

Creates a fictional manufacturer, "Prairie Power Tools", with:
  - an engineering part master and multi-level BOMs for 6 products
  - 3 plants, 8 suppliers, each supplier with its own description "dialect"
  - supplier price-break (volume tier) tables
  - ~2 years of purchase lines (the spend cube), incl. spare and warranty orders
  - a hidden ground-truth file so we can score the matching engine

Problems are planted on purpose so the demo has something to find:
  1. Same part bought from several suppliers at different prices
  2. Same part bought by several plants separately, each below the next price tier
  3. Near-duplicate parts (14 brackets, 10 M3 screw variants) that could be standardized
  4. Invoice descriptions that do not match engineering part numbers (pack sizes, abbreviations)
  5. Spare/warranty orders not linked to any product
  6. Some vague invoice lines that a human must review

Pure standard library. Deterministic (fixed seed).
Usage:  python3 scripts/generate_data.py [--out data]
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import random
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

SEED = 42
rng = random.Random(SEED)

# --------------------------------------------------------------------------------------
# Company structure
# --------------------------------------------------------------------------------------

PLANTS = [
    {"plant_id": "PEO", "name": "Peoria Assembly", "state": "IL"},
    {"plant_id": "CHA", "name": "Champaign Assembly", "state": "IL"},
    {"plant_id": "FTW", "name": "Fort Wayne Assembly", "state": "IN"},
]
SERVICE_CENTER = {"plant_id": "SVC", "name": "Service & Warranty Center", "state": "IL"}

PRODUCTS = [
    # product_id, name, plant, annual volume, voltage family
    {"product_id": "PD-12", "name": "Compact Drill 12V", "plant_id": "PEO", "annual_volume": 40000},
    {"product_id": "PD-20", "name": "Drill/Driver 20V", "plant_id": "PEO", "annual_volume": 60000},
    {"product_id": "PD-20X", "name": "Hammer Drill 20V", "plant_id": "CHA", "annual_volume": 25000},
    {"product_id": "AG-45", "name": "Angle Grinder 4.5in 20V", "plant_id": "CHA", "annual_volume": 18000},
    {"product_id": "CS-65", "name": "Circular Saw 6.5in 20V", "plant_id": "FTW", "annual_volume": 20000},
    {"product_id": "CS-725", "name": "Circular Saw 7.25in Corded", "plant_id": "FTW", "annual_volume": 15000},
]

# Each supplier has a description style and a pricing personality.
SUPPLIERS = [
    {"supplier_id": "S01", "name": "Midwest Fastener Supply", "style": "caps_abbrev", "price_factor": 1.00},
    {"supplier_id": "S02", "name": "Heartland Industrial", "style": "verbose", "price_factor": 1.12},
    {"supplier_id": "S03", "name": "Great Lakes Bearing Co", "style": "sku_first", "price_factor": 0.96},
    {"supplier_id": "S04", "name": "Apex Motion Components", "style": "verbose", "price_factor": 1.05},
    {"supplier_id": "S05", "name": "Prairie Electric Supply", "style": "caps_abbrev", "price_factor": 1.08},
    {"supplier_id": "S06", "name": "Northline Plastics", "style": "sku_first", "price_factor": 1.00},
    {"supplier_id": "S07", "name": "Summit Metalworks", "style": "verbose", "price_factor": 0.98},
    {"supplier_id": "S08", "name": "Delta Power Cells", "style": "caps_abbrev", "price_factor": 1.03},
]
SUPPLIER_BY_ID = {s["supplier_id"]: s for s in SUPPLIERS}

# Which suppliers can sell which categories
CATEGORY_SUPPLIERS = {
    "screw": ["S01", "S02", "S07"],
    "bolt": ["S01", "S02"],
    "nut": ["S01", "S02"],
    "washer": ["S01", "S07"],
    "bearing": ["S03", "S04", "S02"],
    "spring": ["S07", "S02"],
    "bracket": ["S07", "S02"],
    "gear": ["S04", "S07"],
    "motor": ["S04", "S05"],
    "battery": ["S08", "S05"],
    "switch": ["S05", "S04"],
    "pcb": ["S05"],
    "cord": ["S05", "S02"],
    "housing": ["S06"],
    "grip": ["S06"],
    "chuck": ["S04"],
    "blade": ["S07", "S02"],
    "guard": ["S07"],
}

# --------------------------------------------------------------------------------------
# Part master
# --------------------------------------------------------------------------------------


@dataclass
class Part:
    part_number: str
    category: str
    eng_description: str
    attrs: dict
    unit_cost: float  # baseline piece price
    pack_size: int = 1  # how suppliers usually sell it
    used_in: list = field(default_factory=list)


PARTS: dict[str, Part] = {}


def add_part(pn, category, desc, attrs, cost, pack=1):
    PARTS[pn] = Part(pn, category, desc, attrs, round(cost, 4), pack)
    return pn


def build_part_master():
    # Fasteners: machine screws. Many near-duplicate M3 screws are planted (lengths x finishes).
    finishes = {"ZN": "zinc plated", "BO": "black oxide", "SS": "stainless"}
    for size, lengths in [("M2.5", [6, 8]), ("M3", [8, 10, 12, 14, 16]), ("M4", [10, 12, 16, 20]), ("M5", [12, 16, 20])]:
        for length in lengths:
            for fin in (["ZN", "BO", "SS"] if size == "M3" and length in (10, 12, 14) else ["ZN"]):
                pn = f"SCR-{size}-{length}-{fin}"
                base = {"M2.5": 0.018, "M3": 0.022, "M4": 0.031, "M5": 0.044}[size] * (1 + length / 40)
                base *= {"ZN": 1.0, "BO": 1.15, "SS": 1.9}[fin]
                add_part(pn, "screw", f"Machine screw, pan head, {size} x {length}mm, {finishes[fin]}",
                         {"thread": size, "length_mm": length, "finish": fin, "head": "pan"}, base, pack=1000)

    for size, lengths in [("M6", [16, 20, 25]), ("M8", [20, 25, 30])]:
        for length in lengths:
            pn = f"BLT-{size}-{length}-ZN"
            add_part(pn, "bolt", f"Hex bolt, {size} x {length}mm, grade 8.8, zinc plated",
                     {"thread": size, "length_mm": length, "finish": "ZN", "grade": "8.8"},
                     {"M6": 0.09, "M8": 0.14}[size] * (1 + length / 50), pack=500)
    for size in ["M3", "M4", "M5", "M6", "M8"]:
        add_part(f"NUT-{size}-ZN", "nut", f"Hex nut, {size}, zinc plated", {"thread": size, "finish": "ZN"},
                 0.012 * (1 + int(size[1:]) / 4), pack=1000)
        add_part(f"WSH-{size}-ZN", "washer", f"Flat washer, {size}, zinc plated", {"thread": size, "finish": "ZN"},
                 0.006 * (1 + int(size[1:]) / 4), pack=1000)

    # Bearings (standard designations)
    for code, cost in [("608ZZ", 0.42), ("625ZZ", 0.38), ("6000-2RS", 0.65), ("6001-2RS", 0.72), ("6201-2RS", 0.95), ("699ZZ", 0.35)]:
        add_part(f"BRG-{code}", "bearing", f"Deep groove ball bearing {code}", {"designation": code}, cost, pack=50)

    # Springs
    for i, (wd, od, ln) in enumerate([(0.8, 6, 15), (1.0, 8, 20), (0.6, 5, 12), (1.2, 10, 25)]):
        add_part(f"SPR-C{i+1:02d}", "spring", f"Compression spring, wire {wd}mm, OD {od}mm, L {ln}mm",
                 {"wire_mm": wd, "od_mm": od, "length_mm": ln}, 0.08 + wd * 0.05, pack=500)

    # 14 near-duplicate mounting brackets (planted platforming opportunity). They fall into 3 natural groups.
    groups = [
        (1.5, 20, 4.2), (1.6, 20, 4.2), (1.5, 21, 4.3), (1.5, 20, 4.5), (1.6, 21, 4.2),  # group A ~ 1.5x20
        (2.0, 25, 5.2), (2.0, 25, 5.5), (2.1, 25, 5.2), (2.0, 26, 5.2), (2.0, 24, 5.3),  # group B ~ 2.0x25
        (3.0, 32, 6.4), (3.0, 30, 6.4), (3.2, 32, 6.5), (3.0, 32, 6.6),                  # group C ~ 3.0x32
    ]
    for i, (t, w, hole) in enumerate(groups):
        add_part(f"BRK-{1001 + i}", "bracket", f"Mounting bracket, L-type, steel, t={t}mm, w={w}mm, hole {hole}mm",
                 {"thickness_mm": t, "width_mm": w, "hole_mm": hole, "material": "CRS"}, 0.35 + t * 0.12, pack=1)

    # Gears
    for teeth, mod in [(12, 0.5), (36, 0.5), (14, 0.6), (42, 0.6), (18, 0.8), (54, 0.8)]:
        add_part(f"GR-M{mod}-T{teeth}", "gear", f"Spur gear, module {mod}, {teeth}T, sintered steel",
                 {"module": mod, "teeth": teeth}, 0.30 + teeth * 0.02, pack=1)

    # Motors, batteries, electrical
    add_part("MTR-BL-20V-18K", "motor", "BLDC motor 20V, 18,000 rpm", {"type": "BLDC", "volts": 20, "rpm": 18000}, 14.50)
    add_part("MTR-BL-20V-10K", "motor", "BLDC motor 20V, 10,000 rpm", {"type": "BLDC", "volts": 20, "rpm": 10000}, 13.20)
    add_part("MTR-BR-12V-15K", "motor", "Brushed DC motor 12V, 15,000 rpm", {"type": "brushed", "volts": 12, "rpm": 15000}, 6.80)
    add_part("MTR-UN-120V-5K", "motor", "Universal motor 120V AC, 5,200 rpm", {"type": "universal", "volts": 120, "rpm": 5200}, 11.40)
    add_part("BAT-12V-2.0", "battery", "Li-ion battery pack 12V 2.0Ah", {"volts": 12, "ah": 2.0}, 11.00)
    add_part("BAT-20V-2.0", "battery", "Li-ion battery pack 20V 2.0Ah", {"volts": 20, "ah": 2.0}, 16.50)
    add_part("BAT-20V-4.0", "battery", "Li-ion battery pack 20V 4.0Ah", {"volts": 20, "ah": 4.0}, 27.00)
    add_part("SW-TRG-VS-12V", "switch", "Trigger switch, variable speed, 12V DC", {"type": "trigger", "volts": 12}, 2.10)
    add_part("SW-TRG-VS-20V", "switch", "Trigger switch, variable speed, 20V DC", {"type": "trigger", "volts": 20}, 2.60)
    add_part("SW-PDL-20V", "switch", "Paddle switch, 20V DC", {"type": "paddle", "volts": 20}, 2.30)
    add_part("SW-TRG-120V", "switch", "Trigger switch, 120V AC, 15A", {"type": "trigger", "volts": 120}, 2.90)
    add_part("PCB-MC-20V", "pcb", "Motor controller board 20V BLDC", {"volts": 20}, 7.40)
    add_part("PCB-MC-12V", "pcb", "Motor controller board 12V", {"volts": 12}, 4.10)
    add_part("CRD-14AWG-8FT", "cord", "Power cord 14AWG, 8ft, 3-prong", {"awg": 14, "length_ft": 8}, 3.20)

    # Product-specific plastics, chucks, blades, guards
    for pid in ["PD-12", "PD-20", "PD-20X", "AG-45", "CS-65", "CS-725"]:
        add_part(f"HSG-{pid}", "housing", f"Housing set, {pid}, glass-filled nylon", {"product": pid}, 3.10 + rng.random())
        add_part(f"GRP-{pid}", "grip", f"Overmold grip, {pid}, TPE", {"product": pid}, 0.70 + rng.random() * 0.3)
    add_part("CHK-KL-3/8", "chuck", "Keyless chuck 3/8in", {"size_in": 0.375}, 2.40)
    add_part("CHK-KL-1/2", "chuck", "Keyless chuck 1/2in", {"size_in": 0.5}, 3.10)
    add_part("BLD-6.5-24T", "blade", "Circular saw blade 6-1/2in, 24T carbide", {"dia_in": 6.5, "teeth": 24}, 3.60)
    add_part("BLD-7.25-24T", "blade", "Circular saw blade 7-1/4in, 24T carbide", {"dia_in": 7.25, "teeth": 24}, 3.90)
    add_part("GRD-AG-45", "guard", "Wheel guard 4.5in, steel", {"dia_in": 4.5}, 1.60)
    add_part("GRD-CS-LOWER", "guard", "Lower blade guard, circular saw", {}, 2.20)


# --------------------------------------------------------------------------------------
# BOMs (multi-level: product -> assembly -> component)
# --------------------------------------------------------------------------------------

BOM_ROWS: list[dict] = []


def bom(product, assembly, items):
    for pn, qty in items:
        assert pn in PARTS, pn
        BOM_ROWS.append({"product_id": product, "assembly": assembly, "part_number": pn, "qty_per": qty})
        PARTS[pn].used_in.append(product)


def build_boms():
    # Common building blocks -> shared parts across products (the "platform" opportunity)
    def drill(pid, motor, battery, switch, pcb, chuck, gears, bracket_ids, screw_variant):
        bom(pid, "Motor Assy", [(motor, 1), ("BRG-608ZZ", 1), ("BRG-699ZZ", 1), (pcb, 1), (f"SCR-M3-{screw_variant}", 4)])
        bom(pid, "Gearbox Assy", [(g, 1) for g in gears] + [("SPR-C01", 1), ("SCR-M2.5-8-ZN", 3), ("WSH-M3-ZN", 2)])
        bom(pid, "Housing Assy", [(f"HSG-{pid}", 1), (f"GRP-{pid}", 1), ("SCR-M3-16-ZN", 8)] + [(b, 1) for b in bracket_ids])
        bom(pid, "Electrical Assy", [(switch, 1), (battery, 1), ("SCR-M3-8-ZN", 2)])
        bom(pid, "Chuck Assy", [(chuck, 1), ("SCR-M5-16-ZN", 1)])

    drill("PD-12", "MTR-BR-12V-15K", "BAT-12V-2.0", "SW-TRG-VS-12V", "PCB-MC-12V", "CHK-KL-3/8",
          ["GR-M0.5-T12", "GR-M0.5-T36"], ["BRK-1001"], "10-ZN")
    drill("PD-20", "MTR-BL-20V-18K", "BAT-20V-2.0", "SW-TRG-VS-20V", "PCB-MC-20V", "CHK-KL-1/2",
          ["GR-M0.6-T14", "GR-M0.6-T42"], ["BRK-1002", "BRK-1006"], "12-ZN")
    drill("PD-20X", "MTR-BL-20V-18K", "BAT-20V-4.0", "SW-TRG-VS-20V", "PCB-MC-20V", "CHK-KL-1/2",
          ["GR-M0.6-T14", "GR-M0.6-T42", "GR-M0.8-T18"], ["BRK-1003", "BRK-1007"], "12-BO")
    bom("PD-20X", "Hammer Mech", [("SPR-C02", 1), ("BRG-6000-2RS", 1), ("SCR-M3-14-ZN", 2)])

    # Grinder
    bom("AG-45", "Motor Assy", [("MTR-BL-20V-10K", 1), ("BRG-608ZZ", 1), ("BRG-6000-2RS", 1), ("PCB-MC-20V", 1), ("SCR-M3-12-SS", 4)])
    bom("AG-45", "Gearbox Assy", [("GR-M0.8-T18", 1), ("GR-M0.8-T54", 1), ("BRG-6001-2RS", 1), ("SCR-M4-12-ZN", 4)])
    bom("AG-45", "Housing Assy", [("HSG-AG-45", 1), ("GRP-AG-45", 1), ("SCR-M3-16-ZN", 6), ("BRK-1004", 1), ("BRK-1008", 1)])
    bom("AG-45", "Electrical Assy", [("SW-PDL-20V", 1), ("BAT-20V-4.0", 1), ("SCR-M3-10-BO", 2)])
    bom("AG-45", "Guard Assy", [("GRD-AG-45", 1), ("BLT-M6-16-ZN", 1), ("NUT-M6-ZN", 1), ("WSH-M6-ZN", 1)])

    # Saws
    for pid, motor, blade, bat, sw, brks, screw in [
        ("CS-65", "MTR-BL-20V-10K", "BLD-6.5-24T", "BAT-20V-4.0", "SW-TRG-VS-20V", ["BRK-1005", "BRK-1009", "BRK-1011"], "SCR-M3-14-BO"),
        ("CS-725", "MTR-UN-120V-5K", "BLD-7.25-24T", None, "SW-TRG-120V", ["BRK-1010", "BRK-1012", "BRK-1013", "BRK-1014"], "SCR-M3-14-SS"),
    ]:
        bom(pid, "Motor Assy", [(motor, 1), ("BRG-6201-2RS", 1), ("BRG-625ZZ", 1), (screw, 4)]
            + ([("PCB-MC-20V", 1)] if bat else []))
        bom(pid, "Blade Assy", [(blade, 1), ("BLT-M8-20-ZN", 1), ("WSH-M8-ZN", 2), ("GRD-CS-LOWER", 1), ("SPR-C04", 1)])
        bom(pid, "Base & Housing", [(f"HSG-{pid}", 1), (f"GRP-{pid}", 1), ("SCR-M4-16-ZN", 6), ("NUT-M4-ZN", 6)]
            + [(b, 1) for b in brks])
        elec = [(sw, 1), ("SCR-M3-8-ZN", 2)]
        elec += [(bat, 1)] if bat else [("CRD-14AWG-8FT", 1)]
        bom(pid, "Electrical Assy", elec)


# --------------------------------------------------------------------------------------
# Supplier dialects: how each supplier writes a part on an invoice
# --------------------------------------------------------------------------------------

ABBREV = {
    "screw": "SCR MACH PAN", "bolt": "BOLT HEX", "nut": "NUT HEX", "washer": "WSHR FLAT",
    "bearing": "BRG BALL", "spring": "SPRG COMP", "bracket": "BRKT L", "gear": "GEAR SPUR",
    "motor": "MTR", "battery": "BATT LI-ION", "switch": "SW", "pcb": "PCBA CTRL", "cord": "CORD PWR",
    "housing": "HSG SET", "grip": "GRIP OVM", "chuck": "CHUCK KYLS", "blade": "BLADE CIRC", "guard": "GUARD",
}
FIN_ABBREV = {"ZN": "ZINC PLTD", "BO": "BLK OX", "SS": "SST"}
FIN_WORDS = {"ZN": "Zinc Plated", "BO": "Black Oxide", "SS": "Stainless Steel"}


def supplier_sku(supplier_id: str, pn: str) -> str:
    h = int(hashlib.md5(f"{supplier_id}|{pn}|{SEED}".encode()).hexdigest(), 16) % 900000 + 100000
    return f"{supplier_id[1:]}-{h}"


def attr_core(p: Part, style: str) -> str:
    a = p.attrs
    c = p.category
    if c in ("screw", "bolt"):
        return f"{a['thread']}X{a['length_mm']}" if style != "verbose" else f"{a['thread']} x {a['length_mm']}mm"
    if c in ("nut", "washer"):
        return a["thread"]
    if c == "bearing":
        return a["designation"]
    if c == "spring":
        return f"{a['wire_mm']}X{a['od_mm']}X{a['length_mm']}" if style != "verbose" else \
            f"wire {a['wire_mm']}mm, OD {a['od_mm']}mm, length {a['length_mm']}mm"
    if c == "bracket":
        return f"{a['thickness_mm']}T {a['width_mm']}W {a['hole_mm']}H" if style != "verbose" else \
            f"{a['thickness_mm']}mm thick, {a['width_mm']}mm wide, {a['hole_mm']}mm hole"
    if c == "gear":
        return f"M{a['module']} {a['teeth']}T"
    if c == "motor":
        return f"{a['type'].upper()} {a['volts']}V {a['rpm']}RPM" if style != "verbose" else \
            f"{a['type']} {a['volts']}V {a['rpm']:,} rpm"
    if c == "battery":
        return f"{a['volts']}V {a['ah']}AH"
    if c in ("switch",):
        return f"{a['type'].upper()} {a['volts']}V"
    if c == "pcb":
        return f"{a['volts']}V"
    if c == "cord":
        return f"{a['awg']}AWG {a['length_ft']}FT"
    if c in ("housing", "grip"):
        return f"P/N {a['product']}"
    if c == "chuck":
        return {0.375: "3/8", 0.5: "1/2"}[a["size_in"]] + ("IN" if style != "verbose" else " in")
    if c == "blade":
        return f"{a['dia_in']}IN {a['teeth']}T"
    if c == "guard":
        return f"{a.get('dia_in', '')}IN".strip() if a else "LOWER"
    return ""


def render_description(p: Part, supplier_id: str, vague: bool = False) -> str:
    style = SUPPLIER_BY_ID[supplier_id]["style"]
    fin = p.attrs.get("finish")
    pack = p.pack_size
    core = attr_core(p, style)
    if vague:
        # Drop the key distinguishing attribute -> needs a human
        if p.category in ("screw", "bolt"):
            core = p.attrs["thread"]
        elif p.category == "bracket":
            core = "STEEL"
        else:
            core = ""
    if style == "caps_abbrev":
        s = f"{ABBREV[p.category]} {core}"
        if fin:
            s += f" {FIN_ABBREV[fin]}"
        if pack > 1:
            s += f" {pack}PC"
        return " ".join(s.split()).upper()
    if style == "verbose":
        name = p.category.capitalize()
        if p.category == "screw":
            name = "Machine Screw, Pan Head"
        s = f"{name}, {core}"
        if fin:
            s += f", {FIN_WORDS[fin]}"
        if pack > 1:
            s += f" (Box of {pack})"
        return s
    # sku_first
    sku = supplier_sku(supplier_id, p.part_number)
    s = f"{sku} / {p.category} {core}".lower()
    if fin:
        s += f" {fin.lower()}"
    if pack > 1:
        s += f" pk{pack}"
    return s


# --------------------------------------------------------------------------------------
# Price breaks
# --------------------------------------------------------------------------------------

PRICE_BREAKS: list[dict] = []
# (supplier_id, part_number) -> list of (min_qty_units, unit_price)
TIERS: dict[tuple[str, str], list[tuple[int, float]]] = {}


def monthly_units(pn: str, plant_id: str | None = None) -> float:
    total = 0.0
    for row in BOM_ROWS:
        if row["part_number"] != pn:
            continue
        prod = next(p for p in PRODUCTS if p["product_id"] == row["product_id"])
        if plant_id and prod["plant_id"] != plant_id:
            continue
        total += prod["annual_volume"] * row["qty_per"] / 12
    return total


def build_price_breaks():
    for pn, p in PARTS.items():
        if not p.used_in:
            continue
        sups = CATEGORY_SUPPLIERS[p.category]
        # The biggest single-plant monthly order sets where the breaks sit.
        plant_demands = [monthly_units(pn, pl["plant_id"]) for pl in PLANTS]
        biggest = max(plant_demands)
        total = sum(plant_demands)
        for sid in sups:
            f = SUPPLIER_BY_ID[sid]["price_factor"] * rng.uniform(0.95, 1.07)
            base = p.unit_cost * f
            # Breaks: a plant ordering alone lands in tier 1 or 2; combined demand reaches tier 3/4.
            b1 = max(round_qty(biggest * 1.15, p.pack_size), p.pack_size)
            b2 = max(round_qty(max(total * 0.95, biggest * 1.8), p.pack_size), b1 + p.pack_size)
            b3 = max(round_qty(total * 2.2, p.pack_size), b2 + p.pack_size)
            tiers = [(p.pack_size, base), (b1, base * 0.88), (b2, base * 0.78), (b3, base * 0.70)]
            TIERS[(sid, pn)] = tiers
            for i, (mq, price) in enumerate(tiers):
                PRICE_BREAKS.append({
                    "supplier_id": sid,
                    "supplier_sku": supplier_sku(sid, pn),
                    "supplier_description": render_description(p, sid),
                    "tier": i + 1,
                    "min_qty_units": mq,
                    "max_qty_units": (tiers[i + 1][0] - 1) if i + 1 < len(tiers) else "",
                    "unit_price": round(price, 4),
                    "pack_size": p.pack_size,
                    "valid_from": "2024-11-01",
                })


def round_qty(q: float, pack: int) -> int:
    step = max(pack, 10 ** max(len(str(int(q))) - 2, 0))
    return int(max(step, round(q / step) * step))


def tier_price(sid: str, pn: str, units: int) -> float:
    price = TIERS[(sid, pn)][0][1]
    for mq, pr in TIERS[(sid, pn)]:
        if units >= mq:
            price = pr
    return price


# --------------------------------------------------------------------------------------
# Purchases (the spend cube)
# --------------------------------------------------------------------------------------

PURCHASES: list[dict] = []
TRUTH: list[dict] = []


def months(start=(2024, 11), n=24):
    y, m = start
    for _ in range(n):
        yield y, m
        m += 1
        if m == 13:
            y, m = y + 1, 1


def add_line(po_no, d, plant_id, sid, pn, units, order_type, vague=False, price_noise=0.03):
    p = PARTS[pn]
    pack = p.pack_size
    packs = max(1, round(units / pack))
    units = packs * pack
    months_elapsed = (d.year - 2024) * 12 + d.month - 11
    inflation = 1 + 0.0025 * months_elapsed  # ~3%/yr
    piece_price = tier_price(sid, pn, units) * inflation * rng.uniform(1 - price_noise, 1 + price_noise)
    if order_type != "PRODUCTION":
        piece_price *= rng.uniform(1.25, 1.6)  # small urgent service orders cost more
    line_id = f"L{len(PURCHASES) + 1:06d}"
    PURCHASES.append({
        "line_id": line_id,
        "po_number": po_no,
        "po_date": d.isoformat(),
        "plant_id": plant_id,
        "supplier_id": sid,
        "supplier_name": SUPPLIER_BY_ID[sid]["name"],
        "supplier_sku": supplier_sku(sid, pn),
        "item_description": render_description(p, sid, vague=vague),
        "uom": "PK" if pack > 1 else "EA",
        "qty": packs,
        "price_per_uom": round(piece_price * pack, 4),
        "extended_amount": round(piece_price * units, 2),
        "order_type": order_type,
        "currency": "USD",
    })
    TRUTH.append({"line_id": line_id, "part_number": pn, "units": units, "vague": vague})


def build_purchases():
    po_counter = 70000

    # Planted: each plant has a "home" supplier per category, so the same part is bought
    # from different suppliers by different plants at different prices.
    home_supplier = {}
    for pl in PLANTS:
        for cat, sups in CATEGORY_SUPPLIERS.items():
            home_supplier[(pl["plant_id"], cat)] = rng.choice(sups)

    for (y, m) in months():
        for pl in PLANTS:
            # One PO per supplier per month per plant
            lines_by_supplier: dict[str, list] = {}
            for pn, p in PARTS.items():
                demand = monthly_units(pn, pl["plant_id"])
                if demand <= 0:
                    continue
                sid = home_supplier[(pl["plant_id"], p.category)]
                # 15% of the time buy from an alternate supplier (spot buy)
                if rng.random() < 0.15:
                    sid = rng.choice(CATEGORY_SUPPLIERS[p.category])
                units = int(demand * rng.uniform(0.85, 1.15))
                lines_by_supplier.setdefault(sid, []).append((pn, units))
            for sid, items in lines_by_supplier.items():
                po_counter += 1
                d = date(y, m, rng.randint(2, 26))
                for pn, units in items:
                    vague = rng.random() < 0.025
                    add_line(f"PO-{po_counter}", d, pl["plant_id"], sid, pn, units, "PRODUCTION", vague=vague)

        # Spare & warranty orders from the service center, not linked to products
        for _ in range(rng.randint(6, 12)):
            pn = rng.choice([pn for pn, p in PARTS.items() if p.used_in and p.category in
                             ("motor", "battery", "switch", "chuck", "blade", "pcb", "gear", "bearing", "guard", "cord")])
            sid = rng.choice(CATEGORY_SUPPLIERS[PARTS[pn].category])
            order_type = rng.choice(["SPARE", "SPARE", "WARRANTY"])
            po_counter += 1
            d = date(y, m, rng.randint(2, 26))
            units = rng.randint(20, 400) if PARTS[pn].pack_size == 1 else PARTS[pn].pack_size * rng.randint(1, 3)
            add_line(f"PO-{po_counter}", d, SERVICE_CENTER["plant_id"], sid, pn, units, order_type, price_noise=0.05)


# --------------------------------------------------------------------------------------
# Write files
# --------------------------------------------------------------------------------------


def write_csv(path: Path, rows: list[dict]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "data"))
    out = Path(ap.parse_args().out)

    build_part_master()
    build_boms()
    build_price_breaks()
    build_purchases()

    used = {pn: p for pn, p in PARTS.items() if p.used_in}
    write_csv(out / "plants.csv", PLANTS + [SERVICE_CENTER])
    write_csv(out / "products.csv", PRODUCTS)
    write_csv(out / "suppliers.csv", [{k: v for k, v in s.items() if k != "price_factor"} for s in SUPPLIERS])
    write_csv(out / "parts.csv", _parts_rows(used))
    write_csv(out / "bom.csv", BOM_ROWS)
    write_csv(out / "price_breaks.csv", PRICE_BREAKS)
    write_csv(out / "purchases.csv", PURCHASES)
    write_csv(out / "_ground_truth.csv", TRUTH)

    spend = sum(r["extended_amount"] for r in PURCHASES)
    print(f"Parts used in BOMs : {len(used)}")
    print(f"BOM rows           : {len(BOM_ROWS)}")
    print(f"Price-break rows   : {len(PRICE_BREAKS)}")
    print(f"Purchase lines     : {len(PURCHASES)}")
    print(f"  spare/warranty   : {sum(1 for r in PURCHASES if r['order_type'] != 'PRODUCTION')}")
    print(f"  vague (review)   : {sum(1 for t in TRUTH if t['vague'])}")
    print(f"Total spend (2 yrs): ${spend:,.0f}")
    print(f"Wrote files to {out}")


def _parts_rows(used: dict[str, Part]) -> list[dict]:
    # Uniform columns: attributes serialized as key=value pairs
    return [{
        "part_number": p.part_number,
        "category": p.category,
        "description": p.eng_description,
        "attributes": "; ".join(f"{k}={v}" for k, v in p.attrs.items()),
        "used_in": "|".join(sorted(set(p.used_in))),
    } for p in used.values()]


if __name__ == "__main__":
    main()
