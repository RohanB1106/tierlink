// Rapid Platforming: find near-duplicate parts that could be standardized onto one part number.
//
// Rules (from the Velocity research): "similar" is never treated as "interchangeable" automatically.
// Every group is a *candidate* that engineering must qualify, and its saving is reported separately
// from the same-part consolidation saving so nothing is counted twice.

import { simulatePart, type PartDemand } from "./consolidation.ts";

export interface PlatformPart {
  part_number: string;
  category: string;
  description: string;
  attributes: Record<string, string | number>;
  /** Pieces consumed per year across all products (annual volume x qty per unit). */
  annualUnits: number;
  products: string[];
}

interface Rule {
  exact: string[];
  /** Numeric attributes allowed to differ by up to `tol` (relative). */
  numeric?: string[];
  tol?: number;
  /** Attributes allowed to differ freely (e.g. finish), flagged for engineering. */
  soft?: string[];
}

export const RULES: Record<string, Rule> = {
  bracket: { exact: ["material"], numeric: ["thickness_mm", "width_mm", "hole_mm"], tol: 0.1 },
  screw: { exact: ["thread", "length_mm", "head"], soft: ["finish"] },
  bolt: { exact: ["thread", "length_mm"], soft: ["finish"] },
  nut: { exact: ["thread"], soft: ["finish"] },
  washer: { exact: ["thread"], soft: ["finish"] },
  spring: { exact: [], numeric: ["wire_mm", "od_mm", "length_mm"], tol: 0.1 },
};

export function compatible(a: PlatformPart, b: PlatformPart): boolean {
  if (a.category !== b.category) return false;
  const rule = RULES[a.category];
  if (!rule) return false;
  for (const k of rule.exact) if (String(a.attributes[k] ?? "") !== String(b.attributes[k] ?? "")) return false;
  for (const k of rule.numeric ?? []) {
    const x = Number(a.attributes[k]);
    const y = Number(b.attributes[k]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (Math.abs(x - y) / Math.max(x, y) > (rule.tol ?? 0)) return false;
  }
  return true;
}

/** Complete-linkage grouping: a part joins a group only if it is compatible with every member. */
export function cluster(parts: PlatformPart[]): PlatformPart[][] {
  const sorted = [...parts].sort((a, b) => b.annualUnits - a.annualUnits || a.part_number.localeCompare(b.part_number));
  const groups: PlatformPart[][] = [];
  for (const p of sorted) {
    const g = groups.find((members) => members.every((m) => compatible(m, p)));
    if (g) g.push(p);
    else groups.push([p]);
  }
  return groups;
}

export interface Differences {
  attr: string;
  values: (string | number)[];
}

export interface Candidate {
  category: string;
  standard: PlatformPart;
  variants: PlatformPart[];
  differences: Differences[];
  partNumbersRemoved: number;
  products: string[];
  spend: number;
  /** Extra annual price saving from standardizing, on top of same-part consolidation. */
  priceSavings: number;
}

function mergeDemand(group: PlatformPart[], demand: Map<string, PartDemand>): PartDemand | null {
  const std = demand.get(group[0].part_number);
  if (!std || Object.keys(std.tiers).length === 0) return null;
  const merged: PartDemand = { ...std, plants: {} };
  for (const v of group) {
    const d = demand.get(v.part_number);
    if (!d) continue;
    for (const [plant, pd] of Object.entries(d.plants)) {
      const m = (merged.plants[plant] ??= {
        supplier: Object.keys(std.tiers)[0],
        units: std.months.map(() => 0),
        spend: 0,
      });
      pd.units.forEach((u, i) => (m.units[i] += u));
      m.spend += pd.spend;
    }
  }
  return merged;
}

export function findCandidates(parts: PlatformPart[], demand: Map<string, PartDemand>): Candidate[] {
  return cluster(parts)
    .filter((g) => g.length > 1)
    .map((g) => {
      const rule = RULES[g[0].category];
      const keys = [...(rule.numeric ?? []), ...(rule.soft ?? [])];
      const differences = keys
        .map((attr) => ({ attr, values: [...new Set(g.map((p) => p.attributes[attr]))].filter((v) => v !== undefined) }))
        .filter((d) => d.values.length > 1);

      // Price effect: each variant consolidated on its own vs. all variants merged onto the standard.
      const plants = [...new Set(g.flatMap((v) => Object.keys(demand.get(v.part_number)?.plants ?? {})))];
      const opts = { plants, allowSupplierSwitch: true };
      let separate = 0;
      let baseline = 0;
      let spend = 0;
      for (const v of g) {
        const d = demand.get(v.part_number);
        if (!d) continue;
        const r = simulatePart(d, opts);
        separate += r.chosen ? Math.min(r.chosen.modelCost, r.baselineModelCost) : r.baselineModelCost;
        baseline += r.baselineModelCost;
        spend += r.actualSpend;
      }
      const merged = mergeDemand(g, demand);
      const together = merged ? simulatePart(merged, opts).chosen?.modelCost ?? separate : separate;
      const priceSavings = baseline > 0 ? Math.max(0, ((separate - together) / baseline) * spend) : 0;

      return {
        category: g[0].category,
        standard: g[0],
        variants: g.slice(1),
        differences,
        partNumbersRemoved: g.length - 1,
        products: [...new Set(g.flatMap((p) => p.products))].sort(),
        spend,
        priceSavings,
      };
    })
    .sort((a, b) => b.partNumbersRemoved - a.partNumbersRemoved || b.priceSavings - a.priceSavings);
}

/** Which parts each product shares with others: the basis for a common core + add-on modules. */
export function commonality(parts: PlatformPart[], products: string[]) {
  const perProduct = products.map((product) => {
    const own = parts.filter((p) => p.products.includes(product));
    const shared = own.filter((p) => p.products.length > 1);
    return { product, parts: own.length, shared: shared.length, index: own.length ? shared.length / own.length : 0 };
  });
  const core = parts.filter((p) => p.products.length >= Math.ceil(products.length / 2));
  return { perProduct, core };
}
