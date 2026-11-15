import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { Chat } from "./chat";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ask the Ledger · TierLink" };

export default function AskPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col px-4 py-10 sm:px-8">
      <PageHeader
        kicker="Ask the Ledger"
        title="Ask your spend data anything"
        description="Questions about parts, suppliers, market prices and savings, in plain English. Claude looks up the answer in the TierLink database and shows every lookup it ran."
      />
      <Chat configured={Boolean(process.env.ANTHROPIC_API_KEY)} />
    </main>
  );
}
