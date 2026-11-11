"use client";
import { Check, ClipboardCheck, Highlighter, Leaf } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ChoiceList, PromptWithKeywords, TextAnswer } from "@/components/AnswerInput";
import MistakeTagger from "@/components/MistakeTagger";
import { EmptyState, IconTile, Loading, Notice, PageHeader, SoftRing } from "@/components/ui";
import { isCorrect } from "@/lib/answers";
import { db, logAttempt, uid, useMistakes, usePacks, usePracticeTests } from "@/lib/db";
import { IconView } from "@/lib/icons";
import { buildLocalPracticeTest, packSummaries, recentPacks } from "@/lib/practiceTest";
import { checklistFor, topHabits, type Habit } from "@/lib/taxonomy";
import type { PracticeTest, PracticeTestItem, PracticeTestRecord } from "@/lib/types";

// ---------- Builder ----------
function Builder({ onReady }: { onReady: (rec: PracticeTestRecord) => void }) {
  const packs = usePacks();
  const mistakes = useMistakes();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!packs || !mistakes) return <Loading />;
  const recent = recentPacks(packs);

  const save = async (test: PracticeTest) => {
    const rec: PracticeTestRecord = { id: uid(), createdAt: new Date().toISOString(), itemPackIds: recent.map((p) => p.id), testJSON: test };
    await db.practiceTests.put(rec);
    onReady(rec);
  };

  const viaClaude = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/practice-test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packs: packSummaries(recent), topMistakes: topHabits(mistakes).map((t) => t.habit.label) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "The test could not be made right now.");
      await save(j as PracticeTest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The test could not be made right now.");
    } finally {
      setBusy(false);
    }
  };

  const local = buildLocalPracticeTest(recent);

  if (packs.length === 0)
    return (
      <EmptyState icon={ClipboardCheck} title="No lessons to test yet">
        <p>Practice tests are built from your recent lessons.</p>
        <Link href="/snap" className="btn-primary">
          Snap a lesson
        </Link>
      </EmptyState>
    );

  return (
    <div className="card mx-auto max-w-xl space-y-3">
      <div className="flex justify-center">
        <IconTile icon={ClipboardCheck} size={72} tone="gold" />
      </div>
      <p className="text-center text-soft">
        A calm practice test from {recent.length} recent lesson{recent.length === 1 ? "" : "s"}: {recent.map((p) => p.title).join(", ")}.
      </p>
      {error && <Notice tone="warn">{error}</Notice>}
      <button className="btn-primary w-full" disabled={busy} onClick={viaClaude}>
        {busy ? "Making the test…" : "Generate practice test"}
      </button>
      {local && (
        <button className="btn-secondary w-full" disabled={busy} onClick={() => save(local)}>
          Build from saved questions (works offline)
        </button>
      )}
    </div>
  );
}

// ---------- Runner ----------
type Phase = "intro" | "pass1" | "pass2" | "check" | "results";

function ItemAnswer({ item, value, onChange, onEnter, autoFocus }: { item: PracticeTestItem; value: string; onChange: (v: string) => void; onEnter?: () => void; autoFocus?: boolean }) {
  return item.type === "mcq" ? (
    <ChoiceList choices={item.choices ?? []} value={value} onPick={onChange} />
  ) : (
    <TextAnswer value={value} onChange={onChange} numeric={item.type === "numeric"} onEnter={onEnter} autoFocus={autoFocus} />
  );
}

function Runner({ rec, checklist, personal }: { rec: PracticeTestRecord; checklist: Habit[]; personal: boolean }) {
  const test = rec.testJSON;
  const items = test.items;
  const attemptId = useMemo(() => uid(), []);
  const [phase, setPhase] = useState<Phase>("intro");
  const [pos, setPos] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<string[]>([]);
  const [underline, setUnderline] = useState(false);
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [elapsed, setElapsed] = useState(0);
  const [checkElapsed, setCheckElapsed] = useState(0);
  const t0 = useRef(0);
  const checkT0 = useRef(0);
  const startedIso = useRef("");
  const [flags, setFlags] = useState({ usedChecklist: false, finishedCheckPhase: false });

  const totalSec = test.duration_minutes * 60;
  const checkSec = test.check_minutes * 60;
  const running = phase === "pass1" || phase === "pass2" || phase === "check";

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setElapsed((Date.now() - t0.current) / 1000);
      if (checkT0.current) setCheckElapsed((Date.now() - checkT0.current) / 1000);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const begin = () => {
    t0.current = Date.now();
    startedIso.current = new Date().toISOString();
    setPhase("pass1");
  };
  const toCheck = () => {
    checkT0.current = Date.now();
    setUnderline(true);
    setPhase("check");
    window.scrollTo({ top: 0 });
  };
  const set = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }));

  const pass2Items = items.filter((it) => skipped.includes(it.id));
  const list = phase === "pass2" ? pass2Items : items;
  const item = list[pos];

  const advance = (skip: boolean) => {
    if (phase === "pass1") {
      const nextSkipped = skip ? [...skipped, item.id] : skipped.filter((x) => x !== item.id);
      setSkipped(nextSkipped);
      if (pos + 1 < items.length) setPos(pos + 1);
      else if (nextSkipped.length) {
        setPos(0);
        setPhase("pass2");
      } else toCheck();
    } else if (phase === "pass2") {
      if (pos + 1 < pass2Items.length) setPos(pos + 1);
      else toCheck();
    }
  };

  const submit = async () => {
    const usedChecklist = Object.values(ticks).some(Boolean);
    const finishedCheckPhase = checklist.every((h) => ticks[h.id]) || checkElapsed >= checkSec;
    const f = { usedChecklist, finishedCheckPhase };
    setFlags(f);
    const graded = items.map((it) => ({ id: it.id, given: answers[it.id] ?? "", correct: it.type === "mcq" ? answers[it.id] === it.answer : isCorrect(it.answer, answers[it.id] ?? "") }));
    await logAttempt({
      id: attemptId,
      packId: "",
      type: "practice_test",
      startedAt: startedIso.current,
      payload: { testId: rec.id, score: graded.filter((g) => g.correct).length, total: items.length, answers: graded, skippedCount: skipped.length, durationSec: Math.round(elapsed) },
      processFlags: f,
    });
    await db.practiceTests.update(rec.id, { attemptId });
    setPhase("results");
    window.scrollTo({ top: 0 });
  };

  if (phase === "intro") {
    return (
      <div className="card mx-auto max-w-xl space-y-4">
        <h2 className="text-2xl font-black">{test.title}</h2>
        <p className="font-semibold text-soft">
          {items.length} questions · about {test.duration_minutes} minutes · a soft timer, no alarm.
        </p>
        <ol className="space-y-2.5">
          {[
            "Answer the easy ones first.",
            "Skip the hard ones for now. You will come back to them.",
            "Underline keywords like “not,” “which two,” and units.",
            `Use the last ${test.check_minutes} minutes to check with your checklist.`,
          ].map((line, n) => (
            <li key={n} className="flex items-center gap-3 text-[15px] font-bold">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage-light text-sm font-black text-sage-dark" aria-hidden>
                {n + 1}
              </span>
              {line}
            </li>
          ))}
        </ol>
        <button className="btn-primary !min-h-[60px] w-full !text-[19px]" onClick={begin}>
          Begin calmly
        </button>
      </div>
    );
  }

  if (phase === "results") {
    const right = items.filter((it) => (it.type === "mcq" ? answers[it.id] === it.answer : isCorrect(it.answer, answers[it.id] ?? "")));
    const wrong = items.filter((it) => !right.includes(it));
    return (
      <div className="mx-auto max-w-xl space-y-4 lg:max-w-none">
        <div className="card mx-auto flex max-w-xl flex-col items-center gap-2 text-center">
          <IconTile icon={Leaf} size={72} />
          <h2 className="text-2xl font-black leading-tight">{flags.usedChecklist ? "You used your checklist — nice!" : "You finished the whole test."}</h2>
          <ul className="space-y-1.5 text-[15px] font-bold text-soft">
            {flags.usedChecklist && <li className="flex justify-center gap-2"><Check size={18} strokeWidth={3} className="mt-0.5 shrink-0 text-sage" aria-hidden /> Checked with the checklist</li>}
            {flags.finishedCheckPhase && <li className="flex justify-center gap-2"><Check size={18} strokeWidth={3} className="mt-0.5 shrink-0 text-sage" aria-hidden /> Finished the checking time</li>}
            {skipped.length > 0 && (
              <li className="flex justify-center gap-2">
                <Check size={18} strokeWidth={3} className="mt-0.5 shrink-0 text-sage" aria-hidden /> Skipped {skipped.length} hard one{skipped.length === 1 ? "" : "s"} and came back
              </li>
            )}
            {!flags.usedChecklist && <li>Next time, try ticking off your checklist before handing in.</li>}
          </ul>
          <p className="text-sm font-semibold text-soft">
            {right.length} of {items.length} right this time.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          {right.length > 0 && (
            <section className="card space-y-2">
              <h3 className="text-lg font-black">What you got right</h3>
              <ul className="space-y-1.5 text-[15px] font-semibold">
                {right.map((it) => (
                  <li key={it.id} className="flex gap-2">
                    <Check size={18} strokeWidth={3} className="mt-0.5 shrink-0 text-sage" aria-hidden /> {it.prompt}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {wrong.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-lg font-black">Worth another look</h3>
              {wrong.map((it) => (
                <div key={it.id} className="card space-y-2">
                  <p className="text-[15px] font-extrabold">{it.prompt}</p>
                  <p className="text-sm font-semibold text-soft">
                    Answer: {it.answer}
                    {answers[it.id] ? ` · You wrote: ${answers[it.id]}` : " · left blank"}
                  </p>
                  <MistakeTagger attemptId={attemptId} packId="" itemId={it.id} context={{ question: it.prompt, correctAnswer: it.answer, childAnswer: answers[it.id] ?? "", subject: "" }} />
                </div>
              ))}
            </section>
          )}
        </div>
        <Link href="/" className="btn-primary mx-auto w-full max-w-xl">
          Back to Today
        </Link>
      </div>
    );
  }

  const nearCheck = phase !== "check" && elapsed >= totalSec - checkSec;
  const header = (
    <div className="flex items-center gap-3">
      <SoftRing size={64} fraction={phase === "check" ? checkElapsed / checkSec : elapsed / totalSec} label={phase === "check" ? "Checking time" : "Test time"} />
      <div className="flex-1">
        <p className="text-lg font-black leading-tight">{phase === "pass1" ? "Pass 1: easy ones first" : phase === "pass2" ? "Pass 2: back to the skipped ones" : "Checking time"}</p>
        <p className="text-sm font-bold text-soft">
          {phase === "check" ? `About ${test.check_minutes} calm minutes to look everything over.` : `Question ${pos + 1} of ${list.length}`}
        </p>
      </div>
      <button className={`chip !min-h-[44px] !px-4 !text-sm ${underline ? "" : "border border-line !bg-white !text-soft"}`} aria-pressed={underline} onClick={() => setUnderline((u) => !u)}>
        <Highlighter size={16} /> Keywords
      </button>
    </div>
  );

  if (phase === "check") {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 lg:max-w-none lg:flex-row lg:items-start lg:gap-6">
        {/* The checklist stays in view on wide screens while she looks over her answers. */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-8 lg:w-[380px] lg:shrink-0">
          {header}
          <section className="card space-y-2.5 !border-2 !border-sage">
            <h2 className="text-lg font-black">{personal ? "My Careless Mistakes Checklist" : "Checklist (a starter list)"}</h2>
            <ul className="space-y-2">
              {checklist.map((h) => (
                <li key={h.id}>
                  <label className={`flex min-h-[60px] cursor-pointer items-center gap-3 rounded-[18px] border-2 p-3 ${ticks[h.id] ? "border-sage bg-sage-light" : "border-line bg-white"}`}>
                    <input type="checkbox" className="h-6 w-6 shrink-0 accent-[#3E7F70]" checked={!!ticks[h.id]} onChange={(e) => setTicks({ ...ticks, [h.id]: e.target.checked })} />
                    <IconView iconId={h.icon_id} emoji={h.emoji} label={h.label} size={28} className="shrink-0" />
                    <span>
                      <span className="block text-[15px] font-extrabold leading-tight">{h.label}</span>
                      <span className="block text-sm font-semibold text-soft">{h.tip}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
          <button className="btn-primary hidden !min-h-[60px] w-full !text-[19px] lg:flex" onClick={submit}>
            I checked. Hand it in
          </button>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h2 className="text-lg font-black">Look over your answers</h2>
          {items.map((it, n) => (
            <div key={it.id} className="card space-y-2.5">
              <p className="text-[17px] font-extrabold leading-snug">
                {n + 1}. <PromptWithKeywords prompt={it.prompt} keywords={underline ? it.keyword_hints : []} />
              </p>
              <ItemAnswer item={it} value={answers[it.id] ?? ""} onChange={(v) => set(it.id, v)} />
            </div>
          ))}
          <button className="btn-primary !min-h-[60px] w-full !text-[19px] lg:hidden" onClick={submit}>
            I checked. Hand it in
          </button>
        </div>
      </div>
    );
  }

  const value = answers[item.id] ?? "";
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 lg:max-w-3xl">
      {header}
      {nearCheck && (
        <Notice>
          This is a good moment to start checking.{" "}
          <button className="font-bold underline" onClick={toCheck}>
            Go to checking
          </button>
        </Notice>
      )}
      <section className="flex min-h-[8rem] items-center rounded-[28px] bg-ink px-5 py-6 text-white lg:min-h-[12rem] lg:rounded-[36px] lg:px-10">
        <p className="text-[22px] font-black leading-snug [text-wrap:pretty] lg:text-[34px]">
          <PromptWithKeywords prompt={item.prompt} keywords={underline ? item.keyword_hints : []} />
        </p>
      </section>
      <ItemAnswer key={item.id} item={item} value={value} onChange={(v) => set(item.id, v)} onEnter={() => value.trim() && advance(false)} />
      <div className="flex gap-3">
        {phase === "pass1" ? (
          <button className="btn-secondary !min-h-[60px] flex-1" onClick={() => advance(true)}>
            Skip for now
          </button>
        ) : (
          <button className="btn-secondary !min-h-[60px] flex-1" onClick={() => advance(false)}>
            Leave it
          </button>
        )}
        <button className="btn-primary !min-h-[60px] flex-1" disabled={!value.trim()} onClick={() => advance(false)}>
          Next
        </button>
      </div>
      {phase === "pass1" && skipped.length > 0 && <p className="text-center text-sm text-soft">Skipped so far: {skipped.length}. You will come back to them.</p>}
    </div>
  );
}

function TestInner() {
  const forceNew = useSearchParams().get("new") === "1";
  const tests = usePracticeTests();
  const mistakes = useMistakes();
  const [current, setCurrent] = useState<PracticeTestRecord | null>(null);
  const [dismissed, setDismissed] = useState(forceNew);

  if (!tests || !mistakes) return <Loading />;
  const { habits, personalCount } = checklistFor(mistakes);
  const waiting = !dismissed ? tests.find((t) => !t.attemptId) : undefined;
  const rec = current ?? null;

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-xl lg:max-w-none">
        <PageHeader title="This week’s practice test" back="/practice" />
      </div>
      {rec ? (
        <Runner key={rec.id} rec={rec} checklist={habits} personal={personalCount > 0} />
      ) : waiting ? (
        <div className="card mx-auto max-w-xl space-y-3">
          <p className="font-bold">A practice test is ready.</p>
          <p className="text-sm text-soft">
            {waiting.testJSON.items.length} questions, made {new Date(waiting.createdAt).toLocaleDateString()}.
          </p>
          <button className="btn-primary w-full" onClick={() => setCurrent(waiting)}>
            Open it
          </button>
          <button className="btn-quiet w-full" onClick={() => setDismissed(true)}>
            Make a new one instead
          </button>
        </div>
      ) : (
        <Builder onReady={setCurrent} />
      )}
    </div>
  );
}

export default function TestPage() {
  return (
    <Suspense fallback={<Loading />}>
      <TestInner />
    </Suspense>
  );
}
