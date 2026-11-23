import "server-only";
import postgres from "postgres";

// Leads live in a separate database on the same Neon project. The chatbot only
// ever connects to the demo database, so it cannot read customer details.
const globalForLeads = globalThis as unknown as { leadsSql?: ReturnType<typeof postgres> };

export function leadsUrl(base = process.env.DATABASE_URL) {
  if (!base) throw new Error("DATABASE_URL is not set");
  const u = new URL(base);
  u.pathname = "/tierlink_leads";
  return u.toString();
}

export const leadsSql =
  globalForLeads.leadsSql ?? postgres(leadsUrl(), { ssl: "require", prepare: false, max: 2 });
if (process.env.NODE_ENV !== "production") globalForLeads.leadsSql = leadsSql;
