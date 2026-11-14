/**
 * First line of defence for the assistant's SQL tool: exactly one SELECT / WITH statement.
 * The real guard is the read-only transaction the query runs in; this just gives clear errors.
 * Returns the cleaned query, or an error message.
 */
export function checkSql(query: string): { sql: string } | { error: string } {
  const q = query.trim().replace(/;+\s*$/, "");
  if (!/^(select|with)\b/i.test(q)) return { error: "Only SELECT or WITH ... SELECT queries are allowed." };
  if (q.includes(";")) return { error: "Only one statement is allowed." };
  return { sql: q };
}
