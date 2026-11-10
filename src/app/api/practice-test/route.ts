import { callClaudeJSON, errorResponse } from "@/lib/server/anthropic";
import { requirePasscode } from "@/lib/server/auth";
import { validatePracticeTest } from "@/lib/server/validate";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const denied = requirePasscode(req);
    if (denied) return denied;
    const body = await req.json().catch(() => null);
    const packs = Array.isArray(body?.packs) ? body.packs.slice(0, 8) : [];
    if (packs.length === 0) return Response.json({ error: "No recent lessons to build a test from." }, { status: 400 });
    const test = await callClaudeJSON({
      prompt: "06_practice_test",
      vars: {
        packsJson: JSON.stringify(packs, null, 2),
        topMistakesJson: JSON.stringify(Array.isArray(body?.topMistakes) ? body.topMistakes : [], null, 2),
      },
      maxTokens: 5000,
      validate: validatePracticeTest,
    });
    return Response.json(test);
  } catch (e) {
    return errorResponse(e);
  }
}
