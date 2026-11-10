import type { Mistake } from "./types";

// PRD §11. Labels are the only words the child ever sees for a mistake type.
export interface Habit {
  id: string;
  label: string;
  icon_id: string;
  emoji: string;
  tip: string; // what to do in checking mode
}

export const TAXONOMY: Habit[] = [
  { id: "copy_number", label: "Copied the number wrong", icon_id: "copy", emoji: "🔢", tip: "Match each number to the question." },
  { id: "misread_question", label: "Didn’t read the whole question", icon_id: "eye", emoji: "👀", tip: "Read the question once more, to the end." },
  { id: "sign_error", label: "+ - x ÷ mix-up", icon_id: "plus_minus", emoji: "➕", tip: "Point to each sign and say it." },
  { id: "unit_error", label: "Wrong units", icon_id: "ruler", emoji: "📏", tip: "Check the units in the answer." },
  { id: "calculation", label: "Calculation slip", icon_id: "pencil", emoji: "✏️", tip: "Redo one step a different way." },
  { id: "keyword_miss", label: "Missed a keyword (not / which two)", icon_id: "highlight", emoji: "🔖", tip: "Underline words like “not” and “which two.”" },
  { id: "rushed_guess", label: "Rushed guess", icon_id: "clock", emoji: "⏰", tip: "Take one slow breath, then look again." },
  { id: "other", label: "Other", icon_id: "question", emoji: "❓", tip: "Look it over once more." },
];

export const HABIT_BY_ID: Record<string, Habit> = Object.fromEntries(TAXONOMY.map((h) => [h.id, h]));

const DAY = 24 * 60 * 60 * 1000;

export function mistakeCounts(mistakes: Mistake[], sinceMs?: number): { habit: Habit; count: number }[] {
  const counts = new Map<string, number>();
  for (const m of mistakes) {
    if (sinceMs && new Date(m.createdAt).getTime() < sinceMs) continue;
    counts.set(m.taxonomyId, (counts.get(m.taxonomyId) ?? 0) + 1);
  }
  return TAXONOMY.map((habit) => ({ habit, count: counts.get(habit.id) ?? 0 })).sort((a, b) => b.count - a.count);
}

/** Top 3 habits by count over the last 30 days, each needing at least 2 occurrences (PRD §11). */
export function topHabits(mistakes: Mistake[], now = Date.now()): { habit: Habit; count: number }[] {
  return mistakeCounts(mistakes, now - 30 * DAY)
    .filter((x) => x.count >= 2 && x.habit.id !== "other")
    .slice(0, 3);
}

/** Shown in checking mode before she has a personal list. */
export const STARTER_CHECKLIST: Habit[] = [HABIT_BY_ID.misread_question, HABIT_BY_ID.keyword_miss, HABIT_BY_ID.calculation];

/** The three things to check: her own top habits first, topped up from the starter list. */
export function checklistFor(mistakes: Mistake[], now = Date.now()): { habits: Habit[]; personalCount: number } {
  const mine = topHabits(mistakes, now).map((t) => t.habit);
  const fill = STARTER_CHECKLIST.filter((h) => !mine.some((m) => m.id === h.id));
  return { habits: [...mine, ...fill].slice(0, 3), personalCount: mine.length };
}
