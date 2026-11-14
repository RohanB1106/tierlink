import type { Metadata } from "next";
import { getDemand, getPlants, getSupplierNames } from "@/lib/queries";
import { Simulator } from "./simulator";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Consolidation Simulator · TierLink" };

export default async function ConsolidationPage() {
  const [{ parts, months }, plants, suppliers] = await Promise.all([getDemand(), getPlants(), getSupplierNames()]);
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Consolidation Simulator</h1>
      <p className="mt-2 max-w-3xl text-neutral-600 dark:text-neutral-300">
        Each plant orders on its own, so each one lands in a lower volume tier. Pooling the same monthly demand into one
        order reaches better price breaks. Choose which plants pool and whether the order may move to a cheaper supplier.
      </p>
      <Simulator parts={parts} plants={plants} suppliers={suppliers} window={`${months[0]} to ${months[months.length - 1]}`} />
    </main>
  );
}
