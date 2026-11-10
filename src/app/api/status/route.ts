import { hasKey } from "@/lib/server/anthropic";
import { passcodeState } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

// Tells the Settings screen what is set up. Never returns the key or the passcode.
export async function GET(req: Request) {
  return Response.json({ configured: hasKey(), passcode: passcodeState(req) });
}
