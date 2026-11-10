import "server-only";
import { PROMPTS, type PromptName } from "./prompts.generated";

export const MISSING_KEY_MESSAGE = "Ask Tony to add ANTHROPIC_API_KEY to .env.local";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
// Only change this if you route requests through your own gateway.
const BASE_URL = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");

export class MissingKeyError extends Error {
  constructor() {
    super(MISSING_KEY_MESSAGE);
  }
}
export class ModelOutputError extends Error {
  rawText?: string;
  constructor(message: string, rawText?: string) {
    super(message);
    this.rawText = rawText;
  }
}

export function hasKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** Fill {{placeholders}} in a prompt template from prompts/*.md. */
export function renderPrompt(name: PromptName, vars: Record<string, string> = {}): { system: string; user: string } {
  const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");
  return { system: fill(PROMPTS[name].system), user: fill(PROMPTS[name].user) };
}

type Block =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };
type Msg = { role: "user" | "assistant"; content: string | Block[] };

async function send(system: string, messages: Msg[], maxTokens: number): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new MissingKeyError();
  const res = await fetch(`${BASE_URL}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.error?.message ?? "";
    } catch {
      /* ignore */
    }
    if (res.status === 401) throw new Error("The Anthropic API key was not accepted. Check ANTHROPIC_API_KEY in .env.local.");
    if (res.status === 404) throw new Error(`Model “${MODEL}” was not found. Set ANTHROPIC_MODEL in .env.local to a current Sonnet model.`);
    throw new Error(`Claude API error ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

export function parseJsonLoose(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object found");
  return JSON.parse(t.slice(start, end + 1));
}

/**
 * Call Claude with a prompt template, parse JSON, validate it.
 * If parsing or validation fails, ask once more for "JSON only", then give up.
 */
export async function callClaudeJSON<T>(opts: {
  prompt: PromptName;
  vars?: Record<string, string>;
  extraUser?: string;
  image?: { base64: string; mediaType: string };
  maxTokens?: number;
  validate: (raw: unknown) => T;
}): Promise<T> {
  const { system, user } = renderPrompt(opts.prompt, opts.vars);
  const userText = opts.extraUser ? `${user}\n\n${opts.extraUser}` : user;
  const first: Msg = {
    role: "user",
    content: opts.image
      ? [
          { type: "image", source: { type: "base64", media_type: opts.image.mediaType, data: opts.image.base64 } },
          { type: "text", text: userText },
        ]
      : userText,
  };
  const maxTokens = opts.maxTokens ?? 4096;

  const text1 = await send(system, [first], maxTokens);
  try {
    return opts.validate(parseJsonLoose(text1));
  } catch (e1) {
    const why = e1 instanceof Error ? e1.message : "invalid";
    const text2 = await send(
      system,
      [
        first,
        { role: "assistant", content: text1 || "(empty)" },
        {
          role: "user",
          content: `That could not be used (${why}). Return JSON only, matching the schema exactly. No markdown fences, no commentary.`,
        },
      ],
      maxTokens,
    );
    try {
      return opts.validate(parseJsonLoose(text2));
    } catch (e2) {
      throw new ModelOutputError(
        `The model did not return usable JSON (${e2 instanceof Error ? e2.message : "invalid"}).`,
        text2 || text1,
      );
    }
  }
}

/** Turn any thrown error into a JSON Response with the right status. */
export function errorResponse(e: unknown): Response {
  if (e instanceof MissingKeyError) return Response.json({ error: e.message }, { status: 503 });
  if (e instanceof ModelOutputError) return Response.json({ error: e.message, rawText: e.rawText }, { status: 502 });
  return Response.json({ error: e instanceof Error ? e.message : "Something went wrong." }, { status: 500 });
}
