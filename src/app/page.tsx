import Link from "next/link";

const modules: { name: string; desc: string; status: string; href?: string }[] = [
  { name: "Ingestion Agent", desc: "Matches messy supplier invoice lines to engineering part numbers, with a confidence score. 97% auto-matched, 100% precision on the demo data.", status: "Live" },
  { name: "Review Queue", desc: "Uncertain matches go to a human, with the evidence, before any saving is claimed.", status: "Live", href: "/review" },
  { name: "Receipt Ledger", desc: "Every purchase line with supplier, date, quantity and cost, with the original wording kept.", status: "Next up" },
  { name: "Price-Break Matrix", desc: "Per-unit price by volume tier, for every supplier of the same part.", status: "Planned" },
  { name: "Consolidation Simulator", desc: "Pool orders across plants to reach better tiers and see the dollars saved.", status: "Planned" },
  { name: "True Cost per Product", desc: "BOM cost plus allocated shared parts and spare/warranty spend.", status: "Planned" },
  { name: "Platform View", desc: "Near-duplicate parts clustered, with a 3D view of the common core and add-on modules.", status: "Planned" },
  { name: "Ask the Ledger", desc: "Plain-English questions over parts, suppliers and spend.", status: "Planned" },
];

const stats = [
  { label: "Spend analyzed", value: "$19.9M" },
  { label: "Purchase lines", value: "2,635" },
  { label: "Planted pooling savings", value: "~$2.0M" },
  { label: "Lines needing review", value: "75" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-8 sm:py-16">
      <p className="text-sm font-medium uppercase tracking-wider text-violet-600 dark:text-violet-400">
        Kearney PERLab Hackathon · Team Double Trouble
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">TierLink</h1>
      <p className="mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
        Connect a manufacturer&apos;s BOMs to every supplier receipt, normalize volume price breaks, and
        show, with human-approved evidence, how much it saves by consolidating orders and standardizing parts.
      </p>

      <section className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
            <div className="mt-1 text-sm text-neutral-500">{s.label}</div>
          </div>
        ))}
      </section>
      <p className="mt-2 text-xs text-neutral-500">Demo data: Prairie Power Tools (fictional), Nov 2024 to Oct 2026.</p>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Modules</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {modules.map((m) => (
            <li key={m.name} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-center justify-between gap-2">
                {m.href ? (
                  <Link href={m.href} className="font-medium text-violet-700 hover:underline dark:text-violet-300">
                    {m.name} →
                  </Link>
                ) : (
                  <span className="font-medium">{m.name}</span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    m.status === "Live"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : m.status === "Next up"
                        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                        : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                  }`}
                >
                  {m.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{m.desc}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
