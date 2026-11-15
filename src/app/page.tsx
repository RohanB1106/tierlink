import Link from "next/link";
import { sql } from "@/lib/db";
import { simulate } from "@/lib/pricing/consolidation";
import { getDemand, getMarketCheck, getPlatformData, getProductCosts } from "@/lib/queries";
import { moneyShort, num, pct } from "@/lib/format";
import { Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [[totals], { parts }, { costs }, platform, market] = await Promise.all([
    sql`
      select sum(p.extended_amount)::float8 as spend, count(*)::int as lines,
             count(*) filter (where m.status = 'auto')::int as auto,
             count(*) filter (where m.status = 'pending')::int as pending
      from purchases p join matches m using (line_id)`,
    getDemand(),
    getProductCosts(),
    getPlatformData(),
    getMarketCheck(),
  ]);
  const pooling = simulate(parts, { plants: ["PEO", "CHA", "FTW"], allowSupplierSwitch: true });
  const quoted = costs.reduce((s, c) => s + c.quoted * c.annual_volume, 0);
  const truth = costs.reduce((s, c) => s + c.trueCost * c.annual_volume, 0);
  const usedParts = platform.parts.filter((p) => p.products.length > 0).length;
  const removed = platform.candidates.reduce((s, c) => s + c.partNumbersRemoved, 0);
  const platformSavings = platform.candidates.reduce((s, c) => s + c.priceSavings, 0);

  const modules = [
    {
      href: "/consolidation",
      title: "Consolidation Simulator",
      metric: `${moneyShort(pooling.savings)}/yr`,
      text: `Pool orders across plants to reach better price tiers: ${pct(pooling.savingsPct)} of spend.`,
    },
    {
      href: "/market",
      title: "Market Price Check",
      metric: `${market.above} items above market`,
      text: `${moneyShort(market.altSavings)}/yr available from alternative vendors that quote less.`,
    },
    {
      href: "/products",
      title: "True Cost per Product",
      metric: `+${pct(truth / quoted - 1)} vs. quote`,
      text: `${moneyShort(truth - quoted)}/yr of cost the BOM quotes don't show, incl. spare and warranty.`,
    },
    {
      href: "/platform",
      title: "Platforming",
      metric: `${usedParts} → ${usedParts - removed} parts`,
      text: `Standardize near-duplicate parts onto a shared core: ${moneyShort(platformSavings)}/yr extra.`,
    },
    {
      href: "/review",
      title: "Review Queue",
      metric: `${num(totals.pending)} waiting`,
      text: "Uncertain matches go to a person, with the evidence, before any saving counts.",
    },
    {
      href: "/ask",
      title: "Ask the Ledger",
      metric: "AI assistant",
      text: "Ask questions in plain English; Claude answers from the live data and shows its lookups.",
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">BOM-to-spend intelligence</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
        See what every product really costs, and where the savings are.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
        TierLink links a manufacturer&apos;s BOMs to every supplier receipt, then finds savings from volume price tiers, market
        prices and part standardization, with evidence a person has approved.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/consolidation" className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700">
          Open the Consolidation Simulator
        </Link>
        <Link
          href="/ask"
          className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Ask the Ledger
        </Link>
      </div>

      <section className="mt-12 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key figures">
        <Stat label="Spend analyzed" value={moneyShort(totals.spend)} note={`${num(totals.lines)} purchase lines, 24 months`} />
        <Stat label="Matched automatically" value={pct(totals.auto / totals.lines)} note="100% precision on the demo data" />
        <Stat label="Pooling savings" value={`${moneyShort(pooling.savings)}/yr`} note="all plants, best supplier" accent />
        <Stat label="Hidden product cost" value={`${moneyShort(truth - quoted)}/yr`} note="true cost above BOM quotes" />
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">What TierLink found</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group rounded-xl border border-neutral-200 p-5 transition-colors hover:border-violet-400 hover:bg-violet-50/50 dark:border-neutral-800 dark:hover:bg-violet-950/20"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{m.title}</span>
                <span className="text-neutral-400 transition-transform group-hover:translate-x-0.5">→</span>
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-violet-700 dark:text-violet-300">{m.metric}</div>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{m.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
        <h2 className="text-xl font-semibold">How it works</h2>
        <ol className="mt-4 grid gap-6 sm:grid-cols-3">
          {[
            ["Ingest", "Upload BOMs, invoices and supplier price lists as CSV exports. Nothing to replace."],
            ["Match", "The Ingestion Agent decodes each supplier's wording and links every line to a part, with a confidence score. Uncertain lines go to review."],
            ["Act", "Pool orders, switch overpriced items to better vendors, and standardize near-duplicate parts, each backed by receipts."],
          ].map(([t, d], i) => (
            <li key={t}>
              <div className="flex items-center gap-2 font-medium">
                <span className="flex size-6 items-center justify-center rounded-full bg-violet-600 text-xs text-white">{i + 1}</span>
                {t}
              </div>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{d}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
