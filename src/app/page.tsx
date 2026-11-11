"use client";
import { Camera, Check, ClipboardCheck, Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ACTIVITY_ICON, EmptyState, IconTile, Loading } from "@/components/ui";
import { saveSettings, useAttempts, useMistakes, usePacks, usePracticeTests, useSettings } from "@/lib/db";
import { IconView } from "@/lib/icons";
import { buildPlan, minutesPracticedToday, type PlanStep } from "@/lib/plan";
import { loadSamplePacks } from "@/lib/samples";
import { friendlyDay, isDue, nextDue } from "@/lib/schedule";
import { checklistFor } from "@/lib/taxonomy";

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
      <label htmlFor="child-name" className="font-extrabold">
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

/** Soft sun-and-cloud drawing in the corner of the start card. Decoration only. */
function HeroArt() {
  return (
    <svg aria-hidden viewBox="0 0 380 300" className="pointer-events-none absolute -right-2 -top-2 h-[130px] w-[165px] lg:-right-1 lg:top-1 lg:h-[205px] lg:w-[260px]">
      <circle cx="268" cy="96" r="58" fill="#F2C66D" />
      <g stroke="#F2C66D" strokeWidth="9" strokeLinecap="round">
        <path d="M268 10v16M358 96h-16M330 34l-11 11M206 34l11 11M178 96h16" />
      </g>
      <path d="M118 262a44 44 0 0 1 7-87 60 60 0 0 1 115 13 38 38 0 0 1-6 74z" fill="#FFFFFF" />
    </svg>
  );
}

function PathStep({ s, next }: { s: PlanStep; next: boolean }) {
  const Icon = ACTIVITY_ICON[s.kind];
  return (
    <Link
      href={s.href}
      className={`flex min-h-[64px] items-center gap-3.5 rounded-[22px] border-2 bg-white px-3.5 py-2 text-ink lg:min-h-[124px] lg:flex-col lg:items-start lg:gap-2 lg:rounded-3xl lg:p-3.5 ${next ? "border-sage" : "border-line"} ${s.done ? "opacity-70" : ""}`}
    >
      {s.done ? <IconTile icon={Check} tone="sage" /> : <IconTile icon={Icon} tone={next ? "sage" : "sand"} />}
      <span className="min-w-0 flex-1 lg:flex-none">
        <span className="block text-[17px] font-extrabold leading-tight">{s.label}</span>
        <span className="block truncate text-sm font-semibold text-soft lg:whitespace-normal">{s.packTitle}</span>
      </span>
      <span className={`shrink-0 text-sm font-bold ${next ? "text-sage-dark" : "text-soft"}`}>{s.done ? "Done" : next ? `Up next · ${s.minutes} min` : `${s.minutes} min`}</span>
    </Link>
  );
}

export default function TodayPage() {
  const { settings, ready } = useSettings();
  const packs = usePacks();
  const attempts = useAttempts();
  const tests = usePracticeTests();
  const mistakes = useMistakes();
  const [loadingSample, setLoadingSample] = useState(false);

  if (!ready || !packs || !attempts || !tests || !mistakes) return <Loading />;

  const plan = buildPlan(packs, attempts);
  const nextStep = plan.find((s) => !s.done);
  const doneCount = plan.filter((s) => s.done).length;
  const minutes = minutesPracticedToday(attempts);
  const left = plan.filter((s) => !s.done).reduce((a, s) => a + s.minutes, 0);
  const weekAgo = Date.now() - 7 * 86400000;
  const testedThisWeek = attempts.some((a) => a.type === "practice_test" && new Date(a.startedAt).getTime() > weekAgo);
  const canTest = packs.some((p) => p.quiz || p.drill);
  const now = new Date();
  const hour = now.getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const upcoming = packs
    .filter((p) => nextDue(p))
    .sort((a, b) => nextDue(a)!.getTime() - nextDue(b)!.getTime())
    .slice(0, 3);
  const { habits } = checklistFor(mistakes);
  // "Watch the idea, then teach it back."
  const undone = plan.filter((s) => !s.done);
  const sub =
    undone.length > 1 && undone[1].label !== undone[0].label
      ? `${undone[0].label}, then ${undone[1].label.charAt(0).toLowerCase()}${undone[1].label.slice(1)}.`
      : undone.length >= 1
        ? `${undone[0].label}.`
        : "";
  const longTitle = (nextStep?.packTitle.length ?? 0) > 24;

  return (
    <div className="flex flex-col gap-5 lg:min-h-[calc(100dvh-4rem)]">
      <header>
        <p className="text-sm font-bold uppercase tracking-wider text-soft">{now.toLocaleDateString(undefined, { weekday: "long" })}</p>
        <h1 className="text-[30px] font-black leading-tight lg:text-[38px]">
          {hello}
          {settings.childDisplayName ? `, ${settings.childDisplayName}` : ""}
        </h1>
        {minutes > 0 && <p className="mt-1 font-semibold text-soft">You practiced for {minutes} minute{minutes === 1 ? "" : "s"} today. That’s steady work.</p>}
      </header>

      {!settings.childDisplayName && <NameCard />}

      {packs.length === 0 ? (
        <div className="mx-auto w-full max-w-xl">
          <EmptyState icon={Camera} title="No lessons yet">
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
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-6 lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            {/* Start card */}
            <section className="relative flex flex-col gap-3.5 overflow-hidden rounded-[32px] bg-sage p-[22px] text-white lg:flex-1 lg:justify-end lg:rounded-[36px] lg:p-8">
              <HeroArt />
              {nextStep ? (
                <>
                  <p className="text-[13px] font-extrabold uppercase tracking-wider text-sage-light lg:text-[15px]">Today · about {left} minutes</p>
                  <h2 className={`max-w-[210px] font-black leading-[1.12] lg:max-w-[310px] lg:leading-[1.08] ${longTitle ? "text-[22px] lg:text-[30px]" : "text-[26px] lg:text-[42px]"}`}>{nextStep.packTitle}</h2>
                  <p className="max-w-[230px] text-base font-semibold text-[#EEF6F3] lg:max-w-[310px] lg:text-[19px]">{sub}</p>
                  <div className="flex gap-1.5 lg:max-w-[310px]" aria-hidden>
                    {plan.map((s) => (
                      <span key={s.key} className={`h-1.5 flex-1 rounded-full ${s.done ? "bg-white" : "bg-[#6FA498]"}`} />
                    ))}
                  </div>
                  <Link
                    href={nextStep.href}
                    className="mt-1 flex h-[60px] items-center justify-center gap-2.5 rounded-[20px] bg-white text-[19px] font-black text-ink lg:h-[68px] lg:self-start lg:rounded-3xl lg:px-9 lg:text-[21px]"
                  >
                    <Play size={20} fill="#3E7F70" stroke="#3E7F70" />
                    {doneCount > 0 ? "Keep going" : "Start 15 minutes"}
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-[13px] font-extrabold uppercase tracking-wider text-sage-light lg:text-[15px]">Today</p>
                  <h2 className="max-w-[230px] text-[26px] font-black leading-[1.12] lg:max-w-[420px] lg:text-[40px]">{plan.length ? "Today’s plan is done" : "Nothing is due today"}</h2>
                  <p className="max-w-[240px] text-base font-semibold text-[#EEF6F3] lg:max-w-[380px] lg:text-[19px]">{plan.length ? "Nice, steady work. You can still practice anything you like." : "You can still practice anything you like."}</p>
                  <Link href="/practice" className="mt-1 flex h-[60px] items-center justify-center rounded-[20px] bg-white text-[19px] font-black text-ink lg:self-start lg:px-9">
                    Choose a lesson
                  </Link>
                </>
              )}
            </section>

            {plan.length > 0 && (
              <section aria-label="Today’s path" className="flex flex-col gap-2.5">
                <h2 className="text-[17px] font-black lg:text-lg">Today’s path</h2>
                <div className="grid gap-2 lg:grid-cols-4 lg:gap-3">
                  {plan.map((s) => (
                    <PathStep key={s.key} s={s} next={s === nextStep} />
                  ))}
                </div>
              </section>
            )}

            {canTest && !testedThisWeek && (
              <Link href="/test" className="flex min-h-[64px] items-center gap-3.5 rounded-[22px] border-2 border-line bg-white px-3.5 py-2 lg:hidden">
                <IconTile icon={ClipboardCheck} tone="gold" />
                <span className="flex-1">
                  <span className="block text-[17px] font-extrabold leading-tight">This week’s practice test</span>
                  <span className="block text-sm font-semibold text-soft">Easy ones first, then check with your checklist.</span>
                </span>
              </Link>
            )}
          </div>

          {/* Right column: only where there is room for it */}
          <aside className="hidden w-[296px] shrink-0 flex-col gap-5 lg:flex">
            <section className="card flex flex-col gap-3">
              <h2 className="text-lg font-black">Coming back soon</h2>
              {upcoming.length === 0 && <p className="text-sm font-semibold text-soft">All reviews are done for now.</p>}
              {upcoming.map((p) => (
                <Link key={p.id} href={`/pack?id=${p.id}`} className="flex items-center gap-3">
                  <span className={`h-3 w-3 shrink-0 rounded-full ${isDue(p) ? "bg-gold" : "bg-sage-light"}`} aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-base font-extrabold leading-tight">{p.title}</span>
                    <span className="block text-sm font-semibold text-soft">Review {isDue(p) ? "due today" : friendlyDay(nextDue(p)!)}</span>
                  </span>
                </Link>
              ))}
              {canTest && !testedThisWeek && (
                <Link href="/test" className="mt-1 flex min-h-[52px] items-center gap-3 rounded-2xl bg-gold-light px-3 text-[15px] font-extrabold">
                  <ClipboardCheck size={22} className="text-gold-deep" /> This week’s practice test
                </Link>
              )}
            </section>
            <section className="card flex flex-1 flex-col gap-3">
              <h2 className="text-lg font-black">My checklist</h2>
              <p className="text-sm font-semibold text-soft">Three things to look for before handing anything in.</p>
              <ul className="flex flex-col gap-2">
                {habits.map((h) => (
                  <li key={h.id} className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-cream px-3 py-1.5">
                    <IconView iconId={h.icon_id} emoji={h.emoji} label={h.label} size={24} className="shrink-0" />
                    <span className="text-[15px] font-extrabold leading-tight">{h.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
