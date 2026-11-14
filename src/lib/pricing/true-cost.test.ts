import { test } from "node:test";
import assert from "node:assert/strict";
import { trueCost, type BomLine, type Product } from "./true-cost.ts";
import type { PartDemand } from "./consolidation.ts";

// Two drills built in Peoria share one motor; a saw in Fort Wayne uses its own.
const products: Product[] = [
  { product_id: "D1", name: "Drill 1", plant_id: "PEO", annual_volume: 100 },
  { product_id: "D2", name: "Drill 2", plant_id: "PEO", annual_volume: 300 },
  { product_id: "S1", name: "Saw", plant_id: "FTW", annual_volume: 200 },
];
const bom: BomLine[] = [
  { product_id: "D1", part_number: "MTR", qty_per: 1 },
  { product_id: "D2", part_number: "MTR", qty_per: 1 },
  { product_id: "S1", part_number: "MTR", qty_per: 1 },
  { product_id: "D1", part_number: "SCR", qty_per: 2 },
  { product_id: "D1", part_number: "SCR", qty_per: 2 }, // same part in a second assembly
];
const demand: PartDemand[] = [
  {
    part_number: "MTR", description: "Motor", category: "motor", months: ["m1"],
    plants: { PEO: { supplier: "A", units: [400], spend: 4400 }, FTW: { supplier: "A", units: [200], spend: 2400 } },
    tiers: { A: [[1, 12], [300, 10]] },
  },
  {
    part_number: "SCR", description: "Screw", category: "screw", months: ["m1"],
    plants: { PEO: { supplier: "A", units: [400], spend: 40 } },
    tiers: { A: [[1, 0.1]] },
  },
];

test("actual cost uses the average price each plant really paid", () => {
  const r = trueCost(products, bom, demand, {}, {});
  const d1 = r.find((p) => p.product_id === "D1")!;
  const d2 = r.find((p) => p.product_id === "D2")!;
  const s1 = r.find((p) => p.product_id === "S1")!;
  // PEO paid $4,400 for 400 motors = $11 each
  assert.equal(d1.lines.find((l) => l.part_number === "MTR")!.actual, 11);
  assert.equal(d2.actual, 11);
  assert.equal(s1.actual, 12); // FTW pays more per motor
});

test("duplicate BOM rows are merged and quoted cost uses the plant's usual tier", () => {
  const d1 = trueCost(products, bom, demand, {}, {}).find((p) => p.product_id === "D1")!;
  const scr = d1.lines.find((l) => l.part_number === "SCR")!;
  assert.equal(scr.qty_per, 4);
  assert.ok(Math.abs(scr.quoted - 0.4) < 1e-9);
  // PEO orders ~400 motors/month -> tier 2 at $10
  assert.equal(d1.lines.find((l) => l.part_number === "MTR")!.quoted, 10);
});

test("spare/warranty and pooling savings are shared across all products using the part", () => {
  const r = trueCost(products, bom, demand, { MTR: 1200 }, { MTR: 600 });
  // weights: D1 100, D2 300, S1 200 -> D1 gets 1/6 of $1,200 = $200 over 100 units = $2/unit
  const d1 = r.find((p) => p.product_id === "D1")!;
  assert.equal(d1.service, 2);
  assert.equal(d1.pooling, 1);
  assert.equal(d1.trueCost, d1.actual + 2);
  assert.equal(d1.optimized, d1.trueCost - 1);
});
