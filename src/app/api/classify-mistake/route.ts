import { callClaudeJSON, errorResponse } from "@/lib/server/anthropic";
import { requirePasscode } from "@/lib/server/auth";
import { validateClassification } from "@/lib/server/validate";

export const maxDuration = 30;

// Optional helper: suggests a habit; the child still confirms by tapping.
export async function POST(req: Request) {
  try {
    const denied = requirePasscode(req);
    if (denied) return denied;
    const b = await req.json().catch(() => ({}));
    const s = (x: unknown) => (typeof x === "string" ? x.slice(0, 1000) : "");
    const result = await callClaudeJSON({
      prompt: "07_mistake_classify",
      vars: { subject: s(b.subject), question: s(b.question), correctAnswer: s(b.correctAnswer), childAnswer: s(b.childAnswer) },
      maxTokens: 400,
      validate: validateClassification,
    });
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
