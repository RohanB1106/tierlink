// Consolidation Simulator: what if plants pooled their monthly orders for a part?
//
// Method (kept deliberately conservative, per the Velocity research):
//  - Use the last 12 months of matched production purchases as the demand forecast.
//  - Price both the current behaviour and the pooled scenario off the SAME supplier price lists,
//    so the saving comes only from reaching better tiers / better suppliers, not from mixing
//    list prices with invoice prices.
//  - Apply that % saving to the actual spend in the window to get an annual dollar figure.
//  - Unapproved (pending) matches are excluded, so nothing uncertain becomes a claimed saving.

/** [minQtyUnits, unitPrice], sorted by minQty ascending. */
export type Tier = [number, number];

export interface PlantDemand {
  /** The supplier this plant mostly buys this part from today. */
  supplier: string;
  /** Units per month, aligned with PartDemand.months. */
  units: number[];
  /** Actual invoiced spend in the window. */
  spend: number;
}

export interface PartDemand {
  part_number: string;
  description: string;
  category: string;
  months: string[];
  plants: Record<string, PlantDemand>;
  tiers: Record<string, Tier[]>;
}

export interface Scenario {
  supplier: string;
  modelCost: number;
  /** Highest tier number reached in a typical (median) month. */
  typicalTier: number;
}

export interface PartResult {
  part_number: string;
  description: string;
  category: string;
  plants: string[];
  currentSuppliers: string[];
  actualSpend: number;
  baselineModelCost: number;
  baselineTypicalTier: number;
  poolKeep: Scenario | null;
  poolBest: Scenario | null;
  /** Annual $ saving for the chosen scenario, scaled to actual spend. */
  savings: number;
  savingsPct: number;
  chosen: Scenario | null;
}

export function priceAt(tiers: Tier[], qty: number): number {
  let price = tiers[0][1];
  for (const [min, p] of tiers) if (qty >= min) price = p;
  return price;
}

export function tierAt(tiers: Tier[], qty: number): number {
  let t = 1;
  tiers.forEach(([min], i) => {
    if (qty >= min) t = i + 1;
  });
  return t;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

function pooledScenario(pooled: number[], supplier: string, tiers: Tier[]): Scenario {
  return {
    supplier,
    modelCost: pooled.reduce((sum, q) => sum + q * priceAt(tiers, q), 0),
    typicalTier: tierAt(tiers, median(pooled.filter((q) => q > 0))),
  };
}

export interface SimOptions {
  /** Plants whose orders may be pooled. Others stay as they are. */
  plants: string[];
  /** If false, the pooled order must go to a supplier one of the plants already uses. */
  allowSupplierSwitch: boolean;
}

export function simulatePart(part: PartDemand, opts: SimOptions): PartResult {
  const included = Object.keys(part.plants).filter((p) => opts.plants.includes(p));
  const base: PartResult = {
    part_number: part.part_number,
    description: part.description,
    category: part.category,
    plants: Object.keys(part.plants),
    currentSuppliers: [...new Set(Object.values(part.plants).map((d) => d.supplier))],
    actualSpend: 0,
    baselineModelCost: 0,
    baselineTypicalTier: 1,
    poolKeep: null,
    poolBest: null,
    savings: 0,
    savingsPct: 0,
    chosen: null,
  };

  const usable = included.filter((p) => part.tiers[part.plants[p].supplier]);
  if (usable.length === 0) return base;

  const pooled = part.months.map((_, i) => usable.reduce((s, p) => s + part.plants[p].units[i], 0));
  base.actualSpend = usable.reduce((s, p) => s + part.plants[p].spend, 0);
  base.baselineModelCost = usable.reduce((sum, p) => {
    const d = part.plants[p];
    return sum + d.units.reduce((s, q) => s + q * priceAt(part.tiers[d.supplier], q), 0);
  }, 0);
  base.baselineTypicalTier = Math.min(
    ...usable.map((p) => tierAt(part.tiers[part.plants[p].supplier], median(part.plants[p].units.filter((q) => q > 0)))),
  );

  const cheapest = (suppliers: string[]) =>
    suppliers
      .filter((s) => part.tiers[s])
      .map((s) => pooledScenario(pooled, s, part.tiers[s]))
      .sort((a, b) => a.modelCost - b.modelCost)[0] ?? null;

  base.poolKeep = cheapest([...new Set(usable.map((p) => part.plants[p].supplier))]);
  base.poolBest = cheapest(Object.keys(part.tiers));
  const chosen = opts.allowSupplierSwitch ? base.poolBest : base.poolKeep;
  base.chosen = chosen;

  if (chosen && base.baselineModelCost > 0 && chosen.modelCost < base.baselineModelCost) {
    base.savingsPct = 1 - chosen.modelCost / base.baselineModelCost;
    base.savings = base.savingsPct * base.actualSpend;
  }
  return base;
}

export function simulate(parts: PartDemand[], opts: SimOptions) {
  const results = parts.map((p) => simulatePart(p, opts)).sort((a, b) => b.savings - a.savings);
  const spend = results.reduce((s, r) => s + r.actualSpend, 0);
  const savings = results.reduce((s, r) => s + r.savings, 0);
  return { results, spend, savings, savingsPct: spend ? savings / spend : 0 };
}
