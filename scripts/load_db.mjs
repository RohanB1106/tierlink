// Creates the TierLink schema and loads data/*.csv into Postgres.
// Never loads data/_ground_truth.csv: that file is only for scoring the matcher.
//
// Usage:  node --env-file=.env.local scripts/load_db.mjs

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL found. Run: vercel env pull .env.local");
  process.exit(1);
}
const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });

const csv = (name) => parse(readFileSync(join(root, "data", name)), { columns: true, skip_empty_lines: true });

const withoutKey = (obj, key) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
const num = (v) => (v === "" || v == null ? null : Number(v));
const attrValue = (v) => (v !== "" && !Number.isNaN(Number(v)) ? Number(v) : v);
const parseAttrs = (s) =>
  Object.fromEntries(
    (s || "")
      .split(";")
      .map((kv) => kv.trim())
      .filter(Boolean)
      .map((kv) => {
        const i = kv.indexOf("=");
        return [kv.slice(0, i), attrValue(kv.slice(i + 1))];
      }),
  );

async function insert(table, rows, chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    await sql`insert into ${sql(table)} ${sql(rows.slice(i, i + chunk))}`;
  }
  console.log(`  ${table.padEnd(14)} ${rows.length.toLocaleString()} rows`);
}

async function main() {
  console.log("Applying schema...");
  await sql.unsafe(readFileSync(join(root, "db", "schema.sql"), "utf8"));

  console.log("Loading data...");
  await insert("plants", csv("plants.csv"));
  await insert("suppliers", csv("suppliers.csv"));
  await insert(
    "products",
    csv("products.csv").map((r) => ({ ...r, annual_volume: num(r.annual_volume) })),
  );
  await insert(
    "parts",
    csv("parts.csv").map((r) => ({
      part_number: r.part_number,
      category: r.category,
      description: r.description,
      attributes: sql.json(parseAttrs(r.attributes)),
      used_in: r.used_in ? r.used_in.split("|") : [],
    })),
  );
  await insert("bom", csv("bom.csv").map((r) => ({ ...r, qty_per: num(r.qty_per) })));
  await insert(
    "price_breaks",
    csv("price_breaks.csv").map((r) => ({
      ...r,
      tier: num(r.tier),
      min_qty_units: num(r.min_qty_units),
      max_qty_units: num(r.max_qty_units),
      unit_price: num(r.unit_price),
      pack_size: num(r.pack_size),
    })),
  );
  await insert(
    "purchases",
    csv("purchases.csv").map((r) => ({
      ...withoutKey(r, "supplier_name"), // supplier name lives in the suppliers table
      qty: num(r.qty),
      price_per_uom: num(r.price_per_uom),
      extended_amount: num(r.extended_amount),
    })),
  );

  const [s] = await sql`
    select count(*)::int as lines,
           sum(extended_amount)::numeric(14,0) as spend,
           count(*) filter (where order_type <> 'PRODUCTION')::int as service_lines
    from purchases`;
  console.log(`\nCheck: ${s.lines.toLocaleString()} purchase lines, $${Number(s.spend).toLocaleString()} spend, ${s.service_lines} spare/warranty lines`);
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
