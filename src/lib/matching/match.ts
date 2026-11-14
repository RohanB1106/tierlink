// Matches supplier purchase lines to engineering part numbers and builds an "evidence passport" for each.
//
// Rules of thumb (from the Velocity research):
//  - Only auto-match when exactly one part fits every identity attribute. Everything else goes to a human.
//  - Keep the evidence (parsed attributes, candidates, conflicts) so a reviewer can see *why*.
//  - A similarity score alone never becomes a claimed saving.

import { parseDescription, type AttrValue, type Attrs, type ParsedDescription } from "./parse.ts";

export interface PartRecord {
  part_number: string;
  category: string;
  description: string;
  attributes: Attrs;
}

export interface PurchaseLine {
  line_id: string;
  supplier_id: string;
  supplier_sku: string;
  item_description: string;
  qty: number;
  price_per_uom: number;
}

export type MatchType = "identical" | "alternative" | "similar" | "unmatched";
export type MatchStatus = "auto" | "pending" | "approved" | "rejected";

export interface CandidateCheck {
  part_number: string;
  matched: string[];
  unknown: string[];
  conflicts: { attr: string; invoice: AttrValue | null; engineering: AttrValue | null }[];
}

export interface MatchEvidence {
  parsed: ParsedDescription;
  units: number;
  unit_price: number;
  candidates: CandidateCheck[];
  sku_history?: { part_number: string; prior_matches: number };
  reasons: string[];
}

export interface MatchResult {
  line_id: string;
  part_number: string | null;
  confidence: number;
  match_type: MatchType;
  status: MatchStatus;
  method: string;
  evidence: MatchEvidence;
}

/** Attributes that define "the same part" in each category. */
export const IDENTITY_KEYS: Record<string, string[]> = {
  screw: ["thread", "length_mm", "finish"],
  bolt: ["thread", "length_mm", "finish"],
  nut: ["thread", "finish"],
  washer: ["thread", "finish"],
  bearing: ["designation"],
  spring: ["wire_mm", "od_mm", "length_mm"],
  bracket: ["thickness_mm", "width_mm", "hole_mm"],
  gear: ["module", "teeth"],
  motor: ["type", "volts", "rpm"],
  battery: ["volts", "ah"],
  switch: ["type", "volts"],
  pcb: ["volts"],
  cord: ["awg", "length_ft"],
  housing: ["product"],
  grip: ["product"],
  chuck: ["size_in"],
  blade: ["dia_in", "teeth"],
  guard: ["position", "dia_in"],
};

export const AUTO_CONFIDENCE = 0.97;
export const PARTIAL_CONFIDENCE = 0.75;
export const SKU_HISTORY_CONFIDENCE = 0.9;
export const SKU_HISTORY_MIN_MATCHES = 3;

/** Engineering attributes used for identity, with small derivations where the part master is implicit. */
export function partIdentity(part: PartRecord): Attrs {
  const keys = IDENTITY_KEYS[part.category] ?? [];
  const out: Attrs = {};
  for (const k of keys) if (part.attributes[k] !== undefined) out[k] = part.attributes[k];
  if (part.category === "guard") out.position = part.attributes.dia_in !== undefined ? "wheel" : "lower";
  return out;
}

const same = (a: AttrValue, b: AttrValue) =>
  typeof a === "number" || typeof b === "number"
    ? Math.abs(Number(a) - Number(b)) < 1e-9
    : String(a).toLowerCase() === String(b).toLowerCase();

export function checkCandidate(parsed: ParsedDescription, part: PartRecord): CandidateCheck {
  const eng = partIdentity(part);
  const keys = new Set([...(IDENTITY_KEYS[part.category] ?? []), ...Object.keys(eng)]);
  const check: CandidateCheck = { part_number: part.part_number, matched: [], unknown: [], conflicts: [] };
  for (const k of keys) {
    const inv = parsed.attrs[k];
    const e = eng[k];
    if (inv === undefined && e === undefined) continue;
    if (inv === undefined) check.unknown.push(k);
    else if (e === undefined) check.conflicts.push({ attr: k, invoice: inv, engineering: null });
    else if (same(inv, e)) check.matched.push(k);
    else check.conflicts.push({ attr: k, invoice: inv, engineering: e });
  }
  return check;
}

export function matchLine(line: PurchaseLine, partsByCategory: Map<string, PartRecord[]>): MatchResult {
  const parsed = parseDescription(line.item_description);
  const evidence: MatchEvidence = {
    parsed,
    units: line.qty * parsed.packSize,
    unit_price: round(line.price_per_uom / parsed.packSize, 6),
    candidates: [],
    reasons: [],
  };
  const base = { line_id: line.line_id, evidence };

  if (!parsed.category) {
    evidence.reasons.push("Could not tell what kind of part this is from the description.");
    return { ...base, part_number: null, confidence: 0, match_type: "unmatched", status: "pending", method: "none" };
  }

  const checks = (partsByCategory.get(parsed.category) ?? []).map((p) => checkCandidate(parsed, p));
  const consistent = checks.filter((c) => c.conflicts.length === 0);
  // Show reviewers the consistent candidates first, then the closest conflicting ones.
  evidence.candidates = [
    ...consistent,
    ...checks.filter((c) => c.conflicts.length > 0).sort((a, b) => a.conflicts.length - b.conflicts.length || b.matched.length - a.matched.length),
  ].slice(0, 6);

  if (consistent.length === 0) {
    evidence.reasons.push(`No ${parsed.category} in the part master fits these attributes.`);
    return { ...base, part_number: null, confidence: 0, match_type: "unmatched", status: "pending", method: "attributes" };
  }

  if (consistent.length === 1) {
    const only = consistent[0];
    if (only.unknown.length === 0) {
      evidence.reasons.push(`Every identity attribute matches (${only.matched.join(", ")}) and no other part fits.`);
      return { ...base, part_number: only.part_number, confidence: AUTO_CONFIDENCE, match_type: "identical", status: "auto", method: "attributes" };
    }
    evidence.reasons.push(`Only one part fits, but the invoice does not state: ${only.unknown.join(", ")}.`);
    return { ...base, part_number: only.part_number, confidence: PARTIAL_CONFIDENCE, match_type: "identical", status: "pending", method: "attributes-partial" };
  }

  const missing = [...new Set(consistent.flatMap((c) => c.unknown))];
  evidence.reasons.push(`${consistent.length} parts fit; the invoice is missing ${missing.join(", ") || "distinguishing details"}.`);
  return {
    ...base,
    part_number: null,
    confidence: round(1 / consistent.length, 3),
    match_type: "unmatched",
    status: "pending",
    method: "ambiguous",
  };
}

/**
 * Second pass: if a supplier SKU has repeatedly auto-matched to one part, suggest that part for
 * vague lines with the same SKU. Still sent to a human, but with a strong, explained suggestion.
 */
export function applySkuHistory(results: MatchResult[], lines: PurchaseLine[]): MatchResult[] {
  const lineById = new Map(lines.map((l) => [l.line_id, l]));
  const history = new Map<string, Map<string, number>>();
  for (const r of results) {
    if (r.status !== "auto" || !r.part_number) continue;
    const l = lineById.get(r.line_id)!;
    const key = `${l.supplier_id}|${l.supplier_sku}`;
    const counts = history.get(key) ?? new Map<string, number>();
    counts.set(r.part_number, (counts.get(r.part_number) ?? 0) + 1);
    history.set(key, counts);
  }

  return results.map((r) => {
    if (r.status === "auto") return r;
    const l = lineById.get(r.line_id)!;
    const counts = history.get(`${l.supplier_id}|${l.supplier_sku}`);
    if (!counts || counts.size !== 1) return r;
    const [[pn, prior]] = [...counts.entries()];
    const fits = r.evidence.candidates.some((c) => c.part_number === pn && c.conflicts.length === 0);
    if (prior < SKU_HISTORY_MIN_MATCHES || !fits) return r;
    return {
      ...r,
      part_number: pn,
      confidence: SKU_HISTORY_CONFIDENCE,
      match_type: "identical",
      method: "sku-history",
      evidence: {
        ...r.evidence,
        sku_history: { part_number: pn, prior_matches: prior },
        reasons: [
          ...r.evidence.reasons,
          `Supplier SKU ${l.supplier_sku} matched ${pn} on ${prior} earlier invoices. Suggested; needs approval.`,
        ],
      },
    };
  });
}

export function matchAll(lines: PurchaseLine[], parts: PartRecord[]): MatchResult[] {
  const byCat = new Map<string, PartRecord[]>();
  for (const p of parts) byCat.set(p.category, [...(byCat.get(p.category) ?? []), p]);
  return applySkuHistory(lines.map((l) => matchLine(l, byCat)), lines);
}

function round(x: number, d: number) {
  const f = 10 ** d;
  return Math.round(x * f) / f;
}
