"use client";
import { ClipboardCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ChoiceList, PromptWithKeywords, TextAnswer } from "@/components/AnswerInput";
import MistakeTagger from "@/components/MistakeTagger";
import { EmptyState, Loading, Notice, PageHeader, SoftRing } from "@/components/ui";
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
    <div className="card space-y-3">
      <div className="text-center text-5xl" aria-hidden>
        📝
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
      <div className="card space-y-3">
        <h2 className="text-xl font-extrabold">{test.title}</h2>
        <p className="text-soft">
          {items.length} questions · about {test.duration_minutes} minutes · a soft timer, no alarm.
        </p>
        <ol className="space-y-2 text-sm">
          <li className="flex gap-2">
            <span aria-hidden>1️⃣</span> Answer the easy ones first.
          </li>
          <li className="flex gap-2">
            <span aria-hidden>2️⃣</span> Skip the hard ones for now. You will come back to them.
          </li>
          <li className="flex gap-2">
            <span aria-hidden>3️⃣</span> Underline keywords like “not,” “which two,” and units.
          </li>
          <li className="flex gap-2">
            <span aria-hidden>4️⃣</span> Use the last {test.check_minutes} minutes to check with your checklist.
          </li>
        </ol>
        <button className="btn-primary w-full" onClick={begin}>
          Begin calmly
        </button>
      </div>
    );
  }

  if (phase === "results") {
    const right = items.filter((it) => (it.type === "mcq" ? answers[it.id] === it.answer : isCorrect(it.answer, answers[it.id] ?? "")));
    const wrong = items.filter((it) => !right.includes(it));
    return (
      <div className="space-y-4">
        <div className="card space-y-2 text-center">
          <div className="text-5xl" aria-hidden>
            🌿
          </div>
          <h2 className="text-xl font-extrabold">{flags.usedChecklist ? "You used your checklist — nice!" : "You finished the whole test."}</h2>
          <ul className="space-y-1 text-soft">
            {flags.usedChecklist && <li>✅ Checked with the checklist</li>}
            {flags.finishedCheckPhase && <li>✅ Finished the checking time</li>}
            {skipped.length > 0 && <li>✅ Skipped {skipped.length} hard one{skipped.length === 1 ? "" : "s"} and came back</li>}
            {!flags.usedChecklist && <li>Next time, try ticking off your checklist before handing in.</li>}
          </ul>
          <p className="text-sm text-soft">
            {right.length} of {items.length} right this time.
          </p>
        </div>
        {right.length > 0 && (
          <section className="card space-y-1">
            <h3 className="font-bold">What you got right</h3>
            <ul className="space-y-1 text-sm">
              {right.map((it) => (
                <li key={it.id}>✅ {it.prompt}</li>
              ))}
            </ul>
          </section>
        )}
        {wrong.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-bold">Worth another look</h3>
            {wrong.map((it) => (
              <div key={it.id} className="card space-y-2">
                <p className="text-sm font-semibold">{it.prompt}</p>
                <p className="text-sm text-soft">
                  Answer: {it.answer}
                  {answers[it.id] ? ` · You wrote: ${answers[it.id]}` : " · left blank"}
                </p>
                <MistakeTagger attemptId={attemptId} packId="" itemId={it.id} context={{ question: it.prompt, correctAnswer: it.answer, childAnswer: answers[it.id] ?? "", subject: "" }} />
              </div>
            ))}
          </section>
        )}
        <Link href="/" className="btn-primary w-full">
          Back to Today
        </Link>
      </div>
    );
  }

  const nearCheck = phase !== "check" && elapsed >= totalSec - checkSec;
  const header = (
    <div className="flex items-center gap-3">
      <SoftRing fraction={phase === "check" ? checkElapsed / checkSec : elapsed / totalSec} label={phase === "check" ? "Checking time" : "Test time"} />
      <div className="flex-1">
        <p className="font-bold">{phase === "pass1" ? "Pass 1: easy ones first" : phase === "pass2" ? "Pass 2: back to the skipped ones" : "Checking time"}</p>
        <p className="text-sm text-soft">
          {phase === "check" ? `About ${test.check_minutes} calm minutes to look everything over.` : `Question ${pos + 1} of ${list.length}`}
        </p>
      </div>
      <button className={`chip !min-h-[36px] ${underline ? "" : "!bg-white border border-line"}`} aria-pressed={underline} onClick={() => setUnderline((u) => !u)}>
        🔖 Keywords
      </button>
    </div>
  );

  if (phase === "check") {
    return (
      <div className="space-y-4">
        {header}
        <section className="card space-y-2 !border-sage">
          <h2 className="font-bold">{personal ? "My Careless Mistakes Checklist" : "Checklist (a starter list)"}</h2>
          <ul className="space-y-2">
            {checklist.map((h) => (
              <li key={h.id}>
                <label className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 ${ticks[h.id] ? "border-sage bg-sage-light" : "border-line bg-white"}`}>
                  <input type="checkbox" className="h-6 w-6 accent-[#4F8F80]" checked={!!ticks[h.id]} onChange={(e) => setTicks({ ...ticks, [h.id]: e.target.checked })} />
                  <IconView iconId={h.icon_id} emoji={h.emoji} label={h.label} size={28} className="shrink-0" />
                  <span>
                    <span className="block font-bold">{h.label}</span>
                    <span className="block text-sm text-soft">{h.tip}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="font-bold">Look over your answers</h2>
          {items.map((it, n) => (
            <div key={it.id} className="card space-y-2">
              <p className="font-semibold">
                {n + 1}. <PromptWithKeywords prompt={it.prompt} keywords={underline ? it.keyword_hints : []} />
              </p>
              <ItemAnswer item={it} value={answers[it.id] ?? ""} onChange={(v) => set(it.id, v)} />
            </div>
          ))}
        </section>
        <button className="btn-primary w-full" onClick={submit}>
          I checked. Hand it in
        </button>
      </div>
    );
  }

  const value = answers[item.id] ?? "";
  return (
    <div className="space-y-4">
      {header}
      {nearCheck && (
        <Notice>
          This is a good moment to start checking.{" "}
          <button className="font-bold underline" onClick={toCheck}>
            Go to checking
          </button>
        </Notice>
      )}
      <div className="card">
        <p className="text-lg font-bold leading-snug">
          <PromptWithKeywords prompt={item.prompt} keywords={underline ? item.keyword_hints : []} />
        </p>
      </div>
      <ItemAnswer key={item.id} item={item} value={value} onChange={(v) => set(item.id, v)} onEnter={() => value.trim() && advance(false)} />
      <div className="flex gap-3">
        {phase === "pass1" ? (
          <button className="btn-secondary flex-1" onClick={() => advance(true)}>
            Skip for now
          </button>
        ) : (
          <button className="btn-secondary flex-1" onClick={() => advance(false)}>
            Leave it
          </button>
        )}
        <button className="btn-primary flex-1" disabled={!value.trim()} onClick={() => advance(false)}>
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
      <PageHeader title="This week’s practice test" back="/practice" />
      {rec ? (
        <Runner key={rec.id} rec={rec} checklist={habits} personal={personalCount > 0} />
      ) : waiting ? (
        <div className="card space-y-3">
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
