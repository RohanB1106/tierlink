import type { Metadata } from "next";
import Link from "next/link";
import { getPlatformData } from "@/lib/queries";
import { money, moneyShort, num, partHref, pct } from "@/lib/format";
import { ViewerLoader } from "./viewer-loader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Platforming · TierLink" };

const LABEL: Record<string, string> = {
  thickness_mm: "thickness",
  width_mm: "width",
  hole_mm: "hole",
  finish: "finish",
  wire_mm: "wire",
  od_mm: "OD",
  length_mm: "length",
};

export default async function PlatformPage() {
  const { parts, products, candidates, common, assemblies } = await getPlatformData();
  const used = parts.filter((p) => p.products.length > 0);
  const removed = candidates.reduce((s, c) => s + c.partNumbersRemoved, 0);
  const savings = candidates.reduce((s, c) => s + c.priceSavings, 0);
  const shared = used.filter((p) => p.products.length > 1).sort((a, b) => b.products.length - a.products.length || a.part_number.localeCompare(b.part_number));
  const avgIndex = common.perProduct.reduce((s, p) => s + p.index, 0) / Math.max(1, common.perProduct.length);
  const candidateOf = new Map(
    candidates.flatMap((c) => c.variants.map((v) => [v.part_number, c.standard.part_number] as const)),
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Platforming</h1>
      <p className="mt-2 max-w-3xl text-neutral-600 dark:text-neutral-300">
        Engineering created separate part numbers for parts that are almost the same. Standardizing them cuts complexity
        and pools volume onto one part. The 3D view shows which assemblies already form a shared core and which are
        product-specific modules.
      </p>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Part numbers in BOMs" value={`${used.length} → ${used.length - removed}`} note={`${removed} near-duplicates removable`} accent />
        <Stat label="Standardization groups" value={String(candidates.length)} note="each needs engineering sign-off" />
        <Stat label="Extra price savings / yr" value={moneyShort(savings)} note="on top of consolidation" />
        <Stat label="Parts shared across products" value={pct(avgIndex, 0)} note="average per product" />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Product family in 3D</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Switch products to see the common core stay the same while modules change. Drag to rotate, scroll to zoom,
          click an assembly for its parts.
        </p>
        <ViewerLoader
          products={products.map((p) => ({ id: p.product_id, name: p.name }))}
          assemblies={assemblies}
          partProducts={Object.fromEntries(used.map((p) => [p.part_number, p.products]))}
          candidateOf={Object.fromEntries(candidateOf)}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Standardization candidates</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Grouped when every dimension is within 10%, or when only the finish differs. The most-used part is proposed as
          the standard. Similar is not the same as interchangeable: engineering must confirm each one before any saving
          is counted.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {candidates.map((c) => (
            <article key={c.standard.part_number} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-neutral-500">{c.category}</div>
                  <div className="mt-0.5 font-medium">
                    {c.variants.length + 1} parts → 1 standard{" "}
                    <Link href={partHref(c.standard.part_number)} className="font-mono text-violet-700 hover:underline dark:text-violet-300">
                      {c.standard.part_number}
                    </Link>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  needs sign-off
                </span>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {[c.standard, ...c.variants].map((p, i) => (
                  <li key={p.part_number} className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span>
                      <Link href={partHref(p.part_number)} className="font-mono hover:underline">
                        {p.part_number}
                      </Link>
                      {i === 0 && <span className="ml-1 text-xs text-violet-600 dark:text-violet-400">standard</span>}
                      <span className="ml-2 text-xs text-neutral-500">{p.products.join(", ")}</span>
                    </span>
                    <span className="text-xs tabular-nums text-neutral-500">{num(p.annualUnits)} pcs/yr</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-1">
                {c.differences.map((d) => (
                  <span key={d.attr} className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                    {LABEL[d.attr] ?? d.attr}: {d.values.join(" / ")}
                  </span>
                ))}
              </div>
              <div className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                Removes {c.partNumbersRemoved} part number{c.partNumbersRemoved > 1 ? "s" : ""}
                {c.priceSavings >= 1 ? (
                  <>
                    {" "}· pooled volume saves <span className="font-medium text-emerald-700 dark:text-emerald-400">{money(c.priceSavings)}/yr</span>
                  </>
                ) : (
                  " · main benefit is fewer parts to buy, stock and qualify"
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Shared parts across the family</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {shared.length} of {used.length} parts are used in more than one product. Parts used by half the family or more
          ({common.core.length}) are the natural common core.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="py-2 pr-3 font-medium">Part</th>
                {products.map((p) => (
                  <th key={p.product_id} className="px-1 py-2 text-center font-medium">
                    {p.product_id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shared.map((p) => (
                <tr key={p.part_number} className="border-b border-neutral-100 dark:border-neutral-900">
                  <td className="py-1.5 pr-3">
                    <Link href={partHref(p.part_number)} className="font-mono hover:underline">
                      {p.part_number}
                    </Link>
                  </td>
                  {products.map((pr) => (
                    <td key={pr.product_id} className="px-1 py-1.5 text-center">
                      {p.products.includes(pr.product_id) ? (
                        <span
                          aria-label="used"
                          className={`inline-block size-3 rounded-full ${
                            p.products.length >= Math.ceil(products.length / 2) ? "bg-violet-600" : "bg-violet-300 dark:bg-violet-700"
                          }`}
                        />
                      ) : (
                        <span className="text-neutral-300 dark:text-neutral-700">·</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Dark dot: used by half the family or more (core). Light dot: shared by a few products.
        </p>
      </section>
    </main>
  );
}

function Stat({ label, value, note, accent }: { label: string; value: string; note?: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent ? "border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30" : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-neutral-500">{label}</div>
      {note && <div className="text-xs text-neutral-500">{note}</div>}
    </div>
  );
}
