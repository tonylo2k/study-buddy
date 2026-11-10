"use client";
import Link from "next/link";
import { useState } from "react";
import { EmptyState, Loading } from "@/components/ui";
import { saveSettings, useAttempts, usePacks, usePracticeTests, useSettings } from "@/lib/db";
import { buildPlan, minutesPracticedToday } from "@/lib/plan";
import { loadSamplePacks } from "@/lib/samples";
import { isDue } from "@/lib/schedule";

function NameCard() {
  const [name, setName] = useState("");
  return (
    <form
      className="card space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) void saveSettings({ childDisplayName: name.trim().slice(0, 30) });
      }}
    >
      <label htmlFor="child-name" className="font-bold">
        What should Study Buddy call you?
      </label>
      <div className="flex gap-2">
        <input id="child-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" autoComplete="off" />
        <button className="btn-primary" disabled={!name.trim()}>
          Save
        </button>
      </div>
    </form>
  );
}

export default function TodayPage() {
  const { settings, ready } = useSettings();
  const packs = usePacks();
  const attempts = useAttempts();
  const tests = usePracticeTests();
  const [loadingSample, setLoadingSample] = useState(false);

  if (!ready || !packs || !attempts || !tests) return <Loading />;

  const plan = buildPlan(packs, attempts);
  const nextStep = plan.find((s) => !s.done);
  const doneCount = plan.filter((s) => s.done).length;
  const minutes = minutesPracticedToday(attempts);
  const dueCount = packs.filter((p) => isDue(p)).length;
  const weekAgo = Date.now() - 7 * 86400000;
  const testedThisWeek = attempts.some((a) => a.type === "practice_test" && new Date(a.startedAt).getTime() > weekAgo);
  const canTest = packs.some((p) => p.quiz || p.drill);
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-5">
      <header>
        <h1 className="h1">
          {hello}
          {settings.childDisplayName ? `, ${settings.childDisplayName}` : ""}
        </h1>
        <p className="mt-1 text-soft">
          {minutes > 0 ? `You practiced for ${minutes} minute${minutes === 1 ? "" : "s"} today. That’s steady work.` : "A calm 15 minutes is all it takes today."}
        </p>
      </header>

      {!settings.childDisplayName && <NameCard />}

      {packs.length === 0 ? (
        <EmptyState emoji="📷" title="No lessons yet">
          <p>Take a photo of a homework or textbook page to make the first study pack.</p>
          <div className="flex flex-col gap-2">
            <Link href="/snap" className="btn-primary">
              Snap a lesson
            </Link>
            <button
              className="btn-secondary"
              disabled={loadingSample}
              onClick={async () => {
                setLoadingSample(true);
                await loadSamplePacks();
                setLoadingSample(false);
              }}
            >
              Load sample pack
            </button>
          </div>
        </EmptyState>
      ) : (
        <>
          {nextStep ? (
            <Link href={nextStep.href} className="btn-primary w-full !min-h-[72px] !rounded-3xl !text-xl">
              {doneCount > 0 ? "Keep going" : "Start 15 minutes"}
            </Link>
          ) : (
            <div className="card text-center">
              <div className="text-4xl" aria-hidden>
                🌿
              </div>
              <p className="mt-1 text-lg font-bold">{plan.length ? "Today’s plan is done. Nice, steady work." : "Nothing is due today."}</p>
              <p className="text-soft">You can still practice anything you like.</p>
              <Link href="/practice" className="btn-secondary mt-3 w-full">
                Choose a lesson
              </Link>
            </div>
          )}

          {plan.length > 0 && (
            <section aria-label="Today’s plan" className="space-y-2">
              <h2 className="flex items-center justify-between font-bold">
                Today’s plan
                <span className="text-sm font-semibold text-soft">
                  {dueCount > 0 ? `${dueCount} review${dueCount === 1 ? "" : "s"} due · ` : ""}about {plan.reduce((a, s) => a + s.minutes, 0)} min
                </span>
              </h2>
              <ol className="space-y-2">
                {plan.map((s) => (
                  <li key={s.key}>
                    <Link href={s.href} className={`card flex items-center gap-3 !p-3 ${s.done ? "opacity-70" : ""} ${s === nextStep ? "!border-sage" : ""}`}>
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cream text-2xl" aria-hidden>
                        {s.done ? "✅" : s.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{s.label}</span>
                        <span className="block truncate text-sm text-soft">{s.packTitle}</span>
                      </span>
                      <span className="shrink-0 text-sm text-soft">{s.done ? "done" : `${s.minutes} min`}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {canTest && !testedThisWeek && (
            <Link href="/test" className="card flex items-center gap-3 !p-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold-light text-2xl" aria-hidden>
                📝
              </span>
              <span className="flex-1">
                <span className="block font-bold">This week’s practice test</span>
                <span className="block text-sm text-soft">Easy ones first, then check with your checklist.</span>
              </span>
            </Link>
          )}
        </>
      )}
    </div>
  );
}
