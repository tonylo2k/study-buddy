"use client";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { logAttempt } from "@/lib/db";
import { activityHref } from "@/lib/plan";
import type { LessonPack, Settings } from "@/lib/types";
import VisualExplainerPlayer, { type PlayerResult } from "../VisualExplainerPlayer";

export default function Watch({ pack, settings }: { pack: LessonPack; settings: Settings }) {
  const [i, setI] = useState(0);
  const [watched, setWatched] = useState<Set<number>>(new Set());
  const started = useRef(new Date().toISOString());
  const list = pack.visualExplainers;
  const explainer = list[i];

  const onFinished = useCallback(
    (r: PlayerResult) => {
      setWatched((w) => new Set(w).add(i));
      void logAttempt({
        packId: pack.id,
        type: "visual_explainer",
        startedAt: started.current,
        payload: { explainerId: explainer.explainer_id, completed: r.completed, reducedMotion: r.reducedMotion, durationSec: r.durationSec },
      });
      started.current = new Date().toISOString();
    },
    [i, pack.id, explainer?.explainer_id],
  );

  if (!explainer) return <p className="text-soft">This lesson has no pictures to watch yet.</p>;
  const done = watched.has(i);
  const hasNextIdea = i + 1 < list.length;
  const nextCard = "flex min-h-[92px] w-full items-center gap-3.5 rounded-[28px] bg-ink px-5 py-4 text-left text-white";
  const nextInner = (label: string) => (
    <>
      <span className="flex-1">
        <span className="block text-[13px] font-extrabold uppercase tracking-wider text-[#C9D3DC]">Next</span>
        <span className="block text-xl font-black">{label}</span>
      </span>
      <ChevronRight size={26} strokeWidth={2.4} />
    </>
  );
  // On wide screens this sits under the chapter list.
  const aside = hasNextIdea ? (
    <button className={nextCard} onClick={() => setI(i + 1)}>
      {nextInner(`Idea ${i + 2}`)}
    </button>
  ) : pack.teachBack ? (
    <Link href={activityHref(pack.id, "teach")} className={nextCard}>
      {nextInner("Teach it back")}
    </Link>
  ) : (
    <Link href={`/pack?id=${pack.id}`} className={nextCard}>
      {nextInner("Back to the lesson")}
    </Link>
  );

  return (
    <div className="space-y-4">
      {list.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Ideas in this lesson">
          {list.map((e, n) => (
            <button
              key={e.explainer_id + n}
              role="tab"
              aria-selected={n === i}
              onClick={() => setI(n)}
              className={`min-h-[44px] shrink-0 rounded-full border-2 px-4 py-2 text-sm font-extrabold ${n === i ? "border-sage bg-sage-light text-sage-dark" : "border-line bg-white text-soft"}`}
            >
              {watched.has(n) ? "✓ " : ""}Idea {n + 1}
            </button>
          ))}
        </div>
      )}
            <VisualExplainerPlayer
        explainer={explainer}
        reducedMotionSetting={settings.reducedMotion}
        defaultSpeed={settings.explainerSpeed}
        ttsEnabled={settings.ttsEnabled}
        voiceURI={settings.ttsVoiceURI}
        onFinished={onFinished}
        aside={aside}
      />
      {done && (
        <div className="card mx-auto max-w-xl space-y-2 text-center lg:hidden">
          <p className="font-bold">You watched the whole idea. Want to watch that idea again?</p>
          <p className="text-sm text-soft">Use the Again button any time. Rewatching helps it stick.</p>
          <div className="flex flex-col gap-2">
            {i + 1 < list.length && (
              <button className="btn-primary" onClick={() => setI(i + 1)}>
                Next idea
              </button>
            )}
            {pack.teachBack && (
              <Link href={activityHref(pack.id, "teach")} className={i + 1 < list.length ? "btn-secondary" : "btn-primary"}>
                Teach it back
              </Link>
            )}
            <Link href={`/pack?id=${pack.id}`} className="btn-quiet">
              Back to the lesson
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
