"use client";
import { Layers } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { logAttempt } from "@/lib/db";
import { IconView } from "@/lib/icons";
import { activityHref, hasActivity } from "@/lib/plan";
import type { Flashcard, LessonPack } from "@/lib/types";
import { DoneCard, MiniDiagram } from "../ui";

export default function Cards({ pack }: { pack: LessonPack }) {
  const all = pack.flashcards!.cards;
  const [queue, setQueue] = useState<Flashcard[]>(all);
  const [flipped, setFlipped] = useState(false);
  const [again, setAgain] = useState(0);
  const [done, setDone] = useState(false);
  const started = useRef(new Date().toISOString());
  const card = queue[0];

  const next = (gotIt: boolean) => {
    const rest = queue.slice(1);
    const nq = gotIt ? rest : [...rest, card];
    if (!gotIt) setAgain((n) => n + 1);
    setFlipped(false);
    if (nq.length === 0) {
      setDone(true);
      void logAttempt({ packId: pack.id, type: "flashcard", startedAt: started.current, payload: { total: all.length, againCount: again, completed: true } });
    } else setQueue(nq);
  };

  if (done) {
    return (
      <DoneCard icon={Layers} title="You went through every card" lines={[again > 0 ? `You gave ${again} card${again === 1 ? "" : "s"} a second look. That is exactly what second looks are for.` : "Steady work, one card at a time."]}>
        {hasActivity(pack, "quiz") && (
          <Link className="btn-primary" href={activityHref(pack.id, "quiz")}>
            Quick quiz
          </Link>
        )}
        <Link className="btn-secondary" href="/">
          Back to Today
        </Link>
      </DoneCard>
    );
  }

  const v = card.visual;
  const seen = all.length - new Set(queue.map((c) => c.id)).size;

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-soft">
        {seen} of {all.length} done
      </p>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Showing the answer. Tap to see the question." : "Tap to flip the card"}
        className={`flex min-h-[20rem] w-full flex-col items-center justify-center gap-4 rounded-3xl border-2 p-6 text-center shadow-card transition-colors duration-300 ${flipped ? "border-sage bg-sage-light" : "border-line bg-white"}`}
      >
        {v?.diagram ? <MiniDiagram diagram={v.diagram} width={240} /> : <IconView iconId={v?.icon_id} emoji={v?.emoji} label={v?.caption} size={72} />}
        {v?.caption && <span className="chip">{v.caption}</span>}
        <span className="text-xs font-bold uppercase tracking-wide text-soft">{flipped ? "Answer" : "Question"}</span>
        <span className="text-xl font-bold leading-snug">{flipped ? card.back : card.front}</span>
        {!flipped && <span className="text-sm text-soft">Say your answer, then tap to flip</span>}
      </button>
      {flipped ? (
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={() => next(false)}>
            See it again
          </button>
          <button className="btn-primary flex-1" onClick={() => next(true)}>
            Got it
          </button>
        </div>
      ) : (
        <button className="btn-primary w-full" onClick={() => setFlipped(true)}>
          Flip
        </button>
      )}
    </div>
  );
}
