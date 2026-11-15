import type { Metadata } from "next";
import Link from "next/link";
import { getPartList } from "@/lib/queries";
import { money, partHref } from "@/lib/format";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Parts · TierLink" };

export default async function PartsPage() {
  const parts = await getPartList();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <PageHeader
        kicker="Parts"
        title="Every part, with its spend linked"
        description="The engineering part master with the purchases now tied to each part. Open a part for its price breaks by supplier and every receipt."
      />
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
            <tr>
              <th className="py-2 pr-3 font-medium">Part</th>
              <th className="py-2 pr-3 font-medium">Used in</th>
              <th className="py-2 pr-3 text-right font-medium">Suppliers</th>
              <th className="py-2 pr-3 text-right font-medium">Spare/warranty</th>
              <th className="py-2 text-right font-medium">Spend, last 12 mo</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((p) => (
              <tr key={p.part_number} className="border-b border-neutral-100 align-top dark:border-neutral-900">
                <td className="py-2 pr-3">
                  <Link href={partHref(p.part_number)} className="font-mono font-medium text-violet-700 hover:underline dark:text-violet-300">
                    {p.part_number}
                  </Link>
                  <div className="text-xs text-neutral-500">{p.description}</div>
                </td>
                <td className="py-2 pr-3 text-neutral-600 dark:text-neutral-400">{p.used_in.join(", ")}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{p.suppliers}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{p.service_spend ? money(p.service_spend) : "–"}</td>
                <td className="py-2 text-right tabular-nums">{money(p.spend_12m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
