import { callClaudeJSON, errorResponse } from "@/lib/server/anthropic";
import { requirePasscode } from "@/lib/server/auth";
import { validateExtract } from "@/lib/server/validate";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const denied = requirePasscode(req);
    if (denied) return denied;
    const body = await req.json().catch(() => null);
    const imageBase64 = typeof body?.imageBase64 === "string" ? body.imageBase64 : "";
    const mediaType = body?.mediaType === "image/png" ? "image/png" : "image/jpeg";
    if (!imageBase64) return Response.json({ error: "No picture was sent." }, { status: 400 });
    const extract = await callClaudeJSON({
      prompt: "01_extract",
      vars: { hintSubject: typeof body?.hintSubject === "string" ? body.hintSubject : "" },
      image: { base64: imageBase64, mediaType },
      maxTokens: 6000,
      validate: validateExtract,
    });
    // The photo is only held in memory for this request; nothing is written to disk.
    return Response.json(extract);
  } catch (e) {
    return errorResponse(e);
  }
}
