"use client";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { db, uid } from "@/lib/db";
import { IconView } from "@/lib/icons";
import { TAXONOMY } from "@/lib/taxonomy";

/**
 * "What happened on this one?" — the child taps a habit (icon + label).
 * The optional hint asks Claude for a suggestion; she still chooses.
 */
export default function MistakeTagger({
  attemptId,
  packId,
  itemId,
  context,
  onTagged,
}: {
  attemptId: string;
  packId: string;
  itemId: string;
  context?: { question: string; correctAnswer: string; childAnswer: string; subject: string };
  onTagged?: (taxonomyId: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [hintState, setHintState] = useState<"idle" | "loading" | "none">("idle");

  const tag = async (taxonomyId: string) => {
    if (picked) return;
    setPicked(taxonomyId);
    await db.mistakes.add({ id: uid(), attemptId, packId, itemId, taxonomyId, createdAt: new Date().toISOString() });
    onTagged?.(taxonomyId);
  };

  const suggest = async () => {
    if (!context) return;
    setHintState("loading");
    try {
      const res = await apiFetch("/api/classify-mistake", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(context) });
      const j = await res.json();
      if (res.ok && j.suggested_id) {
        setHint(j.suggested_id);
        setHintState("idle");
      } else setHintState("none");
    } catch {
      setHintState("none");
    }
  };

  if (picked) {
    const h = TAXONOMY.find((x) => x.id === picked)!;
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-sage-light px-3 py-2 text-sm font-semibold text-sage-dark">
        <IconView iconId={h.icon_id} emoji={h.emoji} label={h.label} size={22} /> Noted: {h.label}. Spotting it is how it gets fixed.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-2xl bg-cream p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-ink">What happened on this one?</p>
        {context && hintState !== "none" && !hint && (
          <button type="button" onClick={suggest} disabled={hintState === "loading"} className="btn-quiet !min-h-0 !py-1 text-xs">
            {hintState === "loading" ? "Thinking…" : "Give me a hint"}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {TAXONOMY.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => tag(h.id)}
            className={`flex min-h-[52px] items-center gap-2 rounded-xl border-2 bg-white px-2 py-2 text-left text-xs font-semibold leading-tight text-ink ${hint === h.id ? "border-sage ring-2 ring-sage-light" : "border-line"}`}
          >
            <IconView iconId={h.icon_id} emoji={h.emoji} label={h.label} size={24} className="shrink-0" />
            <span>{h.label}</span>
          </button>
        ))}
      </div>
      {hint && <p className="text-xs text-soft">The outlined one is a guess. You know best.</p>}
    </div>
  );
}
