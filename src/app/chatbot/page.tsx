import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { Chat } from "./chat";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Chatbot · TierLink" };

export default function ChatbotPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col px-4 py-10 sm:px-8">
      <PageHeader
        kicker="Chatbot · demo data"
        title="Ask your purchasing data anything"
        description="Type a question the way you'd ask a colleague: where are we overpaying, what does a product really cost, which parts could we buy together? The chatbot looks up the answer in your data and shows you exactly what it checked."
      />
      <Chat configured={Boolean(process.env.ANTHROPIC_API_KEY)} />
    </main>
  );
}
