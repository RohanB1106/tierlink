import "server-only";
import { sql } from "@/lib/db";
import { simulate, type PartDemand, type Tier } from "@/lib/pricing/consolidation";
import { trueCost, type BomLine, type Product } from "@/lib/pricing/true-cost";

/** Only confident matches count: auto-matched or human-approved. */
const CONFIDENT = ["auto", "approved"];

export async function getWindow() {
  const [r] = await sql`select date_trunc('month', max(po_date))::date as last_month from purchases`;
  const last = new Date(r.last_month);
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  return { months, start: `${months[0]}-01` };
}

export async function getPlants() {
  return (await sql`select plant_id, name from plants where plant_id <> 'SVC' order by plant_id`) as unknown as {
    plant_id: string;
    name: string;
  }[];
}

export async function getSupplierNames() {
  const rows = await sql`select supplier_id, name from suppliers`;
  return Object.fromEntries(rows.map((r) => [r.supplier_id as string, r.name as string]));
}

export async function getTiers(partNumber?: string) {
  const rows = await sql`
    select sp.part_number, pb.supplier_id, pb.tier, pb.min_qty_units, pb.unit_price::float8 as unit_price
    from price_breaks pb
    join sku_parts sp using (supplier_id, supplier_sku)
    where ${partNumber ? sql`sp.part_number = ${partNumber}` : sql`true`}
    order by sp.part_number, pb.supplier_id, pb.min_qty_units`;
  const out: Record<string, Record<string, Tier[]>> = {};
  for (const r of rows) {
    ((out[r.part_number] ??= {})[r.supplier_id] ??= []).push([r.min_qty_units, r.unit_price]);
  }
  return out;
}

/** 12 months of production demand per part and plant, plus each supplier's price tiers. */
export async function getDemand(): Promise<{ parts: PartDemand[]; months: string[] }> {
  const { months, start } = await getWindow();
  const rows = await sql`
    select m.part_number, pt.description, pt.category, p.plant_id, p.supplier_id,
           to_char(p.po_date, 'YYYY-MM') as ym,
           sum((m.evidence->>'units')::int)::int as units,
           sum(p.extended_amount)::float8 as spend
    from purchases p
    join matches m using (line_id)
    join parts pt on pt.part_number = m.part_number
    where p.order_type = 'PRODUCTION' and m.status in ${sql(CONFIDENT)} and p.po_date >= ${start}
    group by 1, 2, 3, 4, 5, 6`;
  const tiers = await getTiers();

  const parts = new Map<string, PartDemand>();
  // Units by part -> plant -> supplier, to pick each plant's main supplier.
  const supplierUnits = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const part: PartDemand = parts.get(r.part_number) ?? {
      part_number: r.part_number,
      description: r.description,
      category: r.category,
      months,
      plants: {},
      tiers: tiers[r.part_number] ?? {},
    };
    parts.set(r.part_number, part);
    const d = (part.plants[r.plant_id] ??= { supplier: r.supplier_id, units: months.map(() => 0), spend: 0 });
    d.units[months.indexOf(r.ym)] += r.units;
    d.spend += r.spend;
    const key = `${r.part_number}|${r.plant_id}`;
    const su = supplierUnits.get(key) ?? new Map<string, number>();
    su.set(r.supplier_id, (su.get(r.supplier_id) ?? 0) + r.units);
    supplierUnits.set(key, su);
  }
  for (const part of parts.values()) {
    for (const [plant, d] of Object.entries(part.plants)) {
      const su = supplierUnits.get(`${part.part_number}|${plant}`)!;
      d.supplier = [...su.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
  }
  return { parts: [...parts.values()], months };
}

export async function getPartList() {
  const { start } = await getWindow();
  return (await sql`
    select pt.part_number, pt.category, pt.description, pt.used_in,
           coalesce(sum(p.extended_amount) filter (where p.po_date >= ${start}), 0)::float8 as spend_12m,
           coalesce(sum(p.extended_amount) filter (where p.order_type <> 'PRODUCTION'), 0)::float8 as service_spend,
           count(distinct p.supplier_id)::int as suppliers,
           count(p.line_id)::int as lines
    from parts pt
    left join matches m on m.part_number = pt.part_number and m.status in ${sql(CONFIDENT)}
    left join purchases p on p.line_id = m.line_id
    group by pt.part_number
    order by spend_12m desc`) as unknown as {
    part_number: string;
    category: string;
    description: string;
    used_in: string[];
    spend_12m: number;
    service_spend: number;
    suppliers: number;
    lines: number;
  }[];
}

export interface Receipt {
  line_id: string;
  po_number: string;
  po_date: Date;
  plant_id: string;
  supplier_name: string;
  item_description: string;
  order_type: string;
  amount: number;
  units: number;
  unit_price: number;
  status: string;
  method: string;
}

export async function getPart(partNumber: string) {
  const [part] = await sql`select part_number, category, description, attributes, used_in from parts where part_number = ${partNumber}`;
  if (!part) return null;
  const receipts = (await sql`
    select p.line_id, p.po_number, p.po_date, p.plant_id, s.name as supplier_name, p.item_description,
           p.order_type, p.extended_amount::float8 as amount,
           (m.evidence->>'units')::int as units, (m.evidence->>'unit_price')::float8 as unit_price,
           m.status, m.method
    from purchases p
    join matches m using (line_id)
    join suppliers s using (supplier_id)
    where m.part_number = ${partNumber} and m.status in ${sql(CONFIDENT)}
    order by p.po_date desc`) as unknown as Receipt[];
  const bom = await sql`
    select b.product_id, pr.name, b.assembly, b.qty_per::float8 as qty_per, pr.annual_volume
    from bom b join products pr using (product_id)
    where b.part_number = ${partNumber}
    order by b.product_id`;
  return { part, receipts, bom };
}

/** True cost per product for the last 12 months, plus spend not yet allocated (pending review). */
export async function getProductCosts() {
  const { start, months } = await getWindow();
  const [{ parts }, products, bom, service, [unallocated]] = await Promise.all([
    getDemand(),
    sql`select product_id, name, plant_id, annual_volume from products order by product_id` as unknown as Promise<Product[]>,
    sql`select product_id, part_number, qty_per::float8 as qty_per from bom` as unknown as Promise<BomLine[]>,
    sql`
      select m.part_number, sum(p.extended_amount)::float8 as spend
      from purchases p join matches m using (line_id)
      where p.order_type <> 'PRODUCTION' and m.status in ${sql(CONFIDENT)} and p.po_date >= ${start}
      group by 1`,
    sql`
      select coalesce(sum(p.extended_amount), 0)::float8 as spend, count(*)::int as lines
      from purchases p join matches m using (line_id)
      where m.status not in ${sql(CONFIDENT)} and p.po_date >= ${start}`,
  ]);
  const plants = [...new Set(parts.flatMap((p) => Object.keys(p.plants)))];
  const pooling = simulate(parts, { plants, allowSupplierSwitch: true });
  const costs = trueCost(
    products,
    bom,
    parts,
    Object.fromEntries(service.map((r) => [r.part_number as string, r.spend as number])),
    Object.fromEntries(pooling.results.map((r) => [r.part_number, r.savings])),
  );
  return {
    costs,
    window: `${months[0]} to ${months[months.length - 1]}`,
    unallocated: unallocated as { spend: number; lines: number },
  };
}
