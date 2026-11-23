// Creates the leads table in the tierlink_leads database.
// Run: node --env-file=.env.local scripts/setup_leads.mjs
import { readFileSync } from "node:fs";
import postgres from "postgres";

const base = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!base) throw new Error("No DATABASE_URL. Run: vercel env pull .env.local");
const admin = postgres(base, { ssl: "require" });
const [exists] = await admin`select 1 from pg_database where datname = 'tierlink_leads'`;
if (!exists) await admin.unsafe("create database tierlink_leads");
await admin.end();

const u = new URL(base);
u.pathname = "/tierlink_leads";
const sql = postgres(u.toString(), { ssl: "require" });
await sql.unsafe(readFileSync(new URL("../db/leads.sql", import.meta.url), "utf8"));
console.log("leads table ready");
await sql.end();
