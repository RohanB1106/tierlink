import type { Metadata } from "next";
import Link from "next/link";
import { getProductCosts } from "@/lib/queries";
import { money, moneyShort, num, pct } from "@/lib/format";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "True Cost per Product · TierLink" };

export default async function ProductsPage() {
  const { costs, window, unallocated } = await getProductCosts();
  const annual = (k: "quoted" | "trueCost" | "service" | "pooling") =>
    costs.reduce((s, p) => s + p[k] * p.annual_volume, 0);
  const quoted = annual("quoted");
  const truth = annual("trueCost");

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <PageHeader
        kicker="True Cost per Product"
        title="What each product really costs"
        description="Once every purchase is tied back to its BOM: actual prices paid, shared parts split by how many each product uses, and spare and warranty orders included. Compared with what the price lists say it should cost."
      />

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card label="Real material cost vs. quoted BOM cost" value={`+${pct(truth / quoted - 1)}`} note={`${moneyShort(truth - quoted)} a year above the quotes`} accent />
        <Card label="Spare & warranty spend, now tied to products" value={moneyShort(annual("service"))} note="per year, previously invisible per product" />
        <Card label="Recoverable by pooling orders" value={moneyShort(annual("pooling"))} note="per year, see Consolidation" />
      </section>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
            <tr>
              <th className="py-2 pr-3 font-medium">Product</th>
              <th className="py-2 pr-3 text-right font-medium">Units / yr</th>
              <th className="py-2 pr-3 text-right font-medium">Quoted BOM</th>
              <th className="py-2 pr-3 text-right font-medium">Actual material</th>
              <th className="py-2 pr-3 text-right font-medium">Spare &amp; warranty</th>
              <th className="py-2 pr-3 text-right font-medium">True cost</th>
              <th className="py-2 pr-3 text-right font-medium">vs. quote</th>
              <th className="py-2 text-right font-medium">After pooling</th>
            </tr>
          </thead>
          <tbody>
            {costs.map((p) => (
              <tr key={p.product_id} className="border-b border-neutral-100 dark:border-neutral-900">
                <td className="py-2 pr-3">
                  <Link href={`/products/${p.product_id}`} className="font-medium text-violet-700 hover:underline dark:text-violet-300">
                    {p.product_id}
                  </Link>
                  <div className="text-xs text-neutral-500">
                    {p.name} · {p.plant_id}
                  </div>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{num(p.annual_volume)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{money(p.quoted, 2)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{money(p.actual, 2)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{money(p.service, 2)}</td>
                <td className="py-2 pr-3 text-right font-semibold tabular-nums">{money(p.trueCost, 2)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-rose-700 dark:text-rose-400">+{pct(p.trueCost / p.quoted - 1)}</td>
                <td className="py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{money(p.optimized, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        Per unit, {window}. Quoted BOM = each part&apos;s price-list price at the plant&apos;s usual order size. Actual material =
        what the plant really paid, split among the products it builds. {num(unallocated.lines)} purchase lines (
        {moneyShort(unallocated.spend)}) are still in the review queue and not allocated yet.
      </p>
    </main>
  );
}

function Card({ label, value, note, accent }: { label: string; value: string; note: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        accent ? "border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30" : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-neutral-500">{note}</div>
    </div>
  );
}
