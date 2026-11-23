import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { sql } from "@/lib/db";
import { simulate } from "@/lib/pricing/consolidation";
import { getDemand, getMarketCheck, getPart, getPlatformData, getProductCosts, getSupplierNames, getTiers } from "@/lib/queries";
import { checkSql } from "@/lib/chat/sql-guard";

// Tools the TierLink Chatbot can call. All are read-only.

const MAX_ROWS = 100;

const RunSql = z.object({ sql: z.string().min(1).max(4000) });
const Consolidation = z.object({
  plants: z.array(z.enum(["PEO", "CHA", "FTW"])).optional(),
  allow_supplier_switch: z.boolean().optional(),
  top: z.number().int().min(1).max(50).optional(),
});
const ProductCosts = z.object({ product_id: z.string().optional() });
const Part = z.object({ part_number: z.string().min(1) });
const Empty = z.object({});
const Market = z.object({
  status: z.enum(["above", "at", "below", "all"]).optional(),
  item: z.string().optional(),
});

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "get_market_price_check",
    description:
      "Compare what we pay for benchmarked raw materials (e.g. aluminum per oz, steel per lb) and high-spend parts with the market price range, and list cheaper alternative vendors with annual savings. Same method as the /market page.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["above", "at", "below", "all"], description: "Filter by market status. Default all." },
        item: { type: "string", description: "Optional: a material name/key or part number to look up." },
      },
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: "run_sql",
    description:
      "Run one read-only PostgreSQL SELECT (or WITH ... SELECT) against the TierLink database and get up to 100 rows back as JSON. Use for ad hoc questions the other tools don't cover. The schema is in the system prompt.",
    input_schema: {
      type: "object",
      properties: { sql: { type: "string", description: "A single SELECT statement, no trailing semicolon needed." } },
      required: ["sql"],
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: "get_consolidation_savings",
    description:
      "Run the Consolidation Simulator: pool monthly orders across plants to reach better price tiers. Returns annual savings overall and the top parts. Same method as the /consolidation page.",
    input_schema: {
      type: "object",
      properties: {
        plants: {
          type: "array",
          items: { type: "string", enum: ["PEO", "CHA", "FTW"] },
          description: "Plants whose orders pool. Default: all three.",
        },
        allow_supplier_switch: { type: "boolean", description: "Allow moving to a cheaper supplier. Default true." },
        top: { type: "integer", description: "How many parts to return (default 10)." },
      },
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: "get_product_costs",
    description:
      "True cost per product unit vs. quoted BOM cost, spare/warranty cost and cost after pooling. Optionally one product with its part-by-part breakdown. Same method as the /products page.",
    input_schema: {
      type: "object",
      properties: { product_id: { type: "string", description: "e.g. PD-20. Omit for all products." } },
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: "get_part_details",
    description: "One part: description, attributes, products using it, supplier price tiers, spend and recent receipts.",
    input_schema: {
      type: "object",
      properties: { part_number: { type: "string" } },
      required: ["part_number"],
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: "get_platform_candidates",
    description: "Near-duplicate parts that could be standardized onto one part number, with extra savings, plus product commonality.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
    eager_input_streaming: true,
  },
];

async function runSql(query: string): Promise<{ error: string } | { rows: unknown[]; truncated: boolean }> {
  const checked = checkSql(query);
  if ("error" in checked) return checked;
  const q = checked.sql;
  // Read-only transaction + timeout: even a query that slips past checkSql cannot write.
  const rows = await sql.begin("read only", async (tx) => {
    await tx`set local statement_timeout = 5000`;
    return tx.unsafe(`select * from (${q}) as q limit ${MAX_ROWS + 1}`);
  });
  return { rows: rows.slice(0, MAX_ROWS), truncated: rows.length > MAX_ROWS };
}

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

type Result = { ok: true; content: unknown } | { ok: false; error: string };

export async function runTool(name: string, input: unknown): Promise<Result> {
  try {
    switch (name) {
      case "run_sql": {
        const p = RunSql.safeParse(input);
        if (!p.success) return { ok: false, error: "INVALID_INPUT: expected { sql: string }" };
        const r = await runSql(p.data.sql);
        return "error" in r ? { ok: false, error: r.error } : { ok: true, content: r };
      }
      case "get_consolidation_savings": {
        const p = Consolidation.safeParse(input ?? {});
        if (!p.success) return { ok: false, error: "INVALID_INPUT" };
        const [{ parts }, names] = await Promise.all([getDemand(), getSupplierNames()]);
        const name = (id?: string) => (id ? (names[id] ?? id) : undefined);
        const s = simulate(parts, {
          plants: p.data.plants ?? ["PEO", "CHA", "FTW"],
          allowSupplierSwitch: p.data.allow_supplier_switch ?? true,
        });
        return {
          ok: true,
          content: {
            annual_savings: round(s.savings, 0),
            savings_pct: round(s.savingsPct * 100, 1),
            spend_considered: round(s.spend, 0),
            method: "12 months of confidently matched production purchases; today's and pooled orders priced from the same supplier price lists; % applied to actual spend",
            top_parts: s.results
              .filter((r) => r.savings > 0.5)
              .slice(0, p.data.top ?? 10)
              .map((r) => ({
                part_number: r.part_number,
                description: r.description,
                plants: r.plants,
                suppliers_today: r.currentSuppliers.map(name),
                pooled_supplier: name(r.chosen?.supplier),
                tier_today: r.baselineTypicalTier,
                tier_pooled: r.chosen?.typicalTier,
                spend: round(r.actualSpend, 0),
                savings: round(r.savings, 0),
                savings_pct: round(r.savingsPct * 100, 1),
              })),
          },
        };
      }
      case "get_product_costs": {
        const p = ProductCosts.safeParse(input ?? {});
        if (!p.success) return { ok: false, error: "INVALID_INPUT" };
        const { costs, unallocated } = await getProductCosts();
        const pick = p.data.product_id ? costs.filter((c) => c.product_id === p.data.product_id) : costs;
        if (p.data.product_id && pick.length === 0) return { ok: false, error: `No product ${p.data.product_id}` };
        return {
          ok: true,
          content: {
            per_unit_usd: pick.map((c) => ({
              product_id: c.product_id,
              name: c.name,
              plant: c.plant_id,
              annual_volume: c.annual_volume,
              quoted_bom: round(c.quoted),
              actual_material: round(c.actual),
              spare_warranty: round(c.service),
              true_cost: round(c.trueCost),
              gap_vs_quote_pct: round((c.trueCost / c.quoted - 1) * 100, 1),
              after_pooling: round(c.optimized),
              ...(p.data.product_id
                ? {
                    parts: c.lines.map((l) => ({
                      part_number: l.part_number,
                      qty: l.qty_per,
                      quoted: round(l.quoted),
                      actual: round(l.actual),
                      spare_warranty: round(l.service),
                      pooling_saving: round(l.pooling),
                      share_of_part_use: round(l.share, 2),
                    })),
                  }
                : {}),
            })),
            unallocated_review_queue_spend: round(unallocated.spend, 0),
          },
        };
      }
      case "get_part_details": {
        const p = Part.safeParse(input);
        if (!p.success) return { ok: false, error: "INVALID_INPUT" };
        const [detail, tiers, names] = await Promise.all([
          getPart(p.data.part_number),
          getTiers(p.data.part_number),
          getSupplierNames(),
        ]);
        if (!detail) return { ok: false, error: `No part ${p.data.part_number}` };
        const production = detail.receipts.filter((r) => r.order_type === "PRODUCTION");
        const service = detail.receipts.filter((r) => r.order_type !== "PRODUCTION");
        return {
          ok: true,
          content: {
            part: detail.part,
            used_in: detail.bom,
            price_tiers_by_supplier: Object.fromEntries(
              Object.entries(tiers[p.data.part_number] ?? {}).map(([id, t]) => [
                names[id] ?? id,
                t.map(([min_qty, unit_price]) => ({ min_qty, unit_price })),
              ]),
            ),
            production_spend_24m: round(production.reduce((s, r) => s + r.amount, 0), 0),
            spare_warranty_spend_24m: round(service.reduce((s, r) => s + r.amount, 0), 0),
            recent_receipts: detail.receipts.slice(0, 10).map((r) => ({
              date: new Date(r.po_date).toISOString().slice(0, 10),
              plant: r.plant_id,
              supplier: r.supplier_name,
              invoice_wording: r.item_description,
              units: r.units,
              unit_price: round(r.unit_price, 4),
              amount: round(r.amount),
              type: r.order_type,
            })),
          },
        };
      }
      case "get_market_price_check": {
        const p = Market.safeParse(input ?? {});
        if (!p.success) return { ok: false, error: "INVALID_INPUT" };
        const m = await getMarketCheck();
        const q = p.data.item?.toLowerCase();
        const rows = m.results.filter(
          (r) =>
            (!p.data.status || p.data.status === "all" || r.status === p.data.status) &&
            (!q || r.item_key.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)),
        );
        return {
          ok: true,
          content: {
            items_above_market: m.above,
            annual_paid_above_median: round(m.overpay, 0),
            annual_savings_best_alternatives: round(m.altSavings, 0),
            note: "Our price = last 3 months weighted average; quantity = last 12 months. Benchmarks and quotes are illustrative demo data.",
            items: rows.map((r) => ({
              item: r.item_key,
              name: r.name,
              type: r.item_type,
              unit: r.unit,
              our_price: round(r.ourPrice, 4),
              current_suppliers: r.suppliers,
              market_low: r.low,
              market_median: r.median,
              market_high: r.high,
              status: r.status,
              vs_median_pct: round(r.vsMedian * 100, 1),
              annual_qty: round(r.annualQty, 0),
              annual_overpay: round(r.annualOverpay, 0),
              alternatives: r.alternatives.map((a) => ({
                vendor: a.vendor,
                unit_price: a.unit_price,
                min_order: a.min_qty,
                lead_time_days: a.lead_time_days,
                terms: a.terms,
                annual_savings: round(a.annualSavings, 0),
                fits_our_monthly_order: a.fitsMonthlyOrder,
              })),
              best_alternative: r.best?.vendor ?? null,
            })),
          },
        };
      }
      case "get_platform_candidates": {
        if (!Empty.safeParse(input ?? {}).success) return { ok: false, error: "INVALID_INPUT" };
        const { candidates, common } = await getPlatformData();
        return {
          ok: true,
          content: {
            groups: candidates.map((c) => ({
              category: c.category,
              standard: c.standard.part_number,
              variants: c.variants.map((v) => v.part_number),
              differences: c.differences,
              products: c.products,
              part_numbers_removed: c.partNumbersRemoved,
              extra_annual_savings: round(c.priceSavings, 0),
              note: "candidate only; needs engineering sign-off",
            })),
            commonality: common.perProduct.map((p) => ({ ...p, index: round(p.index, 2) })),
          },
        };
      }
      default:
        return { ok: false, error: `Unknown tool ${name}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Tool failed" };
  }
}
