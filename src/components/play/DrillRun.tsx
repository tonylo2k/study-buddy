"use client";
import { Zap } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { isCorrect, parseInlineChoices, shuffle } from "@/lib/answers";
import { db, logAttempt, uid } from "@/lib/db";
import type { DrillItem, LessonPack } from "@/lib/types";
import { TextAnswer } from "../AnswerInput";
import MistakeTagger from "../MistakeTagger";
import { DoneCard, IconTile, SoftRing } from "../ui";

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
      <div className="card mx-auto max-w-xl space-y-3 text-center">
        <div className="flex justify-center">
          <IconTile icon={Zap} size={72} />
        </div>
        <h2 className="text-2xl font-black">Speed practice</h2>
        <p className="font-semibold text-soft">Five calm minutes of quick questions. Go at a steady pace. There is no rush.</p>
        {previous?.best != null && (
          <p className="chip mx-auto">
            Last time: {previous.last} · Your best: {previous.best}
          </p>
        )}
        <button className="btn-primary !min-h-[60px] w-full !text-[19px]" onClick={start}>
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
      <div className="mx-auto max-w-xl space-y-4 lg:max-w-3xl">
        <DoneCard icon={Zap} title={elapsed >= duration ? "Time’s up — great work today!" : "Nice steady practice!"} lines={[line]}>
          <Link className="btn-primary" href="/">
            Back to Today
          </Link>
        </DoneCard>
        {misses.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-lg font-black">A few to look at again (tagging is optional)</h3>
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

  const best = previous?.best ?? null;
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 lg:max-w-none lg:flex-row lg:gap-6">
      {/* Phone: a slim status row. Wide screens use the side panel instead. */}
      <div className="flex items-center justify-between lg:hidden">
        <div className="flex items-center gap-3">
          <SoftRing fraction={elapsed / duration} label="Session time" />
          <span className="text-sm font-bold text-soft">Steady pace</span>
        </div>
        <span className="chip !px-4 !py-1.5 !text-sm">Correct: {score}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <section className="flex min-h-[9rem] items-center rounded-[28px] bg-ink px-5 py-6 text-white lg:min-h-[15rem] lg:rounded-[36px] lg:px-10">
          <p data-testid="drill-prompt" className="text-2xl font-black leading-snug [text-wrap:pretty] lg:text-[40px] lg:leading-tight">
            {inline ? inline.stem : item.prompt}
          </p>
        </section>
        {inline ? (
          <div className="grid gap-2.5 lg:grid-cols-2 lg:gap-3">
            {inline.options.map((o) => (
              <button key={o.key} className="btn-secondary !min-h-[60px] justify-start text-left lg:!min-h-[72px] lg:!text-[19px]" onClick={() => answer(o.key)}>
                <span className="chip !text-sm">{o.key}</span> {o.text}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex gap-2.5">
            <TextAnswer key={n} value={value} onChange={setValue} numeric={item.type === "numeric"} onEnter={() => answer(value)} autoFocus />
            <button className="btn-primary !min-h-[60px] px-7 !text-[19px]" disabled={!value.trim()} onClick={() => answer(value)}>
              OK
            </button>
          </div>
        )}
        <p className="min-h-[1.5rem] text-center text-[15px] font-bold text-soft lg:text-left" aria-live="polite">
          {lastLine}
        </p>
        <button className="btn-quiet w-full lg:hidden" onClick={finish}>
          Finish for today
        </button>
      </div>

      <aside className="hidden w-[276px] shrink-0 flex-col gap-4 lg:flex">
        <section className="card flex flex-col items-center gap-3 text-center">
          <SoftRing fraction={elapsed / duration} size={120} label="Session time" />
          <p className="text-[15px] font-bold text-soft">Steady pace. No rush.</p>
        </section>
        <section className="card flex flex-col gap-1">
          <p className="text-sm font-extrabold uppercase tracking-wider text-soft">Correct so far</p>
          <p className="text-[44px] font-black leading-none text-sage-dark">{score}</p>
          {best !== null && <p className="text-[15px] font-bold text-soft">Your best: {best}</p>}
        </section>
        <button className="btn-secondary w-full" onClick={finish}>
          Finish for today
        </button>
      </aside>
    </div>
  );
}
