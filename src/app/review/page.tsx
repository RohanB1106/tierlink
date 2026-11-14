import type { Metadata } from "next";
import { sql } from "@/lib/db";
import type { MatchEvidence } from "@/lib/matching/match";
import { decide } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review Queue · TierLink" };

interface PendingRow {
  line_id: string;
  po_number: string;
  po_date: Date;
  plant_id: string;
  supplier_name: string;
  supplier_sku: string;
  item_description: string;
  uom: string;
  qty: number;
  price_per_uom: string;
  extended_amount: string;
  order_type: string;
  part_number: string | null;
  confidence: string;
  method: string;
  evidence: MatchEvidence;
}

const money = (v: number, digits = 2) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });

const METHOD_LABEL: Record<string, string> = {
  "sku-history": "Suggested from SKU history",
  "attributes-partial": "Partial attribute match",
  ambiguous: "Several parts fit",
  attributes: "No part fits",
  none: "Unknown part type",
};

export default async function ReviewPage() {
  const [counts] = await sql`
    select count(*) filter (where status = 'auto')::int as auto,
           count(*) filter (where status = 'pending')::int as pending,
           count(*) filter (where status = 'approved')::int as approved,
           count(*) filter (where status = 'rejected')::int as rejected
    from matches`;

  const rows = (await sql`
    select m.line_id, p.po_number, p.po_date, p.plant_id, s.name as supplier_name, p.supplier_sku,
           p.item_description, p.uom, p.qty, p.price_per_uom, p.extended_amount, p.order_type,
           m.part_number, m.confidence, m.method, m.evidence
    from matches m
    join purchases p using (line_id)
    join suppliers s using (supplier_id)
    where m.status = 'pending'
    order by (m.part_number is null), p.extended_amount desc
    limit 60`) as unknown as PendingRow[];

  const partNumbers = [...new Set(rows.flatMap((r) => r.evidence.candidates.map((c) => c.part_number)))];
  const descriptions = new Map(
    partNumbers.length
      ? (await sql`select part_number, description from parts where part_number in ${sql(partNumbers)}`).map(
          (r) => [r.part_number as string, r.description as string],
        )
      : [],
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Review Queue</h1>
      <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-300">
        Invoice lines the Ingestion Agent could not match with certainty. Nothing here counts toward savings until a
        person approves it. Every decision is logged.
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Auto-matched", counts.auto],
          ["Waiting for review", counts.pending],
          ["Approved", counts.approved],
          ["Rejected", counts.rejected],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <dd className="text-2xl font-semibold tabular-nums">{Number(value).toLocaleString()}</dd>
            <dt className="mt-1 text-sm text-neutral-500">{label}</dt>
          </div>
        ))}
      </dl>

      {rows.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-neutral-300 p-8 text-center text-neutral-500 dark:border-neutral-700">
          The queue is empty. Every invoice line is matched or decided.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {rows.map((r) => (
            <ReviewCard key={r.line_id} row={r} descriptions={descriptions} />
          ))}
        </ul>
      )}
    </main>
  );
}

function ReviewCard({ row: r, descriptions }: { row: PendingRow; descriptions: Map<string, string> }) {
  const ev = r.evidence;
  const confidence = Math.round(Number(r.confidence) * 100);
  const fitting = ev.candidates.filter((c) => c.conflicts.length === 0);
  const defaultPart = r.part_number ?? (fitting.length === 1 ? fitting[0].part_number : null);

  return (
    <li className="rounded-xl border border-neutral-200 p-4 sm:p-5 dark:border-neutral-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Invoice wording, as received</div>
          <div className="mt-1 break-words font-mono text-sm sm:text-base">{r.item_description || "(blank)"}</div>
          <div className="mt-1 text-sm text-neutral-500">
            {r.supplier_name} · SKU {r.supplier_sku} · {r.po_number} · {r.plant_id} ·{" "}
            {new Date(r.po_date).toISOString().slice(0, 10)}
            {r.order_type !== "PRODUCTION" && ` · ${r.order_type.toLowerCase()}`}
          </div>
        </div>
        <div className="sm:text-right">
          <div className="font-semibold tabular-nums">{money(Number(r.extended_amount))}</div>
          <div className="text-sm text-neutral-500 tabular-nums">
            {r.qty} {r.uom} = {ev.units.toLocaleString()} pcs @ {money(ev.unit_price, 4)}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            r.part_number
              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
              : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
          }`}
        >
          {METHOD_LABEL[r.method] ?? r.method}
        </span>
        <span className="text-neutral-500">Confidence {confidence}%</span>
        <span className="text-neutral-500">· Read from text: {ev.parsed.rules.join(", ") || "nothing"}</span>
      </div>
      <ul className="mt-2 list-disc pl-5 text-sm text-neutral-600 dark:text-neutral-400">
        {ev.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>

      <form action={decide} className="mt-4">
        <input type="hidden" name="line_id" value={r.line_id} />
        <fieldset>
          <legend className="text-sm font-medium">Candidate parts</legend>
          <div className="mt-2 space-y-2">
            {ev.candidates.map((c) => {
              const fits = c.conflicts.length === 0;
              return (
                <label
                  key={c.part_number}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50 dark:has-[:checked]:bg-violet-950/30 ${
                    fits ? "border-neutral-200 dark:border-neutral-800" : "border-neutral-200 opacity-60 dark:border-neutral-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="part_number"
                    value={c.part_number}
                    defaultChecked={c.part_number === defaultPart}
                    className="mt-1 accent-violet-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-mono font-medium">{c.part_number}</span>
                    {c.part_number === r.part_number && <span className="ml-2 text-xs text-violet-600 dark:text-violet-400">suggested</span>}
                    <span className="block text-neutral-500">{descriptions.get(c.part_number)}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {c.matched.map((a) => (
                        <Chip key={a} tone="ok">{a} ✓</Chip>
                      ))}
                      {c.unknown.map((a) => (
                        <Chip key={a} tone="unknown">{a} ?</Chip>
                      ))}
                      {c.conflicts.map((x) => (
                        <Chip key={x.attr} tone="bad">
                          {x.attr}: invoice {String(x.invoice ?? "–")} ≠ {String(x.engineering ?? "–")}
                        </Chip>
                      ))}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            name="reason"
            placeholder="Reason (optional), e.g. checked drawing rev B"
            className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
          />
          <div className="flex gap-2">
            <button
              name="action"
              value="approve"
              className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              Approve match
            </button>
            <button
              name="action"
              value="reject"
              formNoValidate
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Reject
            </button>
          </div>
        </div>
      </form>
    </li>
  );
}

function Chip({ tone, children }: { tone: "ok" | "unknown" | "bad"; children: React.ReactNode }) {
  const cls = {
    ok: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    unknown: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
    bad: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  }[tone];
  return <span className={`rounded px-1.5 py-0.5 text-xs ${cls}`}>{children}</span>;
}
