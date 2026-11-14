"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";

/** Approve or reject a proposed match. Every decision is logged in match_decisions. */
export async function decide(formData: FormData) {
  const lineId = String(formData.get("line_id") ?? "");
  const action = String(formData.get("action") ?? "");
  const partNumber = (formData.get("part_number") as string | null) || null;
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!lineId || !["approve", "reject"].includes(action)) throw new Error("Invalid decision");
  if (action === "approve" && !partNumber) throw new Error("Pick a part before approving");

  await sql.begin(async (tx) => {
    if (action === "approve") {
      const [part] = await tx`select 1 from parts where part_number = ${partNumber}`;
      if (!part) throw new Error(`Unknown part ${partNumber}`);
      await tx`
        update matches set part_number = ${partNumber}, status = 'approved', match_type = 'identical',
               confidence = 1, updated_at = now()
        where line_id = ${lineId}`;
    } else {
      await tx`update matches set status = 'rejected', updated_at = now() where line_id = ${lineId}`;
    }
    await tx`
      insert into match_decisions (line_id, part_number, action, reason)
      values (${lineId}, ${partNumber}, ${action}, ${reason})`;
  });

  revalidatePath("/review");
  revalidatePath("/");
}
