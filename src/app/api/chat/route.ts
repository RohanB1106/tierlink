import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/lib/chat/system-prompt";
import { TOOLS, runTool } from "@/lib/chat/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-opus-5-5";
const MAX_TURNS = 8;
const MAX_HISTORY = 60;
const MAX_QUESTION_CHARS = 2000;

type Msg = Anthropic.Beta.BetaMessageParam;
export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; input: unknown }
  | { type: "tool_result"; name: string; ok: boolean }
  | { type: "done"; messages: Msg[] }
  | { type: "error"; message: string };

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "The assistant isn't set up yet: add ANTHROPIC_API_KEY to the environment." },
      { status: 503 },
    );
  }

  let messages: Msg[];
  try {
    const body = await req.json();
    messages = body.messages;
    const last = messages?.[messages.length - 1];
    if (
      !Array.isArray(messages) ||
      messages.length === 0 ||
      messages.length > MAX_HISTORY ||
      last.role !== "user" ||
      typeof last.content !== "string" ||
      last.content.trim().length === 0 ||
      last.content.length > MAX_QUESTION_CHARS
    ) {
      throw new Error("bad request");
    }
  } catch {
    return Response.json({ error: "Send { messages } ending with a user question." }, { status: 400 });
  }

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ChatEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      const history: Msg[] = [...messages];
      let jsonRetries = 0;

      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const s = client.beta.messages.stream({
            model: MODEL,
            max_tokens: 16000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: { effort: "medium" },
            system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
            tools: TOOLS,
            messages: history,
          });
          s.on("text", (delta) => send({ type: "text", text: delta }));

          let message: Anthropic.Beta.BetaMessage;
          try {
            message = await s.finalMessage();
            jsonRetries = 0;
          } catch (err) {
            // Only an unparseable streamed tool input is retried; API errors go to the outer handler.
            if (err instanceof Anthropic.APIError || jsonRetries++ >= 2) throw err;
            turn--;
            continue;
          }

          history.push({ role: "assistant", content: message.content });

          if (message.stop_reason === "refusal") {
            send({ type: "text", text: "\n\nI can't help with that one. Try asking about parts, spend, suppliers or savings." });
            break;
          }
          if (message.stop_reason === "pause_turn") continue;

          const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
          if (toolUses.length === 0) break;
          if (message.stop_reason === "max_tokens") {
            send({ type: "error", message: "The answer got too long. Try a narrower question." });
            break;
          }

          // Run all tool calls, then return every result in one user message.
          const results = await Promise.all(
            toolUses.map(async (t): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
              send({ type: "tool", name: t.name, input: t.input });
              const r = await runTool(t.name, t.input);
              send({ type: "tool_result", name: t.name, ok: r.ok });
              return r.ok
                ? { type: "tool_result", tool_use_id: t.id, content: JSON.stringify(r.content) }
                : { type: "tool_result", tool_use_id: t.id, is_error: true, content: r.error };
            }),
          );
          history.push({ role: "user", content: results });

          if (turn === MAX_TURNS - 1) {
            send({ type: "text", text: "\n\n(Stopped after several lookups. Ask a narrower question for a full answer.)" });
          }
        }
        send({ type: "done", messages: history });
      } catch (err) {
        const message =
          err instanceof Anthropic.RateLimitError
            ? "The assistant is busy right now. Try again in a moment."
            : err instanceof Anthropic.AuthenticationError
              ? "The API key was rejected. Check ANTHROPIC_API_KEY."
              : err instanceof Anthropic.APIError
                ? `The AI service returned an error (${err.status}).`
                : "Something went wrong answering that.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
