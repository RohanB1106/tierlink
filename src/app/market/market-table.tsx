"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import type { MarketResult } from "@/lib/pricing/market";
import { money, num, partHref, pct } from "@/lib/format";

type Filter = "all" | "above" | "material" | "part";

const price = (v: number) => money(v, v < 1 ? 4 : 2);

/** Search links on real industrial distributors, so a buyer can check live prices themselves. */
function realSupplierLinks(name: string) {
  const term = name.split(",")[0].replace(/\(.*?\)/g, "").trim();
  const slug = term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return [
    { label: "Grainger", href: `https://www.grainger.com/search?searchQuery=${encodeURIComponent(term)}` },
    { label: "McMaster-Carr", href: `https://www.mcmaster.com/${slug}/` },
  ];
}

const STATUS = {
  above: { label: "Above market", cls: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300" },
  at: { label: "At market", cls: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300" },
  below: { label: "Below market", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
};

export function MarketTable({ results }: { results: MarketResult[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(results.find((r) => r.status === "above")?.item_key ?? null);
  const rows = results.filter((r) =>
    filter === "all" ? true : filter === "above" ? r.status === "above" : r.item_type === filter,
  );

  return (
    <section className="mt-8">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter items">
        {(
          [
            ["all", `All (${results.length})`],
            ["above", `Above market (${results.filter((r) => r.status === "above").length})`],
            ["material", "Raw materials"],
            ["part", "Purchased parts"],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              filter === f
                ? "bg-violet-600 text-white"
                : "border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
            <tr>
              <th className="py-2 pr-3 font-medium">Item</th>
              <th className="py-2 pr-3 text-right font-medium">We pay</th>
              <th className="py-2 pr-3 font-medium">Market range</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Best alternative</th>
              <th className="py-2 text-right font-medium">Savings / yr</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isOpen = open === r.item_key;
              return (
                <Fragment key={r.item_key}>
                  <tr
                    className="cursor-pointer border-b border-neutral-100 align-middle hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900/50"
                    onClick={() => setOpen(isOpen ? null : r.item_key)}
                    aria-expanded={isOpen}
                  >
                    <td className="py-3 pr-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-neutral-500">
                        {r.item_type === "part" ? (
                          <Link href={partHref(r.item_key)} onClick={(e) => e.stopPropagation()} className="font-mono hover:underline">
                            {r.item_key}
                          </Link>
                        ) : (
                          "Raw material"
                        )}{" "}
                        · {r.suppliers.join(", ")}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      <div className="font-medium">{price(r.ourPrice)}</div>
                      <div className="text-xs text-neutral-500">per {r.unit}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <RangeBar r={r} />
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[r.status].cls}`}>
                        {STATUS[r.status].label} {r.vsMedian >= 0 ? "+" : ""}
                        {pct(r.vsMedian)}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      {r.status === "above" && r.best ? (
                        <>
                          <div className="font-medium">
                            {r.best.vendor} <span className="text-xs font-normal text-neutral-500">(sample vendor)</span>
                          </div>
                          <div className="text-xs text-neutral-500 tabular-nums">
                            {price(r.best.unit_price)} · {pct(r.best.pctBelowOurs)} less · {r.best.lead_time_days}-day lead time
                          </div>
                        </>
                      ) : (
                        <span className="text-neutral-400">{r.status === "above" ? "No quote fits our order size" : "Keep current supplier"}</span>
                      )}
                    </td>
                    <td className="py-3 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {r.status === "above" && r.best ? money(r.best.annualSavings) : "–"}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-neutral-100 bg-neutral-50 dark:border-neutral-900 dark:bg-neutral-900/40">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="text-xs text-neutral-500">
                          {num(r.annualQty)} {r.unit} a year · market median {price(r.median)} (range {price(r.low)}–{price(r.high)}) · {r.source}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                          <span className="text-neutral-600 dark:text-neutral-400">Check live prices from real suppliers:</span>
                          {realSupplierLinks(r.name).map((l) => (
                            <a
                              key={l.label}
                              href={l.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-md border border-neutral-300 px-2 py-0.5 font-medium text-violet-700 hover:border-violet-400 hover:bg-violet-50 dark:border-neutral-700 dark:text-violet-300 dark:hover:bg-violet-950/30"
                            >
                              {l.label} ↗
                            </a>
                          ))}
                        </div>
                        <table className="mt-3 w-full text-left text-sm">
                          <thead className="text-neutral-500">
                            <tr>
                              <th className="py-1 pr-3 font-medium">Sample vendor</th>
                              <th className="py-1 pr-3 text-right font-medium">Quote</th>
                              <th className="py-1 pr-3 text-right font-medium">vs. ours</th>
                              <th className="py-1 pr-3 text-right font-medium">Min. order</th>
                              <th className="py-1 pr-3 text-right font-medium">Lead time</th>
                              <th className="py-1 pr-3 font-medium">Terms</th>
                              <th className="py-1 text-right font-medium">Savings / yr</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.alternatives.map((a) => (
                              <tr key={a.vendor} className={a === r.best ? "font-medium" : ""}>
                                <td className="py-1 pr-3">
                                  {a.vendor}
                                  {a === r.best && <span className="ml-2 text-xs text-violet-600 dark:text-violet-400">best fit</span>}
                                  {!a.fitsMonthlyOrder && <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">min. order above our monthly volume</span>}
                                </td>
                                <td className="py-1 pr-3 text-right tabular-nums">{price(a.unit_price)}</td>
                                <td className={`py-1 pr-3 text-right tabular-nums ${a.unit_price < r.ourPrice ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                                  {a.unit_price < r.ourPrice ? "−" : "+"}
                                  {pct(Math.abs(a.pctBelowOurs))}
                                </td>
                                <td className="py-1 pr-3 text-right tabular-nums">
                                  {num(a.min_qty)} {r.unit}
                                </td>
                                <td className="py-1 pr-3 text-right tabular-nums">{a.lead_time_days} days</td>
                                <td className="py-1 pr-3">{a.terms}</td>
                                <td className="py-1 text-right tabular-nums">{a.annualSavings > 0.5 ? money(a.annualSavings) : "–"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Low–high market range with the median tick and a dot for our price. */
function RangeBar({ r }: { r: MarketResult }) {
  const medianPos = (r.median - r.low) / (r.high - r.low);
  const dot =
    r.status === "above" ? "bg-rose-600" : r.status === "below" ? "bg-emerald-600" : "bg-neutral-700 dark:bg-neutral-200";
  return (
    <div className="w-44">
      <div className="relative h-2 rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden>
        <div className="absolute top-[-3px] h-[14px] w-px bg-neutral-500" style={{ left: `${medianPos * 100}%` }} />
        <div
          className={`absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-neutral-950 ${dot}`}
          style={{ left: `${r.position * 100}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-neutral-500">
        <span>{price(r.low)}</span>
        <span>{price(r.high)}</span>
      </div>
      <span className="sr-only">
        Market range {price(r.low)} to {price(r.high)}, median {price(r.median)}; we pay {price(r.ourPrice)}.
      </span>
    </div>
  );
}
