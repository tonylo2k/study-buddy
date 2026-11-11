"use client";
import Link from "next/link";
import { BookOpen, Calculator, Camera, ClipboardCheck, FlaskConical, Map as MapIcon, type LucideIcon } from "lucide-react";
import { EmptyState, IconTile, Loading, PageHeader } from "@/components/ui";
import { usePacks } from "@/lib/db";
import { friendlyDay, isDue, nextDue } from "@/lib/schedule";
import { SUBJECT_LABEL } from "@/lib/types";

const SUBJECT_ICON: Record<string, LucideIcon> = { math: Calculator, social_studies: MapIcon, science: FlaskConical, reading: BookOpen, other: BookOpen };
const SUBJECT_TONE: Record<string, "gold" | "sky" | "sage" | "sand"> = { math: "gold", social_studies: "sky", science: "sage", reading: "sand", other: "sand" };

export default function PracticePage() {
  const packs = usePacks();
  if (!packs) return <Loading />;
  return (
    <div className="space-y-4">
      <PageHeader title="Lessons" sub="Pick a lesson, or take this week’s practice test." />
      <div className="grid grid-cols-2 gap-3 lg:max-w-xl">
        <Link href="/snap" className="btn-secondary">
          <Camera size={20} /> Snap a lesson
        </Link>
        <Link href="/test" className="btn-secondary">
          <ClipboardCheck size={20} /> Practice test
        </Link>
      </div>
      {packs.length === 0 ? (
        <EmptyState icon={BookOpen} title="No lessons yet">
          <p>Lessons appear here after you snap a page.</p>
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {packs.map((p) => {
            const due = nextDue(p);
            return (
              <li key={p.id}>
                <Link href={`/pack?id=${p.id}`} className="card flex items-center gap-3">
                  <IconTile icon={SUBJECT_ICON[p.subject] ?? BookOpen} size={56} tone={SUBJECT_TONE[p.subject] ?? "sand"} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-extrabold leading-snug">{p.title}</span>
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
