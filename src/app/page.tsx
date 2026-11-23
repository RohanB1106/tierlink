import Link from "next/link";
import { Founders } from "@/components/founders";

const primary = "rounded-lg bg-violet-600 px-5 py-3 text-sm font-medium text-white hover:bg-violet-700";
const secondary =
  "rounded-lg border border-neutral-300 px-5 py-3 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900";

const PROBLEMS = [
  {
    title: "Your plants buy the same part separately",
    text: "Peoria orders 4,000 motors, Fort Wayne orders 3,000, from the same supplier, in the same month. Neither order is big enough for the better price. Together, they would be.",
  },
  {
    title: "Nobody can see what a product really costs",
    text: "Engineering quotes a product at one cost. Purchasing pays another. Spares and warranty parts add a third. The gap is real money, but it's hidden across three systems.",
  },
  {
    title: "Your data doesn't line up",
    text: "Engineering calls it SCR-M3-12-ZN. One supplier writes \"M3X12 PAN PHIL ZP\", another writes \"SCREW 3MM 12L\". Without a shared key, the spreadsheets never match.",
  },
];

const SERVICES = [
  ["Buy together across plants", "We show which parts several plants buy, and what you'd pay if you ordered them together and hit the next price break."],
  ["Check prices against the market", "For metals, resins and high-spend parts, we compare what you pay with the market range and show cheaper suppliers."],
  ["True cost per product", "What each product really costs to build, from actual receipts, including spare and warranty parts."],
  ["Fewer part numbers", "We find near-identical parts (the same bracket in five sizes) that engineering could standardize."],
  ["A chatbot for your buyers", "Your team asks questions in plain English and gets answers straight from your purchasing data, with the work shown."],
  ["Clean, linked data", "Every invoice line matched to the right part. When we're not sure, a person on your team decides."],
];

const STEPS = [
  ["Talk", "A 30-minute call about what you make and how your plants buy. No prep needed."],
  ["Send exports", "Bills of materials, 12–24 months of purchase lines and supplier price lists, as CSV or Excel straight from your ERP. NDA first if you like."],
  ["See the savings", "In about two weeks: a short report of your biggest savings, each backed by the receipts, and a live TierLink workspace your team can use."],
];

const SEGMENTS = [
  "Industrial equipment & machinery",
  "Automotive & EV parts",
  "Aerospace & defense suppliers",
  "Consumer durables & appliances",
  "Power tools & hardware",
  "Electronics & electrical",
];

const FAQ = [
  ["Do we have to replace our ERP or buy new software?", "No. We work from the exports you already have. TierLink sits on top; nothing in your systems changes."],
  ["How do you keep our data safe?", "We sign an NDA before you send anything. Your data stays in its own database, is never used to train AI models, and is deleted when you ask."],
  ["What if your matching is wrong?", "When TierLink isn't sure a line matches a part, it doesn't guess. It asks a person on your team, shows the evidence, and only counts savings after a yes."],
  ["What does it cost?", "The first savings review is free. If you want to keep going, we agree a price based on the size of your spend, usually a fraction of the first year's savings."],
  ["Is the demo real data?", "The live demo uses Prairie Power Tools, a made-up company with sample data we generated so you can click through everything. Your review runs on your own data."],
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="border-b border-neutral-200 bg-gradient-to-b from-violet-50/70 to-transparent dark:border-neutral-800 dark:from-violet-950/20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
          <p className="text-sm font-medium text-violet-700 dark:text-violet-300">Purchasing savings for manufacturers</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Stop paying more for the parts you already buy.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-neutral-700 dark:text-neutral-300">
            We connect your bills of materials to every supplier invoice, then show you, in plain numbers, where you can buy
            together, pay closer to market, and cut parts you don&apos;t need. On our sample manufacturer, that added up to about 9% of parts
            spend.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/contact" className={primary}>
              Get a free savings review
            </Link>
            <Link href="/demo" className={secondary}>
              Try the live demo
            </Link>
          </div>
          <p className="mt-4 text-sm text-neutral-500">No software to install. Works with the exports you already have.</p>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sound familiar?</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {PROBLEMS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
              <h3 className="font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Example */}
      <section className="bg-neutral-50 dark:bg-neutral-900/40">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-8 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-violet-700 dark:text-violet-300">A real example from our demo</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">One circuit board. Three plants. A $1.70 difference.</h2>
            <p className="mt-4 leading-relaxed text-neutral-700 dark:text-neutral-300">
              Each plant ordered its own controller boards and paid $7.71 each. Ordered together, the same supplier&apos;s price
              list drops to $6.01. Nobody was doing anything wrong; nobody could see the other plants&apos; orders.
            </p>
            <p className="mt-3 leading-relaxed text-neutral-700 dark:text-neutral-300">
              Across a sample company with $12.6M a year of parts spend, TierLink found about <strong>$1.2M a year</strong> in
              savings like this.
            </p>
            <Link href="/consolidation" className="mt-6 inline-block text-sm font-medium text-violet-700 hover:underline dark:text-violet-300">
              See it in the demo →
            </Link>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="text-sm text-neutral-500">Controller board, price per unit</div>
            {[
              ["Each plant orders alone", 7.71, "bg-rose-400"],
              ["Plants order together", 6.01, "bg-violet-600"],
            ].map(([l, v, c]) => (
              <div key={l as string} className="mt-5">
                <div className="flex justify-between text-sm">
                  <span>{l}</span>
                  <span className="font-semibold tabular-nums">${(v as number).toFixed(2)}</span>
                </div>
                <div className="mt-1.5 h-3 rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <div className={`h-3 rounded-full ${c}`} style={{ width: `${((v as number) / 7.71) * 100}%` }} />
                </div>
              </div>
            ))}
            <p className="mt-5 text-sm text-neutral-600 dark:text-neutral-400">22% less, same part, same supplier.</p>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-8">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">What we do for you</h2>
        <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">
          Every client is different, so we start with the one or two that matter most to you and add the rest as you go.
        </p>
        <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map(([t, d]) => (
            <div key={t}>
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 border-y border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How working with us goes</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {STEPS.map(([t, d], i) => (
              <li key={t}>
                <span className="flex size-9 items-center justify-center rounded-full bg-violet-600 font-semibold text-white">{i + 1}</span>
                <h3 className="mt-3 font-semibold">{t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Who it's for */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Built for mid-size manufacturers</h2>
            <p className="mt-3 leading-relaxed text-neutral-600 dark:text-neutral-400">
              TierLink works best if you have more than one plant, a few thousand part numbers, and $5M or more a year in
              parts and materials. Big enough that the savings matter, often too small for a big consulting project.
            </p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {SEGMENTS.map((s) => (
              <li key={s} className="rounded-lg border border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800">
                {s}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Founders */}
      <section className="bg-neutral-50 dark:bg-neutral-900/40">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Who we are</h2>
          <p className="mt-4 leading-relaxed text-neutral-700 dark:text-neutral-300">
            We&apos;re Rohan and Aarav, University of Illinois students in computer science and economics. TierLink started at the
            Kearney PERLab Hackathon, where we saw how much money manufacturers lose simply because their engineering and
            purchasing data don&apos;t talk to each other. We work closely with each client, and you&apos;ll always talk to the people
            building the tool.
          </p>
          <div className="mt-8">
            <Founders />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Questions</h2>
        <div className="mt-6 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {q}
                <span className="text-neutral-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-8">
        <div className="rounded-2xl bg-violet-700 px-6 py-12 text-center text-white sm:px-12">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Find out what your data is hiding</h2>
          <p className="mx-auto mt-3 max-w-xl text-violet-100">
            The first review is free. If we don&apos;t find savings worth your time, you&apos;ve lost one phone call.
          </p>
          <Link href="/contact" className="mt-6 inline-block rounded-lg bg-white px-5 py-3 text-sm font-medium text-violet-800 hover:bg-violet-50">
            Get a free savings review
          </Link>
        </div>
      </section>
    </main>
  );
}
