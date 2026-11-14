import { test } from "node:test";
import assert from "node:assert/strict";
import { cluster, commonality, compatible, findCandidates, type PlatformPart } from "./platforming.ts";
import type { PartDemand } from "./consolidation.ts";

const bracket = (pn: string, t: number, w: number, h: number, units: number, products: string[]): PlatformPart => ({
  part_number: pn, category: "bracket", description: "", products, annualUnits: units,
  attributes: { thickness_mm: t, width_mm: w, hole_mm: h, material: "CRS" },
});
const screw = (pn: string, len: number, finish: string, units: number, products: string[]): PlatformPart => ({
  part_number: pn, category: "screw", description: "", products, annualUnits: units,
  attributes: { thread: "M3", length_mm: len, finish, head: "pan" },
});

const parts = [
  bracket("BRK-A1", 1.5, 20, 4.2, 900, ["P1"]),
  bracket("BRK-A2", 1.6, 21, 4.2, 400, ["P2"]),
  bracket("BRK-B1", 2.0, 25, 5.2, 700, ["P1"]),
  bracket("BRK-B2", 2.1, 25, 5.5, 300, ["P3"]),
  bracket("BRK-C1", 3.0, 32, 6.4, 200, ["P3"]),
  screw("SCR-12-ZN", 12, "ZN", 5000, ["P1"]),
  screw("SCR-12-BO", 12, "BO", 2000, ["P2"]),
  screw("SCR-16-ZN", 16, "ZN", 8000, ["P1", "P2", "P3"]),
];

test("brackets within 10% on every dimension group together; distant ones do not", () => {
  assert.ok(compatible(parts[0], parts[1]));
  assert.ok(!compatible(parts[0], parts[2]));
  const groups = cluster(parts.filter((p) => p.category === "bracket")).map((g) => g.map((p) => p.part_number));
  assert.deepEqual(groups, [["BRK-A1", "BRK-A2"], ["BRK-B1", "BRK-B2"], ["BRK-C1"]]);
});

test("screws group only by finish, never across lengths", () => {
  const groups = cluster(parts.filter((p) => p.category === "screw")).map((g) => g.map((p) => p.part_number).sort());
  assert.deepEqual(groups.sort(), [["SCR-12-BO", "SCR-12-ZN"], ["SCR-16-ZN"]].sort());
});

test("the most-used variant becomes the standard and differences are listed", () => {
  const c = findCandidates(parts, new Map()).find((x) => x.standard.part_number === "BRK-A1")!;
  assert.equal(c.partNumbersRemoved, 1);
  assert.deepEqual(c.products, ["P1", "P2"]);
  assert.deepEqual(c.differences.map((d) => d.attr), ["thickness_mm", "width_mm"]);
});

test("standardizing adds savings beyond consolidating each variant separately", () => {
  const tiers: [number, number][] = [[1, 1.0], [300, 0.8]];
  const d = (pn: string, units: number): PartDemand => ({
    part_number: pn, description: "", category: "screw", months: ["m1"],
    plants: { PEO: { supplier: "A", units: [units], spend: units } }, tiers: { A: tiers },
  });
  // 200 + 200: neither reaches 300 alone, together they do.
  const demand = new Map([["SCR-12-ZN", d("SCR-12-ZN", 200)], ["SCR-12-BO", d("SCR-12-BO", 200)]]);
  const c = findCandidates(parts.filter((p) => p.part_number.startsWith("SCR-12")), demand)[0];
  assert.ok(Math.abs(c.priceSavings - 80) < 1e-9); // 400 x ($1.00 - $0.80)
});

test("commonality index", () => {
  const { perProduct, core } = commonality(parts, ["P1", "P2", "P3"]);
  assert.equal(perProduct.find((p) => p.product === "P1")!.shared, 1);
  assert.deepEqual(core.map((p) => p.part_number), ["SCR-16-ZN"]);
});
