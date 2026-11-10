"use client";
import { useEffect, useRef, useState } from "react";
import { generateIntoPack, PACK_KINDS, type KindStatus } from "@/lib/generate";
import type { Extract, GenerateKind } from "@/lib/types";
import { Notice } from "./ui";

/** Runs generation for the given kinds and shows calm, per-piece progress. */
export default function GeneratePanel({
  packId,
  extract,
  kinds,
  onFinished,
}: {
  packId: string;
  extract: Extract;
  kinds: GenerateKind[];
  onFinished: (r: { ok: number; failed: number; keyMissing: string | null }) => void;
}) {
  const [status, setStatus] = useState<Record<string, { s: KindStatus; err?: string }>>(() => Object.fromEntries(kinds.map((k) => [k, { s: "waiting" as KindStatus }])));
  const [keyMissing, setKeyMissing] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    generateIntoPack(packId, extract, kinds, (kind, s, err) => setStatus((prev) => ({ ...prev, [kind]: { s, err } }))).then((r) => {
      setKeyMissing(r.keyMissing);
      onFinished(r);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card space-y-3" aria-live="polite">
      <h2 className="text-lg font-bold">Making the study pack…</h2>
      <p className="text-sm text-soft">This usually takes about a minute. You can stay on this screen.</p>
      <ul className="space-y-2">
        {PACK_KINDS.filter((k) => kinds.includes(k.kind)).map(({ kind, label }) => {
          const st = status[kind];
          return (
            <li key={kind} className="flex items-start gap-3">
              <span className="mt-0.5 w-6 text-center" aria-hidden>
                {st.s === "done" ? "✅" : st.s === "failed" ? "🌧️" : st.s === "working" ? "⏳" : "·"}
              </span>
              <span className="flex-1">
                <span className="font-semibold">{label}</span>
                {st.s === "failed" && !keyMissing && <span className="block text-xs text-soft">Could not be made this time: {st.err}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      {keyMissing && <Notice tone="warn">{keyMissing}. The lesson is saved, and the rest can be made once that is sorted out (open the lesson and tap “Finish making this pack”).</Notice>}
    </div>
  );
}
