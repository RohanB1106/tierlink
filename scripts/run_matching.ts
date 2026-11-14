// Ingestion Agent (batch mode): matches every purchase line to a part and saves an evidence passport.
// Re-runnable. Lines a human already approved or rejected are left untouched.
//
// Usage:  npm run match

import postgres from "postgres";
import { matchAll, type PartRecord, type PurchaseLine } from "../src/lib/matching/match.ts";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("No DATABASE_URL. Run: npx vercel env pull .env.local");
const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });

const parts = (await sql`select part_number, category, description, attributes from parts`) as unknown as PartRecord[];
const lines = (
  await sql`select line_id, supplier_id, supplier_sku, item_description, qty, price_per_uom::float8 as price_per_uom from purchases`
) as unknown as PurchaseLine[];
const decided = new Set(
  (await sql`select line_id from matches where status in ('approved','rejected')`).map((r) => r.line_id as string),
);

const t0 = performance.now();
const results = matchAll(lines, parts).filter((r) => !decided.has(r.line_id));
const ms = performance.now() - t0;

const rows = results.map((r) => ({
  line_id: r.line_id,
  part_number: r.part_number,
  confidence: r.confidence,
  match_type: r.match_type,
  status: r.status,
  method: r.method,
  evidence: sql.json(JSON.parse(JSON.stringify(r.evidence))),
}));
for (let i = 0; i < rows.length; i += 500) {
  await sql`
    insert into matches ${sql(rows.slice(i, i + 500))}
    on conflict (line_id) do update set
      part_number = excluded.part_number, confidence = excluded.confidence, match_type = excluded.match_type,
      status = excluded.status, method = excluded.method, evidence = excluded.evidence, updated_at = now()`;
}

// Decode supplier price lists too, so SKUs that were quoted but never bought are still comparable.
const catalog = (await sql`
  select distinct supplier_id, supplier_sku, supplier_description as item_description
  from price_breaks`) as unknown as { supplier_id: string; supplier_sku: string; item_description: string }[];
const catalogResults = matchAll(
  catalog.map((c) => ({ ...c, line_id: `${c.supplier_id}|${c.supplier_sku}`, qty: 1, price_per_uom: 0 })),
  parts,
);
const catalogRows = catalogResults
  .filter((r) => r.status === "auto" && r.part_number)
  .map((r) => {
    const [supplier_id, supplier_sku] = r.line_id.split("|");
    return { supplier_id, supplier_sku, part_number: r.part_number!, confidence: r.confidence };
  });
await sql`delete from catalog_matches`;
if (catalogRows.length) await sql`insert into catalog_matches ${sql(catalogRows)}`;

const count = (f: (r: (typeof results)[number]) => boolean) => results.filter(f).length;
console.log(`Price lists: ${catalogRows.length}/${catalog.length} supplier SKUs decoded`);
console.log(`Matched ${lines.length.toLocaleString()} lines in ${ms.toFixed(0)} ms (${decided.size} human decisions kept)`);
console.log(`  auto-matched           ${count((r) => r.status === "auto")}`);
console.log(`  review: suggested      ${count((r) => r.status === "pending" && !!r.part_number)}`);
console.log(`  review: ambiguous      ${count((r) => r.status === "pending" && !r.part_number && r.method === "ambiguous")}`);
console.log(`  review: no match       ${count((r) => r.status === "pending" && !r.part_number && r.method !== "ambiguous")}`);
await sql.end();
