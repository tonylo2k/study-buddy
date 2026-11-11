"use client";
import { Check, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { isCorrect } from "@/lib/answers";
import { db, logAttempt, uid } from "@/lib/db";
import { applyQuizResult, friendlyDay, nextDue, type QuizOutcome } from "@/lib/schedule";
import type { LessonPack, QuizQuestion, Review } from "@/lib/types";
import { ChoiceList, PictureChoices, TextAnswer } from "../AnswerInput";
import ArrangeBoard from "../ArrangeBoard";
import MistakeTagger from "../MistakeTagger";
import { DoneCard } from "../ui";

function correctText(q: QuizQuestion): string {
  if (q.type === "pick_picture") return q.picture_choices?.find((p) => p.id === q.answer)?.caption ?? q.answer ?? "";
  if (q.type === "drag_match")
    return (q.match_left ?? [])
      .map((l) => `${l.caption} → ${q.match_right?.find((r) => r.id === q.answer_map?.[l.id])?.label ?? "?"}`)
      .join("; ");
  return q.answer ?? "";
}

export default function QuizRun({ pack }: { pack: LessonPack }) {
  const questions = pack.quiz!.questions;
  const attemptId = useMemo(() => uid(), []);
  const started = useRef(new Date().toISOString());
  const [i, setI] = useState(0);
  const [value, setValue] = useState("");
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<null | boolean>(null);
  const [results, setResults] = useState<{ id: string; correct: boolean; given: string }[]>([]);
  const [summary, setSummary] = useState<null | { score: number; outcome: QuizOutcome; schedule: Review[] }>(null);

  const q = questions[i];

  const ready = q?.type === "drag_match" ? (q.match_left ?? []).every((l) => matches[l.id]) : value.trim().length > 0;

  const check = () => {
    let ok: boolean;
    let given = value;
    if (q.type === "drag_match") {
      ok = (q.match_left ?? []).every((l) => matches[l.id] === q.answer_map?.[l.id]);
      given = JSON.stringify(matches);
    } else if (q.type === "mcq" || q.type === "pick_picture") {
      ok = value === q.answer;
    } else ok = isCorrect(q.answer ?? "", value);
    setChecked(ok);
    setResults((r) => [...r, { id: q.id, correct: ok, given }]);
  };

  const meantTheSame = () => {
    setChecked(true);
    setResults((r) => r.map((x) => (x.id === q.id ? { ...x, correct: true } : x)));
  };

  const next = async () => {
    if (i + 1 < questions.length) {
      setI(i + 1);
      setValue("");
      setMatches({});
      setChecked(null);
      return;
    }
    const score = results.filter((r) => r.correct).length;
    const { schedule, outcome } = applyQuizResult(pack.schedule, score / questions.length);
    await db.lessonPacks.update(pack.id, { schedule });
    await logAttempt({
      id: attemptId,
      packId: pack.id,
      type: "quiz",
      startedAt: started.current,
      payload: { score, total: questions.length, answers: results, outcome },
    });
    setSummary({ score, outcome, schedule });
  };

  if (summary) {
    const due = nextDue({ ...pack, schedule: summary.schedule });
    const line =
      summary.outcome === "advanced"
        ? `This review is done. The next one comes ${due ? friendlyDay(due) : "later"}.`
        : summary.outcome === "finished"
          ? "All three reviews for this lesson are done."
          : summary.outcome === "repeat"
            ? "We will visit this lesson again tomorrow. Some ideas need one more visit, and that is normal."
            : `This one was extra practice.${due ? ` Your next review comes ${friendlyDay(due)}.` : ""}`;
    return (
      <DoneCard icon={Pencil} title="Quiz finished. You answered every question." lines={[line, `You got ${summary.score} of ${questions.length} this time.`]}>
        <Link className="btn-primary" href="/">
          Back to Today
        </Link>
        <Link className="btn-secondary" href={`/pack?id=${pack.id}`}>
          Back to the lesson
        </Link>
      </DoneCard>
    );
  }

  const locked = checked !== null;
  const marks =
    locked && q.type === "drag_match" ? Object.fromEntries((q.match_left ?? []).map((l) => [l.id, matches[l.id] === q.answer_map?.[l.id]])) : undefined;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 lg:max-w-none lg:flex-row lg:gap-6">
      <div className="flex flex-col gap-4 lg:w-[372px] lg:shrink-0">
        <section className="flex flex-col gap-3 rounded-[28px] bg-ink px-5 py-[18px] text-white lg:rounded-[32px] lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-extrabold uppercase tracking-wider text-gold lg:text-sm">
              Question {i + 1} of {questions.length}
            </p>
            <span className="flex gap-1" aria-hidden>
              {questions.map((_, n) => (
                <span key={n} className={`h-2 w-5 rounded-full ${n < i ? "bg-white" : n === i ? "bg-gold" : "bg-white/25"}`} />
              ))}
            </span>
          </div>
          <p className="text-xl font-extrabold leading-snug [text-wrap:pretty] lg:text-[26px]">{q.prompt}</p>
        </section>

        {/* Wide screens: where she is in the quiz. No red marks; a missed one is simply "look again". */}
        <ol className="card hidden flex-col gap-2 lg:flex" aria-label="Questions">
          {questions.map((qq, n) => {
            const r = results.find((x) => x.id === qq.id);
            const current = n === i;
            return (
              <li key={qq.id} className={`flex min-h-[48px] items-center gap-3 rounded-2xl px-3 ${current ? "bg-sage-light" : "bg-cream"}`}>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                    r ? (r.correct ? "bg-sage text-white" : "bg-gold text-ink") : current ? "bg-white text-sage-dark" : "border-2 border-[#D8D2C6] bg-white text-soft"
                  }`}
                >
                  {r?.correct ? <Check size={15} strokeWidth={3.2} aria-hidden /> : n + 1}
                </span>
                <span className={`text-[15px] ${current ? "font-black" : "font-bold text-soft"}`}>{r ? (r.correct ? "Got it" : "One to look at again") : current ? "This one" : "Coming up"}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
      {q.type === "mcq" && <ChoiceList choices={q.choices ?? []} value={value} onPick={setValue} locked={locked} correct={q.answer} />}
      {q.type === "pick_picture" && (
        <PictureChoices choices={q.picture_choices ?? []} diagrams={q.diagrams} value={value} onPick={setValue} locked={locked} correct={q.answer} />
      )}
      {q.type === "drag_match" && (
        <ArrangeBoard tokens={q.match_left ?? []} slots={q.match_right ?? []} value={matches} onChange={setMatches} locked={locked} marks={marks} />
      )}
      {(q.type === "short" || q.type === "numeric") && (
        <TextAnswer value={value} onChange={setValue} numeric={q.type === "numeric"} disabled={locked} onEnter={() => ready && !locked && check()} />
      )}

      {!locked ? (
        <button className="btn-primary !min-h-[60px] w-full !text-[19px] lg:w-auto lg:self-end lg:px-12" disabled={!ready} onClick={check}>
          Check
        </button>
      ) : (
        <section className="flex flex-col gap-3" aria-live="polite">
          <div className={`rounded-[22px] px-5 py-4 ${checked ? "bg-sage-light" : "bg-gold-light"}`}>
            <p className="text-lg font-black">{checked ? "Yes, that’s it." : "Not this time."}</p>
            {!checked && <p className="mt-1 text-[15px] font-bold">The answer: {correctText(q)}</p>}
            {q.explanation && <p className="mt-1 text-[15px] font-semibold text-soft">{q.explanation}</p>}
          </div>
          {!checked && (
            <MistakeTagger
              key={q.id}
              attemptId={attemptId}
              packId={pack.id}
              itemId={q.id}
              context={{ question: q.prompt, correctAnswer: correctText(q), childAnswer: q.type === "drag_match" ? "(matching)" : value, subject: pack.subject }}
            />
          )}
          {!checked && q.type === "short" && (
            <button className="btn-quiet w-full" onClick={meantTheSame}>
              My answer means the same thing
            </button>
          )}
          <button className="btn-primary !min-h-[60px] w-full !text-[19px] lg:w-auto lg:self-end lg:px-12" onClick={next}>
            {i + 1 < questions.length ? "Next question" : "Finish"}
          </button>
        </section>
      )}
      </div>
    </div>
  );
}
