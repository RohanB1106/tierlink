// True Cost per Product: what each product really costs once purchase spend is tied back to its BOM.
//
// For each product and each part in its BOM (all figures per unit of product, last 12 months):
//   quoted   = qty_per x the price-list price the plant should pay at its usual order size
//   actual   = qty_per x the average price per piece the plant actually paid (spend / pieces).
//              Using a price rather than a spend total means lines still in review don't skew it.
//   service  = spare & warranty spend on that part, shared among ALL products that use it, same rule
//   pooling  = the part's consolidation saving, shared the same way
// true cost = actual + service. Uncertain (pending) purchase lines are not allocated.

import { priceAt, type PartDemand } from "./consolidation.ts";

export interface Product {
  product_id: string;
  name: string;
  plant_id: string;
  annual_volume: number;
}

export interface BomLine {
  product_id: string;
  part_number: string;
  qty_per: number;
}

export interface CostLine {
  part_number: string;
  description: string;
  qty_per: number;
  quoted: number;
  actual: number;
  service: number;
  pooling: number;
  /** Share of this part's consumption that this product accounts for (0..1). */
  share: number;
}

export interface ProductCost extends Product {
  quoted: number;
  actual: number;
  service: number;
  trueCost: number;
  pooling: number;
  optimized: number;
  lines: CostLine[];
}

/** Average price per piece the plant actually paid (confident lines only), so missing lines don't skew it. */
const paidPrice = (d?: { units: number[]; spend: number }) => {
  const units = d ? d.units.reduce((a, b) => a + b, 0) : 0;
  return d && units ? d.spend / units : 0;
};

const median = (xs: number[]) => {
  const s = xs.filter((x) => x > 0).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export function trueCost(
  products: Product[],
  bom: BomLine[],
  demand: PartDemand[],
  serviceSpend: Record<string, number>,
  poolingSavings: Record<string, number>,
): ProductCost[] {
  const byPart = new Map(demand.map((d) => [d.part_number, d]));
  const productById = new Map(products.map((p) => [p.product_id, p]));
  const weight = (b: BomLine) => (productById.get(b.product_id)?.annual_volume ?? 0) * b.qty_per;

  // Merge duplicate BOM rows (same part in two assemblies of one product).
  const merged = new Map<string, BomLine>();
  for (const b of bom) {
    const k = `${b.product_id}|${b.part_number}`;
    const m = merged.get(k);
    merged.set(k, m ? { ...m, qty_per: m.qty_per + b.qty_per } : { ...b });
  }
  const lines = [...merged.values()];

  const globalWeight = new Map<string, number>();
  for (const b of lines) {
    if (!productById.has(b.product_id)) continue;
    globalWeight.set(b.part_number, (globalWeight.get(b.part_number) ?? 0) + weight(b));
  }

  return products.map((product) => {
    const own = lines.filter((b) => b.product_id === product.product_id);
    const costLines: CostLine[] = own.map((b) => {
      const d = byPart.get(b.part_number);
      const w = weight(b);
      const gShare = w / (globalWeight.get(b.part_number) || 1);
      const plantD = d?.plants[product.plant_id];

      let quotedPrice = 0;
      if (d && plantD && d.tiers[plantD.supplier]) {
        quotedPrice = priceAt(d.tiers[plantD.supplier], median(plantD.units));
      } else if (d) {
        const firstTier = Object.values(d.tiers).map((t) => t[0][1]);
        quotedPrice = firstTier.length ? Math.min(...firstTier) : 0;
      }
      const perUnit = (total: number) => (product.annual_volume ? total / product.annual_volume : 0);
      return {
        part_number: b.part_number,
        description: d?.description ?? "",
        qty_per: b.qty_per,
        quoted: b.qty_per * quotedPrice,
        actual: b.qty_per * paidPrice(plantD),
        service: perUnit((serviceSpend[b.part_number] ?? 0) * gShare),
        pooling: perUnit((poolingSavings[b.part_number] ?? 0) * gShare),
        share: gShare,
      };
    });
    const total = (k: "quoted" | "actual" | "service" | "pooling") => costLines.reduce((s, l) => s + l[k], 0);
    const actual = total("actual");
    const service = total("service");
    const pooling = total("pooling");
    return {
      ...product,
      quoted: total("quoted"),
      actual,
      service,
      trueCost: actual + service,
      pooling,
      optimized: actual + service - pooling,
      lines: costLines.sort((a, b) => b.actual + b.service - (a.actual + a.service)),
    };
  });
}
