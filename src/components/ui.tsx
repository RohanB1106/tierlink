import type { ReactNode } from "react";

export function PageHeader({ kicker, title, description }: { kicker: string; title: string; description?: ReactNode }) {
  return (
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">{kicker}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      {description && <p className="mt-3 max-w-3xl text-neutral-600 dark:text-neutral-300">{description}</p>}
    </header>
  );
}

export function Stat({ label, value, note, accent }: { label: string; value: string; note?: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        accent
          ? "border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30"
          : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
      }`}
    >
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
      {note && <div className="mt-1 text-xs text-neutral-500">{note}</div>}
    </div>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <rect x="1" y="3" width="5" height="19" rx="1.5" fill="#4c1d95" />
      <rect x="7" y="8" width="5" height="14" rx="1.5" fill="#6d28d9" />
      <rect x="13" y="12" width="5" height="10" rx="1.5" fill="#8b5cf6" />
      <rect x="19" y="15" width="4" height="7" rx="1.5" fill="#f59e0b" />
    </svg>
  );
}
