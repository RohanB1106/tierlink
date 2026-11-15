"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ToolCall {
  name: string;
  input: unknown;
  ok?: boolean;
}
interface Turn {
  role: "user" | "assistant";
  text: string;
  tools: ToolCall[];
  error?: string;
}

const TOOL_LABEL: Record<string, string> = {
  run_sql: "Queried the database",
  get_consolidation_savings: "Ran the consolidation simulator",
  get_product_costs: "Looked up product costs",
  get_part_details: "Looked up a part",
  get_platform_candidates: "Checked platforming candidates",
  get_market_price_check: "Checked market prices",
};

const SUGGESTIONS = [
  "Which 5 parts have the biggest consolidation savings, and why?",
  "Why does the PD-20 cost more than its BOM quote?",
  "Which parts do we buy from 3 or more suppliers?",
  "What would we save if only Peoria and Champaign pooled orders?",
  "Which materials are we paying above market for, and who is cheaper?",
  "How much do we spend on spare and warranty parts, by product?",
];

export function Chat({ configured }: { configured: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  // Full API history (including tool calls) from the server, sent back unchanged each turn.
  const history = useRef<unknown[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const updateLast = (fn: (t: Turn) => Turn) =>
    setTurns((ts) => [...ts.slice(0, -1), fn(ts[ts.length - 1])]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setTurns((ts) => [...ts, { role: "user", text: q, tools: [] }, { role: "assistant", text: "", tools: [] }]);
    setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...history.current, { role: "user", content: q }] }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.type === "text") updateLast((t) => ({ ...t, text: t.text + e.text }));
          else if (e.type === "tool") updateLast((t) => ({ ...t, tools: [...t.tools, { name: e.name, input: e.input }] }));
          else if (e.type === "tool_result")
            updateLast((t) => {
              const i = t.tools.findIndex((x) => x.name === e.name && x.ok === undefined);
              const tools = [...t.tools];
              if (i >= 0) tools[i] = { ...tools[i], ok: e.ok };
              return { ...t, tools };
            });
          else if (e.type === "done") history.current = e.messages;
          else if (e.type === "error") updateLast((t) => ({ ...t, error: e.message }));
        }
      }
    } catch (err) {
      updateLast((t) => ({ ...t, error: err instanceof Error ? err.message : "Something went wrong." }));
    } finally {
      setBusy(false);
      setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  if (!configured) {
    return (
      <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm dark:border-amber-800 dark:bg-amber-950/30">
        <div className="font-medium">The assistant isn&apos;t switched on yet.</div>
        <p className="mt-1 text-neutral-700 dark:text-neutral-300">
          It needs an Anthropic API key in the <code>ANTHROPIC_API_KEY</code> environment variable. Add it in Vercel
          (Settings → Environment Variables) and redeploy, or put it in <code>.env.local</code> for local use.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col">
      {turns.length === 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="rounded-lg border border-neutral-200 p-3 text-left text-sm hover:border-violet-400 hover:bg-violet-50 dark:border-neutral-800 dark:hover:bg-violet-950/30"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-5" aria-live="polite">
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-2xl bg-violet-600 px-4 py-2 text-white">
              {t.text}
            </div>
          ) : (
            <div key={i} className="max-w-full">
              {t.tools.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {t.tools.map((tool, j) => (
                    <details key={j} className="group text-xs">
                      <summary
                        className={`cursor-pointer list-none rounded-full px-2 py-0.5 ${
                          tool.ok === false
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                            : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                        }`}
                      >
                        {tool.ok === undefined ? "⋯ " : tool.ok ? "✓ " : "✕ "}
                        {TOOL_LABEL[tool.name] ?? tool.name}
                      </summary>
                      <pre className="mt-1 max-w-full overflow-x-auto whitespace-pre-wrap rounded bg-neutral-100 p-2 font-mono text-[11px] dark:bg-neutral-900">
                        {typeof tool.input === "object" && tool.input && "sql" in tool.input
                          ? String((tool.input as { sql: string }).sql)
                          : JSON.stringify(tool.input, null, 2)}
                      </pre>
                    </details>
                  ))}
                </div>
              )}
              {t.text ? (
                <div className="prose-chat text-[15px] leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{t.text}</ReactMarkdown>
                </div>
              ) : (
                !t.error && busy && i === turns.length - 1 && <div className="text-sm text-neutral-500">Looking that up…</div>
              )}
              {t.error && <div className="mt-2 text-sm text-rose-700 dark:text-rose-400">{t.error}</div>}
            </div>
          ),
        )}
      </div>
      <div ref={bottom} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="sticky bottom-0 mt-6 flex gap-2 bg-[var(--background)] py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          placeholder="Ask about parts, suppliers, spend or savings…"
          aria-label="Your question"
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
        />
        <button
          disabled={busy || !input.trim()}
          className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
