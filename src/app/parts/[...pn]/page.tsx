import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDemand, getPart, getSupplierNames, getTiers } from "@/lib/queries";
import { priceAt, simulatePart, tierAt, type Tier } from "@/lib/pricing/consolidation";
import { money, moneyShort, num, pct, unitPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ pn: string[] }> };
const decode = (pn: string[]) => pn.map(decodeURIComponent).join("/");

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: `${decode((await params).pn)} · TierLink` };
}

export default async function PartPage({ params }: Params) {
  const partNumber = decode((await params).pn);
  const [detail, tiersByPart, suppliers, { parts }] = await Promise.all([
    getPart(partNumber),
    getTiers(partNumber),
    getSupplierNames(),
    getDemand(),
  ]);
  if (!detail) notFound();
  const { part, receipts, bom } = detail;
  const tiers: Record<string, Tier[]> = tiersByPart[partNumber] ?? {};
  const supplierIds = Object.keys(tiers).sort();
  const breaks = [...new Set(Object.values(tiers).flatMap((t) => t.map(([min]) => min)))].sort((a, b) => a - b);
  const demand = parts.find((p) => p.part_number === partNumber);

  // Typical monthly order per plant, and pooled.
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.filter((x) => x > 0).length);
  const plantOrders = demand
    ? Object.entries(demand.plants).map(([plant, d]) => ({ plant, supplier: d.supplier, qty: avg(d.units) }))
    : [];
  const pooledQty = plantOrders.reduce((s, p) => s + p.qty, 0);
  const sim = demand ? simulatePart(demand, { plants: Object.keys(demand.plants), allowSupplierSwitch: true }) : null;

  const production = receipts.filter((r) => r.order_type === "PRODUCTION");
  const service = receipts.filter((r) => r.order_type !== "PRODUCTION");
  const sum = (rs: readonly { amount: number }[]) => rs.reduce((s, r) => s + r.amount, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <Link href="/parts" className="text-sm text-neutral-500 hover:underline">
        ← All parts
      </Link>
      <h1 className="mt-2 font-mono text-3xl font-semibold tracking-tight">{part.part_number}</h1>
      <p className="mt-1 text-neutral-600 dark:text-neutral-300">{part.description}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {Object.entries(part.attributes as Record<string, unknown>).map(([k, v]) => (
          <span key={k} className="rounded bg-neutral-100 px-2 py-1 dark:bg-neutral-800">
            {k}: {String(v)}
          </span>
        ))}
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Production spend (24 mo)" value={moneyShort(sum(production))} />
        <Stat label="Spare & warranty spend" value={moneyShort(sum(service))} note={service.length ? `${service.length} orders` : "none"} />
        <Stat label="Suppliers quoting" value={String(supplierIds.length)} />
        <Stat
          label="Pooling savings / yr"
          value={sim && sim.savings > 0 ? moneyShort(sim.savings) : "$0"}
          note={sim && sim.savings > 0 ? pct(sim.savingsPct) : undefined}
          accent
        />
      </section>

      {bom.length > 0 && (
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          Used in{" "}
          {bom.map((b, i) => (
            <span key={`${b.product_id}-${b.assembly}`}>
              {i > 0 && ", "}
              <span className="font-medium">{b.product_id}</span> {b.assembly} (×{b.qty_per})
            </span>
          ))}
        </p>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Price-Break Matrix</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Unit price at each volume tier, per supplier. The cheapest price in each row is highlighted. Markers show where
          each plant&apos;s typical monthly order lands, and where the pooled order would land.
        </p>
        {supplierIds.length === 0 ? (
          <p className="mt-3 text-neutral-500">No price lists linked to this part yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                <tr>
                  <th className="py-2 pr-3 font-medium">Order quantity (pieces)</th>
                  {supplierIds.map((s) => (
                    <th key={s} className="py-2 pr-3 text-right font-medium">
                      {suppliers[s] ?? s}
                    </th>
                  ))}
                  <th className="py-2 font-medium">Orders here</th>
                </tr>
              </thead>
              <tbody>
                {breaks.map((min, i) => {
                  const max = breaks[i + 1] ? breaks[i + 1] - 1 : null;
                  const prices = supplierIds.map((s) => priceAt(tiers[s], min));
                  const best = Math.min(...prices);
                  const inRow = (q: number) => q >= min && (max === null || q <= max);
                  const markers = [
                    ...plantOrders.filter((p) => inRow(p.qty)).map((p) => `${p.plant} ~${num(p.qty)}/mo`),
                    ...(plantOrders.length > 1 && inRow(pooledQty) ? [`Pooled ~${num(pooledQty)}/mo`] : []),
                  ];
                  return (
                    <tr key={min} className="border-b border-neutral-100 dark:border-neutral-900">
                      <td className="py-2 pr-3 tabular-nums">
                        {num(min)}
                        {max === null ? "+" : ` – ${num(max)}`}
                      </td>
                      {prices.map((p, j) => (
                        <td
                          key={supplierIds[j]}
                          className={`py-2 pr-3 text-right tabular-nums ${
                            p === best ? "font-semibold text-emerald-700 dark:text-emerald-400" : ""
                          }`}
                        >
                          {unitPrice(p)}
                        </td>
                      ))}
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {markers.map((m) => (
                            <span
                              key={m}
                              className={`rounded px-1.5 py-0.5 text-xs ${
                                m.startsWith("Pooled")
                                  ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                                  : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                              }`}
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {sim && sim.chosen && sim.savings > 0 && (
          <p className="mt-3 rounded-lg bg-violet-50 p-3 text-sm dark:bg-violet-950/30">
            Today each plant orders separately (typically tier {sim.baselineTypicalTier}). Pooling{" "}
            {plantOrders.map((p) => p.plant).join(" + ")} into one monthly order of ~{num(pooledQty)} pieces with{" "}
            <span className="font-medium">{suppliers[sim.chosen.supplier]}</span> reaches tier{" "}
            {tierAt(tiers[sim.chosen.supplier], pooledQty)}:{" "}
            <span className="font-semibold">{money(sim.savings)} a year ({pct(sim.savingsPct)})</span>.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Receipt Ledger</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Every confidently matched purchase of this part, with the supplier&apos;s original wording. Spare and warranty
          orders are included, so the part&apos;s full lifecycle cost is visible.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Plant</th>
                <th className="py-2 pr-3 font-medium">Supplier · invoice wording</th>
                <th className="py-2 pr-3 text-right font-medium">Pieces</th>
                <th className="py-2 pr-3 text-right font-medium">Unit price</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {receipts.slice(0, 60).map((r) => (
                <tr key={r.line_id} className="border-b border-neutral-100 align-top dark:border-neutral-900">
                  <td className="py-2 pr-3 tabular-nums">{new Date(r.po_date).toISOString().slice(0, 10)}</td>
                  <td className="py-2 pr-3">
                    {r.plant_id}
                    {r.order_type !== "PRODUCTION" && (
                      <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        {r.order_type.toLowerCase()}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <div>{r.supplier_name}</div>
                    <div className="font-mono text-xs text-neutral-500">{r.item_description}</div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{num(r.units)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{unitPrice(r.unit_price)}</td>
                  <td className="py-2 text-right tabular-nums">{money(r.amount, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {receipts.length > 60 && <p className="mt-2 text-xs text-neutral-500">Showing the latest 60 of {receipts.length}.</p>}
      </section>
    </main>
  );
}

function Stat({ label, value, note, accent }: { label: string; value: string; note?: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent ? "border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30" : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-neutral-500">
        {label}
        {note && <span> · {note}</span>}
      </div>
    </div>
  );
}
