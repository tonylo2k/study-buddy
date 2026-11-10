import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Family passcode: one shared secret that gates every route that spends API credits.
 *
 * - FAMILY_PASSCODE set    → the request must carry it in the x-family-passcode header.
 * - not set, running local → open (so `npm run dev` works with no extra setup).
 * - not set, on Vercel     → refused. A public deployment must never run unprotected.
 */
export const PASSCODE_HEADER = "x-family-passcode";
const NEED_PASSCODE = "Enter the family passcode in Parent → Settings";
const NOT_SET_UP = "This deployment has no FAMILY_PASSCODE. Ask Tony to add one in the hosting settings, then redeploy";
const TOO_MANY = "Too many wrong passcodes. Please wait ten minutes and try again";

const expected = () => process.env.FAMILY_PASSCODE?.trim() || "";
const deployed = () => Boolean(process.env.VERCEL) || process.env.REQUIRE_PASSCODE === "1";

export type PasscodeState = "not_required" | "ok" | "missing" | "wrong" | "not_configured" | "locked";

// Best-effort guard against guessing. It lives in memory, so on serverless hosting it only
// covers a warm instance. A long passcode and a spend limit on the key are the real defence.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_WRONG = 10;
const wrong = new Map<string, { n: number; first: number }>();

function clientId(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

const digest = (s: string) => createHash("sha256").update(s).digest();

export function passcodeState(req: Request): PasscodeState {
  const want = expected();
  if (!want) return deployed() ? "not_configured" : "not_required";

  const id = clientId(req);
  const now = Date.now();
  const rec = wrong.get(id);
  if (rec && now - rec.first > WINDOW_MS) wrong.delete(id);
  if ((wrong.get(id)?.n ?? 0) >= MAX_WRONG) return "locked";

  const given = req.headers.get(PASSCODE_HEADER)?.trim() || "";
  if (!given) return "missing";
  // Hash both sides so the comparison takes the same time whatever was sent.
  if (timingSafeEqual(digest(given), digest(want))) {
    wrong.delete(id);
    return "ok";
  }
  const cur = wrong.get(id) ?? { n: 0, first: now };
  wrong.set(id, { n: cur.n + 1, first: cur.first });
  return "wrong";
}

/** Returns a Response to send back if the request may not proceed, otherwise null. */
export function requirePasscode(req: Request): Response | null {
  const state = passcodeState(req);
  if (state === "ok" || state === "not_required") return null;
  if (state === "not_configured") return Response.json({ error: NOT_SET_UP, code: "passcode_not_configured" }, { status: 503 });
  if (state === "locked") return Response.json({ error: TOO_MANY, code: "passcode_locked" }, { status: 429 });
  return Response.json(
    { error: state === "wrong" ? "That family passcode was not accepted. Check it in Parent → Settings" : NEED_PASSCODE, code: "passcode" },
    { status: 401 },
  );
}
