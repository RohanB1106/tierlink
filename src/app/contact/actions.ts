"use server";

import { z } from "zod";
import { leadsSql } from "@/lib/leads-db";
import { ERPS, GOALS, PLANTS, SEGMENTS, SPEND } from "./options";

export type LeadState = { ok: boolean; error?: string };

const opt = (list: string[]) => z.enum(list as [string, ...string[]]).optional().or(z.literal("").transform(() => undefined));

const Lead = z.object({
  name: z.string().trim().min(1, "Please add your name").max(120),
  email: z.string().trim().email("Please add a valid work email").max(200),
  company: z.string().trim().min(1, "Please add your company").max(200),
  role: z.string().trim().max(120).optional(),
  segment: opt(SEGMENTS),
  plants: opt(PLANTS),
  annual_spend: opt(SPEND),
  erp: opt(ERPS),
  goals: z.array(z.enum(GOALS as [string, ...string[]])).max(GOALS.length),
  message: z.string().trim().max(2000).optional(),
  website: z.string().max(0).optional(), // honeypot: real people leave it empty
});

export async function requestReview(_prev: LeadState, form: FormData): Promise<LeadState> {
  const p = Lead.safeParse({
    ...Object.fromEntries(["name", "email", "company", "role", "segment", "plants", "annual_spend", "erp", "message", "website"].map((k) => [k, form.get(k) ?? undefined])),
    goals: form.getAll("goals"),
  });
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Please check the form" };
  if (p.data.website) return { ok: true }; // bot; pretend it worked
  const d = p.data;
  try {
    await leadsSql`
      insert into leads (name, email, company, role, segment, plants, annual_spend, erp, goals, message)
      values (${d.name}, ${d.email}, ${d.company}, ${d.role || null}, ${d.segment ?? null}, ${d.plants ?? null},
              ${d.annual_spend ?? null}, ${d.erp ?? null}, ${d.goals}, ${d.message || null})`;
  } catch (e) {
    console.error("lead insert failed", e);
    return { ok: false, error: "Something went wrong on our side. Please try again in a minute." };
  }
  return { ok: true };
}
