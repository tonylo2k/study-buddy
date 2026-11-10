"use client";
import { apiFetch } from "./api";
import { db } from "./db";
import type { Extract, GenerateKind, LessonPack } from "./types";

export const PACK_KINDS: { kind: GenerateKind; label: string; field: keyof LessonPack }[] = [
  { kind: "visual_explainers", label: "Pictures that move (explainers)", field: "visualExplainers" },
  { kind: "teachback", label: "Teach-back", field: "teachBack" },
  { kind: "visual_flashcards", label: "Picture flashcards", field: "flashcards" },
  { kind: "quiz", label: "Quick quiz", field: "quiz" },
  { kind: "drill", label: "Speed practice", field: "drill" },
];

export function missingKinds(pack: LessonPack): GenerateKind[] {
  return PACK_KINDS.filter(({ field }) => {
    const v = pack[field];
    return Array.isArray(v) ? v.length === 0 : !v;
  }).map((k) => k.kind);
}

export type KindStatus = "waiting" | "working" | "done" | "failed";

/**
 * Ask the server for each kind in its own request (in parallel) and save each piece
 * to the pack the moment it arrives, so the first explainer is playable as early as possible.
 */
export async function generateIntoPack(
  packId: string,
  extract: Extract,
  kinds: GenerateKind[],
  onStatus: (kind: GenerateKind, status: KindStatus, error?: string) => void,
): Promise<{ ok: number; failed: number; keyMissing: string | null }> {
  let ok = 0;
  let failed = 0;
  let keyMissing: string | null = null;
  await Promise.all(
    kinds.map(async (kind) => {
      onStatus(kind, "working");
      try {
        const res = await apiFetch("/api/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ extract, kinds: [kind] }),
        });
        const j = await res.json().catch(() => ({}));
        // 503 = key (or passcode) not set up on the server; 401/429 = family passcode needed. Either way, stop and say so.
        if (res.status === 503 || res.status === 401 || res.status === 429) keyMissing = j.error || "Setup needed";
        if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
        const patch: Partial<LessonPack> = {};
        if (j.visualExplainers) patch.visualExplainers = j.visualExplainers;
        if (j.teachBack) patch.teachBack = j.teachBack;
        if (j.flashcards) patch.flashcards = j.flashcards;
        if (j.quiz) patch.quiz = j.quiz;
        if (j.drill) patch.drill = j.drill;
        if (Object.keys(patch).length === 0) throw new Error(j.errors?.[kind] || "Nothing came back.");
        await db.lessonPacks.update(packId, patch);
        ok++;
        onStatus(kind, "done");
      } catch (e) {
        failed++;
        onStatus(kind, "failed", e instanceof Error ? e.message : "failed");
      }
    }),
  );
  return { ok, failed, keyMissing };
}
