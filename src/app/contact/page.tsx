import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { ReviewForm } from "./form";
import { Founders } from "@/components/founders";

export const metadata: Metadata = { title: "Free savings review · TierLink" };

const STEPS = [
  ["A 30-minute call", "We learn what you make, how your plants buy, and where it hurts."],
  ["You send three exports", "Bills of materials, 12–24 months of purchase lines, and supplier price lists. CSV or Excel is fine. NDA first if you like."],
  ["We come back in two weeks", "A short report: your top savings, with the receipts behind every number, and a live TierLink workspace on your data."],
];

export default function ContactPage() {
  return (
    <main className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-8 lg:grid-cols-[1fr_1.4fr]">
      <div>
        <PageHeader
          kicker="Free savings review"
          title="See what your own data says"
          description="Tell us a little about your company. We'll run TierLink on your purchasing data and show you where the money is, before you pay anything."
        />
        <ol className="mt-8 space-y-5">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-medium text-white">{i + 1}</span>
              <div>
                <div className="font-medium">{t}</div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <p className="text-sm font-medium">You&apos;ll be talking with</p>
          <div className="mt-3">
            <Founders compact />
          </div>
        </div>
      </div>
      <ReviewForm />
    </main>
  );
}
