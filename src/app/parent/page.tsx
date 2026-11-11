"use client";
import Link from "next/link";
import { useState } from "react";
import { Loading, PageHeader } from "@/components/ui";
import { db, deletePack, useAttempts, useMistakes, usePacks, usePracticeTests } from "@/lib/db";
import { IconView } from "@/lib/icons";
import { ACTIVITY_META, buildPlan, minutesPracticedToday } from "@/lib/plan";
import { loadSamplePacks } from "@/lib/samples";
import { currentReviewIndex, friendlyDay, isDue, nextDue, startOfDay } from "@/lib/schedule";
import { mistakeCounts } from "@/lib/taxonomy";
import { SUBJECT_LABEL, type Attempt } from "@/lib/types";

const TYPE_LABEL: Record<Attempt["type"], string> = {
  visual_explainer: "Watched an idea",
  teachback: "Teach-back",
  flashcard: "Flashcards",
  quiz: "Quick quiz",
  drill: "Speed practice",
  practice_test: "Practice test",
};

export default function ParentPage() {
  const packs = usePacks();
  const attempts = useAttempts();
  const mistakes = useMistakes();
  const tests = usePracticeTests();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [devNote, setDevNote] = useState<string | null>(null);

  if (!packs || !attempts || !mistakes || !tests) return <Loading />;

  const plan = buildPlan(packs, attempts);
  const due = packs.filter((p) => isDue(p));
  const counts = mistakeCounts(mistakes, Date.now() - 30 * 86400000);
  const max = Math.max(1, ...counts.map((c) => c.count));
  const totalMistakes = counts.reduce((a, c) => a + c.count, 0);
  const testAttempts = attempts.filter((a) => a.type === "practice_test");
  const titleOf = (id: string) => packs.find((p) => p.id === id)?.title ?? "";

  const makeDueNow = async () => {
    const today = startOfDay(new Date()).toISOString();
    for (const p of packs) {
      const i = currentReviewIndex(p.schedule);
      if (i < 0) continue;
      const schedule = p.schedule.map((r, n) => (n === i ? { ...r, dueAt: today } : r));
      await db.lessonPacks.update(p.id, { schedule });
    }
    setDevNote("Every lesson’s next review is now due today.");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Parent dashboard" sub="Everything here is stored on this device only." />

      <section className="card space-y-2">
        <h2 className="font-bold">Today</h2>
        <p className="text-sm text-soft">
          {due.length} review{due.length === 1 ? "" : "s"} due · {minutesPracticedToday(attempts)} min practiced today
        </p>
        {plan.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {plan.map((s) => (
              <li key={s.key} className="flex gap-2">
                <span aria-hidden>{s.done ? "✅" : "▫️"}</span>
                <span>
                  {s.label} <span className="text-soft">· {s.packTitle} · {s.minutes} min</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-soft">No plan yet. Add a lesson to get started.</p>
        )}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link href="/snap" className="btn-primary">
            Snap a lesson
          </Link>
          <Link href="/test?new=1" className="btn-secondary">
            Generate practice test
          </Link>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">Lesson packs</h2>
        {packs.length === 0 && <p className="text-sm text-soft">None yet.</p>}
        <ul className="space-y-2">
          {packs.map((p) => {
            const nd = nextDue(p);
            return (
              <li key={p.id} className="card !p-3">
                <div className="flex items-start gap-3">
                  {p.photoThumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photoThumbnail} alt="" className="h-12 w-12 rounded-xl object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <Link href={`/pack?id=${p.id}`} className="font-bold underline-offset-4 hover:underline">
                      {p.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-soft">
                      <span className="chip">{SUBJECT_LABEL[p.subject]}</span>
                      <span className={`chip ${p.visualExplainers.length ? "" : "!bg-gold-light !text-ink"}`}>
                        {p.visualExplainers.length ? `${p.visualExplainers.length} explainer${p.visualExplainers.length === 1 ? "" : "s"}` : "No explainers yet"}
                      </span>
                      <span className="self-center">
                        Added {new Date(p.createdAt).toLocaleDateString()} · {nd ? `review ${friendlyDay(nd)}` : "reviews done"}
                      </span>
                    </div>
                  </div>
                  {confirmDelete === p.id ? (
                    <div className="flex flex-col gap-1">
                      <button className="btn-quiet !min-h-0 !py-1 !text-ink" onClick={() => deletePack(p.id).then(() => setConfirmDelete(null))}>
                        Yes, delete
                      </button>
                      <button className="btn-quiet !min-h-0 !py-1" onClick={() => setConfirmDelete(null)}>
                        Keep
                      </button>
                    </div>
                  ) : (
                    <button className="btn-quiet !min-h-0 !py-1" onClick={() => setConfirmDelete(p.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">Mistake types (last 30 days)</h2>
        {totalMistakes === 0 ? (
          <p className="text-sm text-soft">Nothing tagged yet. Tags appear after she marks what happened on a missed question.</p>
        ) : (
          <ul className="space-y-2">
            {counts.map(({ habit, count }) => (
              <li key={habit.id} className="flex items-center gap-2">
                <IconView iconId={habit.icon_id} emoji={habit.emoji} label={habit.label} size={22} className="shrink-0" />
                <span className="w-40 shrink-0 text-xs font-semibold leading-tight">{habit.label}</span>
                <span className="h-4 flex-1 overflow-hidden rounded-full bg-cream">
                  <span className="block h-full rounded-full bg-sage/70" style={{ width: `${(count / max) * 100}%` }} />
                </span>
                <span className="w-6 text-right text-sm font-bold tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="font-bold">Practice tests</h2>
        {testAttempts.length === 0 ? (
          <p className="text-sm text-soft">No practice tests taken yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {testAttempts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold">{new Date(a.startedAt).toLocaleDateString()}</span>
                <span>{a.processFlags?.usedChecklist ? "✅ used checklist" : "▫️ checklist not used"}</span>
                <span>{a.processFlags?.finishedCheckPhase ? "✅ finished checking" : "▫️ checking cut short"}</span>
                <span className="text-soft">
                  {String(a.payload.score)} of {String(a.payload.total)} right
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="font-bold">Recent sessions</h2>
        {attempts.length === 0 ? (
          <p className="text-sm text-soft">No practice yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {attempts.slice(0, 10).map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">
                  {TYPE_LABEL[a.type]}
                  {a.packId && <span className="text-soft"> · {titleOf(a.packId)}</span>}
                  {a.type === "quiz" && <span className="text-soft"> · {String(a.payload.score)}/{String(a.payload.total)}</span>}
                  {a.type === "drill" && <span className="text-soft"> · {String(a.payload.score)} correct</span>}
                </span>
                <span className="shrink-0 text-soft">{new Date(a.startedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/parent/settings" className="btn-secondary w-full">
        Settings
      </Link>

      <section className="rounded-3xl border-2 border-dashed border-line p-4">
        <h2 className="font-bold">Developer tools</h2>
        <p className="text-sm text-soft">For trying the app without a photo or an API key.</p>
        <div className="mt-2 flex flex-col gap-2">
          <button
            className="btn-secondary"
            onClick={async () => {
              const ids = await loadSamplePacks();
              setDevNote(`Loaded ${ids.length} sample packs with the three visual explainers.`);
            }}
          >
            Load sample pack
          </button>
          <button className="btn-secondary" onClick={makeDueNow} disabled={packs.length === 0}>
            Make reviews due today (to test the schedule)
          </button>
          {devNote && (
            <p className="text-sm text-sage-dark" role="status">
              {devNote}
            </p>
          )}
        </div>
      </section>
      <p className="text-center text-xs text-soft">Suggested routine: {Object.values(ACTIVITY_META).map((m) => m.label).join(" → ")}</p>
    </div>
  );
}
