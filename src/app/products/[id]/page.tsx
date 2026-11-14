import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductCosts } from "@/lib/queries";
import { money, moneyShort, num, partHref, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: `${(await params).id} cost · TierLink` };
}

export default async function ProductCostPage({ params }: Params) {
  const { id } = await params;
  const { costs, window } = await getProductCosts();
  const p = costs.find((c) => c.product_id === id);
  if (!p) notFound();
  const gap = p.trueCost - p.quoted;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <Link href="/products" className="text-sm text-neutral-500 hover:underline">
        ← All products
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {p.product_id} <span className="text-neutral-500">· {p.name}</span>
      </h1>
      <p className="mt-1 text-neutral-600 dark:text-neutral-300">
        Built at {p.plant_id} · {num(p.annual_volume)} units a year · {p.lines.length} purchased parts
      </p>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Quoted BOM cost" value={money(p.quoted, 2)} />
        <Stat label="True cost" value={money(p.trueCost, 2)} note={`+${pct(p.trueCost / p.quoted - 1)} vs. quote`} tone="bad" />
        <Stat label="Hidden cost per year" value={moneyShort(gap * p.annual_volume)} note={`${money(gap, 2)} per unit`} tone="bad" />
        <Stat label="After pooling orders" value={money(p.optimized, 2)} note={`saves ${moneyShort(p.pooling * p.annual_volume)}/yr`} tone="good" />
      </section>

      <h2 className="mt-10 text-xl font-semibold">Cost by part</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Per unit of {p.product_id}, {window}. &quot;Shared&quot; parts are also used in other products; their spare/warranty
        spend and pooling savings are split by how many each product uses.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
            <tr>
              <th className="py-2 pr-3 font-medium">Part</th>
              <th className="py-2 pr-3 text-right font-medium">Qty</th>
              <th className="py-2 pr-3 text-right font-medium">Quoted</th>
              <th className="py-2 pr-3 text-right font-medium">Actual paid</th>
              <th className="py-2 pr-3 text-right font-medium">Spare &amp; warranty</th>
              <th className="py-2 pr-3 text-right font-medium">vs. quote</th>
              <th className="py-2 text-right font-medium">Pooling saves</th>
            </tr>
          </thead>
          <tbody>
            {p.lines.map((l) => {
              const over = l.quoted ? (l.actual + l.service) / l.quoted - 1 : 0;
              return (
                <tr key={l.part_number} className="border-b border-neutral-100 align-top dark:border-neutral-900">
                  <td className="py-2 pr-3">
                    <Link href={partHref(l.part_number)} className="font-mono font-medium text-violet-700 hover:underline dark:text-violet-300">
                      {l.part_number}
                    </Link>
                    {l.share < 0.999 && (
                      <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                        shared · {pct(l.share, 0)} of use
                      </span>
                    )}
                    <div className="text-xs text-neutral-500">{l.description}</div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{l.qty_per}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{money(l.quoted, 2)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{money(l.actual, 2)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{l.service ? money(l.service, 2) : "–"}</td>
                  <td
                    className={`py-2 pr-3 text-right tabular-nums ${
                      over > 0.08 ? "font-medium text-rose-700 dark:text-rose-400" : "text-neutral-500"
                    }`}
                  >
                    {l.quoted ? `${over >= 0 ? "+" : ""}${pct(over)}` : "–"}
                  </td>
                  <td className="py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                    {l.pooling >= 0.005 ? money(l.pooling, 2) : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-2 pr-3">Total per unit</td>
              <td />
              <td className="py-2 pr-3 text-right tabular-nums">{money(p.quoted, 2)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{money(p.actual, 2)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{money(p.service, 2)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">+{pct(p.trueCost / p.quoted - 1)}</td>
              <td className="py-2 text-right tabular-nums">{money(p.pooling, 2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </main>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "good" | "bad" }) {
  const color =
    tone === "bad" ? "text-rose-700 dark:text-rose-400" : tone === "good" ? "text-emerald-700 dark:text-emerald-400" : "";
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="mt-1 text-sm text-neutral-500">{label}</div>
      {note && <div className="text-xs text-neutral-500">{note}</div>}
    </div>
  );
}
