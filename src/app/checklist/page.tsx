"use client";
import { Loading, PageHeader } from "@/components/ui";
import { useMistakes } from "@/lib/db";
import { IconView } from "@/lib/icons";
import { checklistFor, TAXONOMY, type Habit } from "@/lib/taxonomy";

function HabitRow({ h, big = false }: { h: Habit; big?: boolean }) {
  return (
    <li className={`flex items-center gap-3 rounded-2xl border border-line bg-white ${big ? "p-4" : "p-3"}`}>
      <span className={`flex shrink-0 items-center justify-center rounded-2xl bg-cream ${big ? "h-14 w-14" : "h-11 w-11"}`}>
        <IconView iconId={h.icon_id} emoji={h.emoji} label={h.label} size={big ? 32 : 24} />
      </span>
      <span>
        <span className={`block font-bold ${big ? "text-lg" : ""}`}>{h.label}</span>
        {big && <span className="block text-sm text-soft">{h.tip}</span>}
      </span>
    </li>
  );
}

export default function ChecklistPage() {
  const mistakes = useMistakes();
  if (!mistakes) return <Loading />;
  const { habits, personalCount } = checklistFor(mistakes);
  return (
    <div className="space-y-5">
      <PageHeader title="My Careless Mistakes Checklist" sub="Three things to look for before you hand anything in." />
      <section className="space-y-2">
        <h2 className="font-bold">{personalCount ? "My top habits to check" : "A starter checklist"}</h2>
        <ul className="space-y-2">
          {habits.map((h) => (
            <HabitRow key={h.id} h={h} big />
          ))}
        </ul>
        {personalCount < 3 && <p className="text-sm text-soft">When you tag what happened on a missed question, this list becomes more and more your own.</p>}
      </section>
      <section className="space-y-2">
        <h2 className="font-bold">All the habits</h2>
        <ul className="grid gap-2">
          {TAXONOMY.map((h) => (
            <HabitRow key={h.id} h={h} />
          ))}
        </ul>
      </section>
    </div>
  );
}
