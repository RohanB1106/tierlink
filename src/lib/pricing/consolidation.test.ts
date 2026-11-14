import { test } from "node:test";
import assert from "node:assert/strict";
import { priceAt, simulate, simulatePart, tierAt, type PartDemand } from "./consolidation.ts";

// The example from the pitch: $1.00 for 1-199, $0.80 for 200-299, $0.60 for 300+.
const tiers = { A: [[1, 1.0], [200, 0.8], [300, 0.6]] as [number, number][], B: [[1, 0.95], [200, 0.75], [300, 0.55]] as [number, number][] };

const part: PartDemand = {
  part_number: "BRG-608ZZ",
  description: "Bearing",
  category: "bearing",
  months: ["2026-01", "2026-02"],
  plants: {
    PEO: { supplier: "A", units: [150, 150], spend: 300 },
    CHA: { supplier: "A", units: [150, 150], spend: 300 },
    FTW: { supplier: "A", units: [150, 150], spend: 300 },
  },
  tiers,
};

test("tier lookup", () => {
  assert.equal(priceAt(tiers.A, 150), 1.0);
  assert.equal(priceAt(tiers.A, 250), 0.8);
  assert.equal(priceAt(tiers.A, 450), 0.6);
  assert.equal(tierAt(tiers.A, 450), 3);
});

test("three plants at 150 each pool to 450 and reach the 300+ tier", () => {
  const r = simulatePart(part, { plants: ["PEO", "CHA", "FTW"], allowSupplierSwitch: false });
  assert.equal(r.baselineModelCost, 900); // 6 orders x 150 x $1.00
  assert.equal(r.poolKeep!.modelCost, 540); // 2 months x 450 x $0.60
  assert.equal(r.chosen!.typicalTier, 3);
  assert.ok(Math.abs(r.savingsPct - 0.4) < 1e-9);
  assert.ok(Math.abs(r.savings - 360) < 1e-9); // 40% of $900 actual spend
});

test("allowing a supplier switch can only save more", () => {
  const keep = simulatePart(part, { plants: ["PEO", "CHA", "FTW"], allowSupplierSwitch: false });
  const best = simulatePart(part, { plants: ["PEO", "CHA", "FTW"], allowSupplierSwitch: true });
  assert.equal(best.chosen!.supplier, "B");
  assert.ok(best.savings > keep.savings);
});

test("excluded plants are not counted", () => {
  const r = simulatePart(part, { plants: ["PEO"], allowSupplierSwitch: false });
  assert.equal(r.actualSpend, 300);
  assert.equal(r.savings, 0); // one plant alone cannot reach a better tier
});

test("totals and ranking", () => {
  const s = simulate([part], { plants: ["PEO", "CHA", "FTW"], allowSupplierSwitch: false });
  assert.equal(s.results[0].part_number, "BRG-608ZZ");
  assert.ok(Math.abs(s.savingsPct - 0.4) < 1e-9);
});
