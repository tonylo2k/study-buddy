import { callClaudeJSON, errorResponse, hasKey, MISSING_KEY_MESSAGE } from "@/lib/server/anthropic";
import { requirePasscode } from "@/lib/server/auth";
import {
  validateDrill,
  validateExplainers,
  validateExtract,
  validateFlashcards,
  validateQuiz,
  validateTeachBack,
} from "@/lib/server/validate";
import type { Extract, GenerateKind, VisualExplainer } from "@/lib/types";

export const maxDuration = 300;

const KINDS: GenerateKind[] = ["teachback", "flashcards", "visual_flashcards", "visual_explainers", "quiz", "drill"];

/**
 * One explainer per key point, requested in parallel so the first one is playable sooner
 * than a single long response would allow. Capped at EXPLAINER_CAP (default 4, max 5).
 */
async function explainers(extract: Extract, extractJson: string): Promise<VisualExplainer[]> {
  const cap = Math.min(5, Math.max(1, Number(process.env.EXPLAINER_CAP) || 4));
  const picks = extract.key_points.slice(0, cap).map((text, index) => ({ text, index }));
  const settled = await Promise.allSettled(
    picks.map(({ text, index }) =>
      callClaudeJSON({
        prompt: "08_visual_explainer",
        vars: { extractJson },
        extraUser:
          `For this request, create exactly ONE explainer, for key point index ${index}: “${text}”. ` +
          `Set "key_point_ref" to ${index} and "explainer_id" to "ve_${index + 1}". ` +
          `Still return the {"explainers": [ … ]} wrapper with that single explainer inside.`,
        maxTokens: 6000,
        validate: validateExplainers,
      }),
    ),
  );
  // Ids are assigned here so they are always unique within the pack.
  const ok = settled.flatMap((s, i) =>
    s.status === "fulfilled" ? s.value.slice(0, 1).map((e) => ({ ...e, explainer_id: `ve_${picks[i].index + 1}`, key_point_ref: picks[i].index })) : [],
  );
  if (ok.length === 0) {
    const firstErr = settled.find((s) => s.status === "rejected") as PromiseRejectedResult | undefined;
    throw firstErr?.reason ?? new Error("No explainers could be made.");
  }
  return ok;
}

export async function POST(req: Request) {
  try {
    const denied = requirePasscode(req);
    if (denied) return denied;
    if (!hasKey()) return Response.json({ error: MISSING_KEY_MESSAGE }, { status: 503 });
    const body = await req.json().catch(() => null);
    let extract: Extract;
    try {
      extract = validateExtract(body?.extract);
    } catch {
      return Response.json({ error: "The lesson content was missing or incomplete." }, { status: 400 });
    }
    const kinds: GenerateKind[] = (Array.isArray(body?.kinds) ? body.kinds : []).filter((k: GenerateKind) =>
      KINDS.includes(k),
    );
    if (kinds.length === 0) return Response.json({ error: "Nothing was asked for." }, { status: 400 });

    // raw_ocr_text is not needed for generation and only adds tokens.
    const extractJson = JSON.stringify({ ...extract, raw_ocr_text: undefined }, null, 2);
    const out: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    await Promise.all(
      kinds.map(async (kind) => {
        try {
          if (kind === "teachback") {
            out.teachBack = await callClaudeJSON({ prompt: "04_teachback", vars: { extractJson }, validate: validateTeachBack });
          } else if (kind === "flashcards" || kind === "visual_flashcards") {
            // Prefer the visual prompt: cards arrive with `visual` already filled in.
            out.flashcards = await callClaudeJSON({ prompt: "09_visual_flashcards", vars: { extractJson }, validate: validateFlashcards });
          } else if (kind === "quiz") {
            out.quiz = await callClaudeJSON({ prompt: "03_quiz", vars: { extractJson }, validate: validateQuiz });
          } else if (kind === "drill") {
            out.drill = await callClaudeJSON({ prompt: "05_drill", vars: { extractJson }, maxTokens: 5000, validate: validateDrill });
          } else if (kind === "visual_explainers") {
            out.visualExplainers = await explainers(extract, extractJson);
          }
        } catch (e) {
          errors[kind] = e instanceof Error ? e.message : "failed";
        }
      }),
    );

    if (Object.keys(out).length === 0) {
      return Response.json({ error: Object.values(errors)[0] ?? "Generation failed.", errors }, { status: 502 });
    }
    return Response.json({ ...out, errors });
  } catch (e) {
    return errorResponse(e);
  }
}
