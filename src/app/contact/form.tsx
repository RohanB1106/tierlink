"use client";

import { useActionState } from "react";
import { requestReview, type LeadState } from "./actions";
import { ERPS, GOALS, PLANTS, SEGMENTS, SPEND } from "./options";

const field =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950";
const label = "text-sm font-medium";

function Select({ name, text, options }: { name: string; text: string; options: string[] }) {
  return (
    <label className="block">
      <span className={label}>{text}</span>
      <select name={name} defaultValue="" className={field}>
        <option value="">Choose one</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

export function ReviewForm() {
  const [state, action, pending] = useActionState<LeadState, FormData>(requestReview, { ok: false });

  if (state.ok)
    return (
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-8 dark:border-emerald-800 dark:bg-emerald-950/30">
        <h2 className="text-xl font-semibold">Thanks, we got it.</h2>
        <p className="mt-2 text-neutral-700 dark:text-neutral-300">
          We&apos;ll reply within two business days to set up a 30-minute call. Nothing to prepare yet: we&apos;ll tell you
          exactly which exports we need, and we can sign an NDA before you send anything.
        </p>
      </div>
    );

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-neutral-200 p-6 sm:p-8 dark:border-neutral-800">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Your name *</span>
          <input name="name" required autoComplete="name" className={field} />
        </label>
        <label className="block">
          <span className={label}>Work email *</span>
          <input name="email" type="email" required autoComplete="email" className={field} />
        </label>
        <label className="block">
          <span className={label}>Company *</span>
          <input name="company" required autoComplete="organization" className={field} />
        </label>
        <label className="block">
          <span className={label}>Your role</span>
          <input name="role" placeholder="e.g. Purchasing manager" autoComplete="organization-title" className={field} />
        </label>
        <Select name="segment" text="What do you make?" options={SEGMENTS} />
        <Select name="plants" text="How many plants?" options={PLANTS} />
        <Select name="annual_spend" text="Yearly spend on parts & materials" options={SPEND} />
        <Select name="erp" text="Where your purchasing data lives" options={ERPS} />
      </div>

      <fieldset>
        <legend className={label}>What would help most? (pick any)</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {GOALS.map((g) => (
            <label key={g} className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">
              <input type="checkbox" name="goals" value={g} className="accent-violet-600" />
              {g}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className={label}>Anything else we should know?</span>
        <textarea name="message" rows={4} className={field} placeholder="e.g. Our two plants buy the same motors from different suppliers." />
      </label>

      {/* Honeypot for bots; hidden from people and screen readers. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      {state.error && (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button disabled={pending} className="rounded-lg bg-violet-600 px-5 py-2.5 font-medium text-white hover:bg-violet-700 disabled:opacity-60">
          {pending ? "Sending…" : "Request my free savings review"}
        </button>
        <span className="text-xs text-neutral-500">We only use this to contact you about your review. No mailing lists.</span>
      </div>
    </form>
  );
}
