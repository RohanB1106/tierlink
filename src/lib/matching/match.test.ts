import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDescription } from "./parse.ts";
import { matchAll, matchLine, type PartRecord, type PurchaseLine } from "./match.ts";

const parts: PartRecord[] = [
  { part_number: "SCR-M3-12-ZN", category: "screw", description: "", attributes: { thread: "M3", length_mm: 12, finish: "ZN", head: "pan" } },
  { part_number: "SCR-M3-12-SS", category: "screw", description: "", attributes: { thread: "M3", length_mm: 12, finish: "SS", head: "pan" } },
  { part_number: "SCR-M3-16-ZN", category: "screw", description: "", attributes: { thread: "M3", length_mm: 16, finish: "ZN", head: "pan" } },
  { part_number: "GRD-AG-45", category: "guard", description: "", attributes: { dia_in: 4.5 } },
  { part_number: "GRD-CS-LOWER", category: "guard", description: "", attributes: {} },
];
const byCat = new Map<string, PartRecord[]>();
for (const p of parts) byCat.set(p.category, [...(byCat.get(p.category) ?? []), p]);

const line = (id: string, desc: string, sku = "01-111111", qty = 10, price = 22): PurchaseLine => ({
  line_id: id, supplier_id: "S01", supplier_sku: sku, item_description: desc, qty, price_per_uom: price,
});

test("three supplier dialects parse to the same attributes", () => {
  const expected = { thread: "M3", length_mm: 12, finish: "ZN" };
  for (const d of [
    "SCR MACH PAN M3X12 ZINC PLTD 1000PC",
    "Machine Screw, Pan Head, M3 x 12mm, Zinc Plated (Box of 1000)",
    "07-482913 / screw m3x12 zn pk1000",
  ]) {
    const p = parseDescription(d);
    assert.equal(p.category, "screw");
    assert.deepEqual(p.attrs, expected);
    assert.equal(p.packSize, 1000);
  }
});

test("exact attribute match auto-matches and normalizes pack pricing", () => {
  const r = matchLine(line("L1", "SCR MACH PAN M3X12 ZINC PLTD 1000PC", "01-111111", 5, 22), byCat);
  assert.equal(r.status, "auto");
  assert.equal(r.part_number, "SCR-M3-12-ZN");
  assert.equal(r.evidence.units, 5000);
  assert.equal(r.evidence.unit_price, 0.022);
});

test("near-duplicate with a different finish is not confused", () => {
  const r = matchLine(line("L2", "Machine Screw, Pan Head, M3 x 12mm, Stainless Steel (Box of 1000)"), byCat);
  assert.equal(r.part_number, "SCR-M3-12-SS");
});

test("vague line goes to review, never auto", () => {
  const r = matchLine(line("L3", "SCR MACH PAN M3 ZINC PLTD 1000PC"), byCat);
  assert.equal(r.status, "pending");
  assert.equal(r.part_number, null);
  assert.equal(r.method, "ambiguous");
});

test("guard position distinguishes wheel guard from lower blade guard", () => {
  assert.equal(matchLine(line("L4", "GUARD 4.5IN"), byCat).part_number, "GRD-AG-45");
  assert.equal(matchLine(line("L5", "Guard, LOWER"), byCat).part_number, "GRD-CS-LOWER");
});

test("SKU history suggests a part for vague lines but still needs approval", () => {
  const sku = "01-222222";
  const lines = [
    ...[1, 2, 3].map((i) => line(`A${i}`, "SCR MACH PAN M3X16 ZINC PLTD 1000PC", sku)),
    line("V1", "SCR MACH PAN M3 ZINC PLTD 1000PC", sku),
  ];
  const vague = matchAll(lines, parts).find((r) => r.line_id === "V1")!;
  assert.equal(vague.part_number, "SCR-M3-16-ZN");
  assert.equal(vague.method, "sku-history");
  assert.equal(vague.status, "pending");
});

test("unknown category is left unmatched", () => {
  const r = matchLine(line("L6", "MISC FREIGHT CHARGE"), byCat);
  assert.equal(r.match_type, "unmatched");
  assert.equal(r.confidence, 0);
});
