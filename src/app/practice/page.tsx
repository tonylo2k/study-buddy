"use client";
import Link from "next/link";
import { EmptyState, Loading, PageHeader } from "@/components/ui";
import { usePacks } from "@/lib/db";
import { friendlyDay, isDue, nextDue } from "@/lib/schedule";
import { SUBJECT_LABEL } from "@/lib/types";

const SUBJECT_EMOJI: Record<string, string> = { math: "➗", social_studies: "🗺️", science: "🔬", reading: "📖", other: "📚" };

export default function PracticePage() {
  const packs = usePacks();
  if (!packs) return <Loading />;
  return (
    <div className="space-y-4">
      <PageHeader title="Practice" sub="Pick a lesson, or take this week’s practice test." />
      <div className="grid grid-cols-2 gap-3">
        <Link href="/snap" className="btn-secondary">
          📷 Snap a lesson
        </Link>
        <Link href="/test" className="btn-secondary">
          📝 Practice test
        </Link>
      </div>
      {packs.length === 0 ? (
        <EmptyState emoji="📚" title="No lessons yet">
          <p>Lessons appear here after you snap a page.</p>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {packs.map((p) => {
            const due = nextDue(p);
            return (
              <li key={p.id}>
                <Link href={`/pack?id=${p.id}`} className="card flex items-center gap-3">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cream text-3xl" aria-hidden>
                    {SUBJECT_EMOJI[p.subject] ?? "📚"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold leading-snug">{p.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-soft">
                      <span className="chip">{SUBJECT_LABEL[p.subject]}</span>
                      {isDue(p) ? <span className="chip !bg-gold-light !text-ink">Review due</span> : due ? <span>Review {friendlyDay(due)}</span> : <span>All reviews done</span>}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
