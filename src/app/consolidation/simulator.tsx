"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { simulate, type PartDemand } from "@/lib/pricing/consolidation";
import { moneyShort, money, partHref, pct } from "@/lib/format";

interface Props {
  parts: PartDemand[];
  plants: { plant_id: string; name: string }[];
  suppliers: Record<string, string>;
  window: string;
}

export function Simulator({ parts, plants, suppliers, window }: Props) {
  const [included, setIncluded] = useState<string[]>(plants.map((p) => p.plant_id));
  const [allowSwitch, setAllowSwitch] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const keep = useMemo(() => simulate(parts, { plants: included, allowSupplierSwitch: false }), [parts, included]);
  const best = useMemo(() => simulate(parts, { plants: included, allowSupplierSwitch: true }), [parts, included]);
  const current = allowSwitch ? best : keep;
  const rows = current.results.filter((r) => r.savings > 0.5);
  const visible = showAll ? rows : rows.slice(0, 12);

  const toggle = (id: string) =>
    setIncluded((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  return (
    <>
      <section className="mt-6 flex flex-col gap-4 rounded-xl border border-neutral-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800">
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <legend className="sr-only">Plants that pool orders</legend>
          <span className="text-sm font-medium">Pool orders from</span>
          {plants.map((p) => (
            <label key={p.plant_id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={included.includes(p.plant_id)}
                onChange={() => toggle(p.plant_id)}
                className="size-4 accent-violet-600"
              />
              {p.name}
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowSwitch}
            onChange={(e) => setAllowSwitch(e.target.checked)}
            className="size-4 accent-violet-600"
          />
          Allow switching to a cheaper supplier
        </label>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-violet-300 bg-violet-50 p-5 sm:col-span-1 dark:border-violet-800 dark:bg-violet-950/30">
          <div className="text-sm text-violet-700 dark:text-violet-300">Estimated annual savings</div>
          <div className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">{moneyShort(current.savings)}</div>
          <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {pct(current.savingsPct)} of {moneyShort(current.spend)} spend on these parts
          </div>
        </div>
        <Scenario
          title="Pool orders, keep a current supplier"
          value={keep.savings}
          pctOf={keep.savingsPct}
          active={!allowSwitch}
        />
        <Scenario title="Pool orders + best-priced supplier" value={best.savings} pctOf={best.savingsPct} active={allowSwitch} />
      </section>
      <p className="mt-2 text-xs text-neutral-500">
        Based on confidently matched production purchases, {window}. Today&apos;s orders and the pooled orders are both
        priced from the same supplier price lists, and the % difference is applied to actual spend. Lines still in the
        review queue are excluded.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Where the savings are</h2>
        {rows.length === 0 ? (
          <p className="mt-4 text-neutral-500">No savings with these settings. Try pooling at least two plants.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                <tr>
                  <th className="py-2 pr-3 font-medium">Part</th>
                  <th className="py-2 pr-3 font-medium">Plants</th>
                  <th className="py-2 pr-3 font-medium">Supplier today → pooled</th>
                  <th className="py-2 pr-3 font-medium">Price tier</th>
                  <th className="py-2 pr-3 text-right font-medium">Spend / yr</th>
                  <th className="py-2 text-right font-medium">Savings / yr</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const switched = r.chosen && !r.currentSuppliers.includes(r.chosen.supplier);
                  return (
                    <tr key={r.part_number} className="border-b border-neutral-100 align-top dark:border-neutral-900">
                      <td className="py-2 pr-3">
                        <Link href={partHref(r.part_number)} className="font-mono font-medium text-violet-700 hover:underline dark:text-violet-300">
                          {r.part_number}
                        </Link>
                        <div className="text-xs text-neutral-500">{r.description}</div>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{r.plants.filter((p) => included.includes(p)).join(", ")}</td>
                      <td className="py-2 pr-3">
                        <span className="text-neutral-500">{r.currentSuppliers.map((s) => suppliers[s] ?? s).join(", ")}</span>
                        <span className="mx-1">→</span>
                        <span className={switched ? "font-medium text-violet-700 dark:text-violet-300" : ""}>
                          {r.chosen ? (suppliers[r.chosen.supplier] ?? r.chosen.supplier) : "–"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        Tier {r.baselineTypicalTier} → <span className="font-medium">Tier {r.chosen?.typicalTier ?? "–"}</span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{money(r.actualSpend)}</td>
                      <td className="py-2 text-right tabular-nums">
                        <div className="font-semibold">{money(r.savings)}</div>
                        <div className="text-xs text-neutral-500">{pct(r.savingsPct)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 12 && (
          <button
            onClick={() => setShowAll((s) => !s)}
            className="mt-3 rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {showAll ? "Show top 12" : `Show all ${rows.length} parts`}
          </button>
        )}
      </section>
    </>
  );
}

function Scenario({ title, value, pctOf, active }: { title: string; value: number; pctOf: number; active: boolean }) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        active ? "border-neutral-400 dark:border-neutral-500" : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <div className="text-sm text-neutral-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{moneyShort(value)}</div>
      <div className="text-sm text-neutral-500">{pct(pctOf)} per year</div>
    </div>
  );
}
