import type { Metadata } from "next";
import { getMarketCheck } from "@/lib/queries";
import { moneyShort } from "@/lib/format";
import { PageHeader, Stat } from "@/components/ui";
import { MarketTable } from "./market-table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Market Price Check · TierLink" };

export default async function MarketPage() {
  const { results, above, overpay, altSavings } = await getMarketCheck();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <PageHeader
        kicker="Market Price Check"
        title="Are we paying above market?"
        description="Every benchmarked raw material and high-spend part, compared with the market price range. Where we pay above market, TierLink lists alternative vendors that quote less, and what switching would save."
      />
      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Items priced above market" value={`${above} of ${results.length}`} note="more than 5% over the market median" />
        <Stat label="Paid above market median" value={moneyShort(overpay)} note="per year, at current volumes" />
        <Stat label="Savings with the best alternative" value={moneyShort(altSavings)} note="per year, quotes that fit our order size" accent />
      </section>
      <MarketTable results={results} />
      <p className="mt-6 text-xs text-neutral-500">
        Our price: weighted average of the last 3 months (Aug–Oct 2026). Quantity: last 12 months. Market ranges and vendor
        quotes in this demo are illustrative; in production they would come from commodity indexes (e.g. LME, Fastmarkets)
        and distributor price feeds. For purchased parts, switching vendors and pooling orders can overlap, so these
        savings are not added to the Consolidation Simulator&apos;s.
      </p>
    </main>
  );
}
