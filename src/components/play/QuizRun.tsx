"use client";
import { Pencil } from "lucide-react";
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
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-soft">
        <span>
          Question {i + 1} of {questions.length}
        </span>
        <span className="flex gap-1" aria-hidden>
          {questions.map((_, n) => (
            <span key={n} className={`h-2 w-6 rounded-full ${n < i ? "bg-sage" : n === i ? "bg-sage/50" : "bg-line"}`} />
          ))}
        </span>
      </div>
      <div className="card">
        <p className="text-lg font-bold leading-snug">{q.prompt}</p>
      </div>

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
        <button className="btn-primary w-full" disabled={!ready} onClick={check}>
          Check
        </button>
      ) : (
        <section className="space-y-3" aria-live="polite">
          <div className={`rounded-2xl px-4 py-3 ${checked ? "bg-sage-light" : "bg-gold-light"}`}>
            <p className="font-bold">{checked ? "Yes, that’s it." : "Not this time."}</p>
            {!checked && <p className="mt-1 text-sm">The answer: {correctText(q)}</p>}
            {q.explanation && <p className="mt-1 text-sm text-soft">{q.explanation}</p>}
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
          <button className="btn-primary w-full" onClick={next}>
            {i + 1 < questions.length ? "Next question" : "Finish"}
          </button>
        </section>
      )}
    </div>
  );
}
