import type { Metadata } from "next";
import { Chat } from "./chat";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ask the Ledger · TierLink" };

export default function AskPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Ask the Ledger</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-300">
        Ask questions about parts, suppliers, spend and savings in plain English. The assistant looks up the answer in the
        TierLink database and shows which lookups it ran.
      </p>
      <Chat configured={Boolean(process.env.ANTHROPIC_API_KEY)} />
    </main>
  );
}
