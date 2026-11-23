// Prints savings-review requests, newest first.
// Run: node --env-file=.env.local scripts/list_leads.mjs
import postgres from "postgres";

const u = new URL(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
u.pathname = "/tierlink_leads";
const sql = postgres(u.toString(), { ssl: "require" });
const rows = await sql`select * from leads order by created_at desc`;
if (!rows.length) console.log("No requests yet.");
for (const r of rows) {
  console.log(`\n${r.created_at.toISOString().slice(0, 16)}  ${r.company}  (${r.segment ?? "-"})`);
  console.log(`  ${r.name}${r.role ? `, ${r.role}` : ""} <${r.email}>`);
  console.log(`  plants: ${r.plants ?? "-"} · spend: ${r.annual_spend ?? "-"} · ERP: ${r.erp ?? "-"}`);
  if (r.goals?.length) console.log(`  wants: ${r.goals.join(", ")}`);
  if (r.message) console.log(`  note: ${r.message}`);
}
await sql.end();
