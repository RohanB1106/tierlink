// Scores the saved matches against data/_ground_truth.csv (the hidden answer key).
// This is the ONLY place the ground truth is read.
//
// Usage:  npm run match:eval

import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import postgres from "postgres";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("No DATABASE_URL. Run: npx vercel env pull .env.local");
const sql = postgres(url, { ssl: "require", max: 1 });

const truth = new Map<string, { part_number: string; vague: string }>(
  (parse(readFileSync(new URL("../data/_ground_truth.csv", import.meta.url)), { columns: true }) as {
    line_id: string; part_number: string; vague: string;
  }[]).map((r) => [r.line_id, r]),
);
const matches = await sql`
  select m.line_id, m.part_number, m.status, m.method, p.extended_amount::float8 as amount
  from matches m join purchases p using (line_id)`;

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "n/a");
const auto = matches.filter((m) => m.status === "auto");
const autoRight = auto.filter((m) => m.part_number === truth.get(m.line_id)?.part_number);
const suggested = matches.filter((m) => m.status === "pending" && m.part_number);
const suggestedRight = suggested.filter((m) => m.part_number === truth.get(m.line_id)?.part_number);
const vagueAuto = auto.filter((m) => truth.get(m.line_id)?.vague === "True");
const spend = matches.reduce((s, m) => s + m.amount, 0);
const autoSpend = auto.reduce((s, m) => s + m.amount, 0);

console.log("Matching accuracy vs. answer key");
console.log(`  auto-matched lines       ${auto.length}/${matches.length} (${pct(auto.length, matches.length)} of lines, ${pct(autoSpend, spend)} of spend)`);
console.log(`  auto-match precision     ${autoRight.length}/${auto.length} correct (${pct(autoRight.length, auto.length)})`);
console.log(`  review suggestions       ${suggestedRight.length}/${suggested.length} correct (${pct(suggestedRight.length, suggested.length)})`);
console.log(`  vague lines auto-matched ${vagueAuto.length} (should be 0)`);
const wrong = auto.filter((m) => m.part_number !== truth.get(m.line_id)?.part_number).slice(0, 5);
for (const w of wrong) console.log(`  WRONG ${w.line_id}: got ${w.part_number}, expected ${truth.get(w.line_id)?.part_number}`);
await sql.end();
