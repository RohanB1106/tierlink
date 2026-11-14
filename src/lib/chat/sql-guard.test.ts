import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSql } from "./sql-guard.ts";

test("allows a single SELECT or WITH, trailing semicolon trimmed", () => {
  assert.deepEqual(checkSql("select 1;"), { sql: "select 1" });
  assert.deepEqual(checkSql("  WITH x AS (select 1) select * from x  "), { sql: "WITH x AS (select 1) select * from x" });
});

test("rejects writes and multiple statements", () => {
  for (const q of ["delete from parts", "update matches set status='approved'", "drop table parts", "insert into x values (1)"]) {
    assert.ok("error" in checkSql(q), q);
  }
  assert.ok("error" in checkSql("select 1; delete from parts"));
});
