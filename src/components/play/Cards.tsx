"use client";
import { Check, Layers, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { logAttempt } from "@/lib/db";
import { IconView } from "@/lib/icons";
import { activityHref, hasActivity } from "@/lib/plan";
import type { Flashcard, LessonPack } from "@/lib/types";
import { DoneCard, MiniDiagram } from "../ui";

// Each card gets a calm tint for its picture area, taking turns.
const TINTS = ["bg-sky-light", "bg-gold-light", "bg-sage-light", "bg-blush-light"];

export default function Cards({ pack }: { pack: LessonPack }) {
  const all = pack.flashcards!.cards;
  const [queue, setQueue] = useState<Flashcard[]>(all);
  const [flipped, setFlipped] = useState(false);
  const [againIds, setAgainIds] = useState<Set<string>>(new Set());
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const started = useRef(new Date().toISOString());
  const card = queue[0];

  const next = (gotIt: boolean) => {
    const rest = queue.slice(1);
    const nq = gotIt ? rest : [...rest, card];
    const again = gotIt ? againIds : new Set(againIds).add(card.id);
    if (!gotIt) setAgainIds(again);
    else setDoneIds(new Set(doneIds).add(card.id));
    setFlipped(false);
    if (nq.length === 0) {
      setDone(true);
      void logAttempt({ packId: pack.id, type: "flashcard", startedAt: started.current, payload: { total: all.length, againCount: again.size, completed: true } });
    } else setQueue(nq);
  };

  if (done) {
    const n = againIds.size;
    return (
      <DoneCard icon={Layers} title="You went through every card" lines={[n > 0 ? `You gave ${n} card${n === 1 ? "" : "s"} a second look. That is exactly what second looks are for.` : "Steady work, one card at a time."]}>
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
  const position = all.findIndex((c) => c.id === card.id);
  const tint = TINTS[position % TINTS.length];

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 lg:max-w-none lg:flex-row lg:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <p className="text-center text-sm font-bold text-soft lg:hidden">
          {doneIds.size} of {all.length} done
        </p>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? "Showing the answer. Tap to see the question." : "Tap to flip the card"}
          className={`flex min-h-[26rem] w-full flex-col overflow-hidden rounded-[32px] border-2 bg-white text-center transition-colors duration-300 lg:min-h-[30rem] lg:rounded-[36px] ${flipped ? "border-sage" : "border-line"}`}
        >
          <span className={`flex min-h-[11rem] w-full flex-col items-center justify-center gap-3 p-5 lg:min-h-[14rem] ${tint}`}>
            {v?.diagram ? (
              <span className="w-full max-w-[300px] rounded-2xl bg-white p-3 lg:max-w-[420px] lg:p-5">
                <MiniDiagram diagram={v.diagram} width={260} fluid />
              </span>
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-white lg:h-32 lg:w-32">
                <IconView iconId={v?.icon_id} emoji={v?.emoji} label={v?.caption} size={56} />
              </span>
            )}
            {v?.caption && <span className="rounded-full bg-white px-4 py-1.5 text-sm font-extrabold text-ink lg:text-base">{v.caption}</span>}
          </span>
          <span className="flex flex-1 flex-col items-center justify-center gap-3 p-6 lg:p-8">
            <span className={`text-[13px] font-black uppercase tracking-wider ${flipped ? "text-sage-dark" : "text-soft"}`}>{flipped ? "Answer" : "Question"}</span>
            <span className="text-2xl font-black leading-snug [text-wrap:pretty] lg:text-[34px]">{flipped ? card.back : card.front}</span>
            {!flipped && <span className="text-sm font-semibold text-soft lg:text-base">Say your answer, then tap to flip</span>}
          </span>
        </button>
        {flipped ? (
          <div className="flex gap-3">
            <button className="btn-secondary !min-h-[60px] flex-1" onClick={() => next(false)}>
              <RotateCcw size={20} /> See it again
            </button>
            <button className="btn-primary !min-h-[60px] flex-1" onClick={() => next(true)}>
              <Check size={20} strokeWidth={3} /> Got it
            </button>
          </div>
        ) : (
          <button className="btn-primary !min-h-[60px] w-full !text-[19px]" onClick={() => setFlipped(true)}>
            Flip
          </button>
        )}
      </div>

      {/* Wide screens: the whole deck at a glance */}
      <aside className="hidden w-[276px] shrink-0 lg:block">
        <section className="card flex flex-col gap-3">
          <h2 className="text-lg font-black">
            {doneIds.size} of {all.length} done
          </h2>
          <ol className="grid grid-cols-5 gap-2" aria-label="Cards in this deck">
            {all.map((c, i) => {
              const isDone = doneIds.has(c.id);
              const current = c.id === card.id;
              const again = againIds.has(c.id) && !isDone;
              return (
                <li
                  key={c.id}
                  aria-label={`Card ${i + 1}${isDone ? ", done" : current ? ", showing now" : again ? ", coming back" : ""}`}
                  className={`flex h-11 items-center justify-center rounded-xl text-sm font-black ${
                    isDone ? "bg-sage text-white" : current ? "border-2 border-sage bg-sage-light text-sage-dark" : again ? "bg-gold-light text-gold-deep" : "bg-cream text-soft"
                  }`}
                >
                  {isDone ? <Check size={16} strokeWidth={3.2} aria-hidden /> : i + 1}
                </li>
              );
            })}
          </ol>
          {againIds.size > 0 && <p className="text-sm font-semibold text-soft">Gold cards are coming back for a second look.</p>}
        </section>
      </aside>
    </div>
  );
}
