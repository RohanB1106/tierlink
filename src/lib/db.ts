import "server-only";
import postgres from "postgres";

const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Run: npx vercel env pull .env.local");
  // prepare: false because Neon's pooled connection runs through PgBouncer.
  return postgres(url, { ssl: "require", prepare: false, max: 5 });
}

export const sql = globalForDb.sql ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
