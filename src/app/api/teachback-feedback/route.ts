import { callClaudeJSON, errorResponse } from "@/lib/server/anthropic";
import { requirePasscode } from "@/lib/server/auth";
import { validateFeedback } from "@/lib/server/validate";
import type { TeachBack, TeachBackFeedback } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const denied = requirePasscode(req);
    if (denied) return denied;
    const body = await req.json().catch(() => null);
    const teachBack = body?.teachBack as TeachBack | undefined;
    const childAnswer = typeof body?.childAnswer === "string" ? body.childAnswer.trim().slice(0, 2000) : "";
    const arrangement = (body?.pictureArrangement ?? null) as Record<string, string> | null;
    if (!teachBack?.must_cover?.length) return Response.json({ error: "Missing teach-back." }, { status: 400 });

    // Picture placement is scored here, not by the model.
    let picture: TeachBackFeedback["picture"];
    const tokens = teachBack.visual_prompt?.mode === "arrange" ? teachBack.visual_prompt.tokens : [];
    if (arrangement && tokens.length) {
      const gradable = tokens.filter((t) => t.correct_slot);
      picture = { correct: gradable.filter((t) => arrangement[t.id] === t.correct_slot).length, total: gradable.length };
    }

    if (!childAnswer) {
      if (!picture) return Response.json({ error: "Nothing to give feedback on yet." }, { status: 400 });
      const all = picture.correct === picture.total;
      const fb: TeachBackFeedback = {
        covered: all ? teachBack.must_cover.slice(0, 1) : [],
        missing: all ? [] : teachBack.must_cover.slice(0, 1),
        encouragement: all
          ? "Every picture is in the right place. You showed the idea clearly."
          : "Nice work arranging the pictures. Have one more look at the ones that could move.",
        score_band: all ? "great" : picture.correct > 0 ? "good" : "keep_trying",
        picture,
      };
      return Response.json(fb);
    }

    const pictureNote = picture
      ? `\n\n(She also arranged pictures: ${picture.correct} of ${picture.total} landed in the correct place.)`
      : "";
    const fb = await callClaudeJSON({
      prompt: "04_teachback_feedback",
      vars: {
        teachBackJson: JSON.stringify(
          { must_cover: teachBack.must_cover, key_points: body?.extract?.key_points ?? [] },
          null,
          2,
        ),
        subject: String(body?.extract?.subject ?? ""),
        title: String(body?.extract?.title ?? ""),
        childAnswer: childAnswer + pictureNote,
      },
      maxTokens: 1000,
      validate: validateFeedback,
    });
    return Response.json({ ...fb, picture });
  } catch (e) {
    return errorResponse(e);
  }
}
