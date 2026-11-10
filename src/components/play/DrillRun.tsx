"use client";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { isCorrect, parseInlineChoices, shuffle } from "@/lib/answers";
import { db, logAttempt, uid } from "@/lib/db";
import type { DrillItem, LessonPack } from "@/lib/types";
import { TextAnswer } from "../AnswerInput";
import MistakeTagger from "../MistakeTagger";
import { DoneCard, SoftRing } from "../ui";

export default function DrillRun({ pack }: { pack: LessonPack }) {
  const drill = pack.drill!;
  const duration = drill.duration_seconds || 300;
  const attemptId = useMemo(() => uid(), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const order = useMemo(() => shuffle(drill.items), [pack.id]);

  // "Beat your last" compares only with her own earlier sessions on this lesson.
  const previous = useLiveQuery(async () => {
    const rows = await db.attempts.where("packId").equals(pack.id).toArray();
    const drills = rows.filter((a) => a.type === "drill" && a.id !== attemptId).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const scores = drills.map((a) => Number(a.payload.score) || 0);
    return { best: scores.length ? Math.max(...scores) : null, last: scores.length ? scores[scores.length - 1] : null };
  }, [pack.id]);

  const [phase, setPhase] = useState<"ready" | "run" | "done">("ready");
  const [n, setN] = useState(0);
  const [value, setValue] = useState("");
  const [score, setScore] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [lastLine, setLastLine] = useState("");
  const [misses, setMisses] = useState<{ item: DrillItem; given: string }[]>([]);
  const startedAt = useRef("");
  const t0 = useRef(0);
  const finished = useRef(false);
  const live = useRef({ score, n });
  live.current = { score, n };

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    setPhase("done");
    void logAttempt({
      id: attemptId,
      packId: pack.id,
      type: "drill",
      startedAt: startedAt.current,
      payload: { score: live.current.score, attempted: live.current.n, durationSec: Math.min(duration, Math.round((Date.now() - t0.current) / 1000)) },
    });
  };

  useEffect(() => {
    if (phase !== "run") return;
    const id = setInterval(() => {
      const s = (Date.now() - t0.current) / 1000;
      setElapsed(s);
      if (s >= duration) finish(); // ends softly: no sound, no red, just the finish card
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, duration]);

  const start = () => {
    startedAt.current = new Date().toISOString();
    t0.current = Date.now();
    setPhase("run");
  };

  const item = order[n % order.length];
  const inline = item.type === "mcq" ? parseInlineChoices(item.prompt) : null;

  const answer = (given: string) => {
    if (!given.trim()) return;
    const ok = isCorrect(item.answer, given);
    if (ok) {
      setScore((s) => s + 1);
      setLastLine("Last one: ✓");
    } else {
      setLastLine(`Last one: the answer was ${item.answer}`);
      setMisses((m) => (m.some((x) => x.item.id === item.id) ? m : [...m, { item, given }]));
    }
    live.current = { score: live.current.score + (ok ? 1 : 0), n: n + 1 };
    setN(n + 1);
    setValue("");
  };

  if (phase === "ready") {
    return (
      <div className="card space-y-3 text-center">
        <div className="text-5xl" aria-hidden>
          ⚡
        </div>
        <h2 className="text-xl font-extrabold">Speed practice</h2>
        <p className="text-soft">Five calm minutes of quick questions. Go at a steady pace. There is no rush.</p>
        {previous?.best != null && (
          <p className="chip mx-auto">
            Last time: {previous.last} · Your best: {previous.best}
          </p>
        )}
        <button className="btn-primary w-full" onClick={start}>
          Start
        </button>
      </div>
    );
  }

  if (phase === "done") {
    const best = previous?.best ?? null;
    const line =
      best === null
        ? `You answered ${score} correctly. That is your first score to beat next time.`
        : score > best
          ? `You answered ${score} correctly. That is a new best for you (it was ${best}).`
          : `You answered ${score} correctly. Your best is ${best}.`;
    return (
      <div className="space-y-4">
        <DoneCard emoji="🌤️" title={elapsed >= duration ? "Time’s up — great work today!" : "Nice steady practice!"} lines={[line]}>
          <Link className="btn-primary" href="/">
            Back to Today
          </Link>
        </DoneCard>
        {misses.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-bold">A few to look at again (tagging is optional)</h3>
            {misses.slice(0, 5).map(({ item: m, given }) => (
              <div key={m.id} className="card space-y-2">
                <p className="text-sm font-semibold">{m.prompt}</p>
                <p className="text-sm text-soft">
                  Answer: {m.answer} · You wrote: {given}
                </p>
                <MistakeTagger attemptId={attemptId} packId={pack.id} itemId={m.id} context={{ question: m.prompt, correctAnswer: m.answer, childAnswer: given, subject: pack.subject }} />
              </div>
            ))}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SoftRing fraction={elapsed / duration} label="Session time" />
          <span className="text-sm text-soft">Steady pace</span>
        </div>
        <span className="chip">Correct: {score}</span>
      </div>
      <div className="card min-h-[7rem]">
        <p className="text-xl font-bold leading-snug">{inline ? inline.stem : item.prompt}</p>
      </div>
      {inline ? (
        <div className="grid gap-2">
          {inline.options.map((o) => (
            <button key={o.key} className="btn-secondary justify-start text-left" onClick={() => answer(o.key)}>
              <span className="chip">{o.key}</span> {o.text}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-2">
          <TextAnswer key={n} value={value} onChange={setValue} numeric={item.type === "numeric"} onEnter={() => answer(value)} autoFocus />
          <button className="btn-primary" disabled={!value.trim()} onClick={() => answer(value)}>
            OK
          </button>
        </div>
      )}
      <p className="min-h-[1.5rem] text-center text-sm text-soft" aria-live="polite">
        {lastLine}
      </p>
      <button className="btn-quiet w-full" onClick={finish}>
        Finish for today
      </button>
    </div>
  );
}
