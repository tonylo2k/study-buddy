"use client";
import { Loading, PageHeader } from "@/components/ui";
import { useMistakes } from "@/lib/db";
import { IconView } from "@/lib/icons";
import { checklistFor, TAXONOMY, type Habit } from "@/lib/taxonomy";

function HabitRow({ h, big = false }: { h: Habit; big?: boolean }) {
  return (
    <li className={`flex items-center gap-3.5 border bg-white ${big ? "rounded-[28px] border-2 border-sage p-4 lg:flex-col lg:items-start lg:gap-4 lg:p-6" : "rounded-[20px] border-line p-3"}`}>
      <span className={`flex shrink-0 items-center justify-center ${big ? "h-14 w-14 rounded-[18px] bg-sage-light lg:h-20 lg:w-20 lg:rounded-3xl" : "h-11 w-11 rounded-2xl bg-cream"}`}>
        <IconView iconId={h.icon_id} emoji={h.emoji} label={h.label} size={big ? 34 : 24} />
      </span>
      <span>
        <span className={`block leading-tight ${big ? "text-lg font-black lg:text-[22px]" : "text-[15px] font-extrabold"}`}>{h.label}</span>
        {big && <span className="mt-0.5 block text-[15px] font-semibold text-soft lg:mt-1.5 lg:text-[17px]">{h.tip}</span>}
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
        <h2 className="text-lg font-black">{personalCount ? "My top habits to check" : "A starter checklist"}</h2>
        <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-3 lg:gap-4">
          {habits.map((h) => (
            <HabitRow key={h.id} h={h} big />
          ))}
        </ul>
        {personalCount < 3 && <p className="text-sm font-semibold text-soft">When you tag what happened on a missed question, this list becomes more and more your own.</p>}
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-black">All the habits</h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3">
          {TAXONOMY.map((h) => (
            <HabitRow key={h.id} h={h} />
          ))}
        </ul>
      </section>
    </div>
  );
}
