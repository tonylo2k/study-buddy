import { isDue, isSameDay } from "./schedule";
import type { Attempt, LessonPack } from "./types";

export type ActivityKind = "watch" | "teach" | "cards" | "quiz" | "drill";

export interface PlanStep {
  key: string;
  packId: string;
  packTitle: string;
  kind: ActivityKind;
  label: string;
  minutes: number;
  emoji: string;
  done: boolean;
  href: string;
}

const ATTEMPT_TYPE: Record<ActivityKind, Attempt["type"]> = {
  watch: "visual_explainer",
  teach: "teachback",
  cards: "flashcard",
  quiz: "quiz",
  drill: "drill",
};
export const ACTIVITY_META: Record<ActivityKind, { label: string; minutes: number; emoji: string }> = {
  watch: { label: "Watch the idea", minutes: 2, emoji: "🎬" },
  teach: { label: "Teach it back", minutes: 3, emoji: "🧑‍🏫" },
  cards: { label: "Flashcards", minutes: 3, emoji: "🃏" },
  quiz: { label: "Quick quiz", minutes: 4, emoji: "✏️" },
  drill: { label: "Speed practice", minutes: 5, emoji: "⚡" },
};

export function hasActivity(pack: LessonPack, kind: ActivityKind): boolean {
  if (kind === "watch") return pack.visualExplainers.length > 0;
  if (kind === "teach") return Boolean(pack.teachBack);
  if (kind === "cards") return Boolean(pack.flashcards?.cards.length);
  if (kind === "quiz") return Boolean(pack.quiz?.questions.length);
  return Boolean(pack.drill?.items.length);
}

export const activityHref = (packId: string, kind: ActivityKind) => `/activity?id=${encodeURIComponent(packId)}&do=${kind}`;

/**
 * Today's suggested 15–20 minutes:
 *   new lessons  → watch the idea, then teach it back
 *   due reviews  → flashcards, then the 5-question quiz
 *   plus one     → speed practice
 */
export function buildPlan(packs: LessonPack[], attempts: Attempt[], now = new Date()): PlanStep[] {
  const today = attempts.filter((a) => isSameDay(new Date(a.startedAt), now));
  const doneToday = (packId: string, kind: ActivityKind) => today.some((a) => a.packId === packId && a.type === ATTEMPT_TYPE[kind]);
  const everDone = (packId: string, kind: ActivityKind) => attempts.some((a) => a.packId === packId && a.type === ATTEMPT_TYPE[kind]);

  const steps: PlanStep[] = [];
  const add = (pack: LessonPack, kind: ActivityKind) => {
    if (!hasActivity(pack, kind)) return;
    if (steps.some((s) => s.packId === pack.id && s.kind === kind)) return;
    const meta = ACTIVITY_META[kind];
    steps.push({
      key: `${pack.id}:${kind}`,
      packId: pack.id,
      packTitle: pack.title,
      kind,
      ...meta,
      done: doneToday(pack.id, kind),
      href: activityHref(pack.id, kind),
    });
  };

  const oldestFirst = [...packs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const due = oldestFirst.filter((p) => isDue(p, now));
  // "New" = she has not watched or taught it back yet (or did so only today).
  const fresh = oldestFirst.filter(
    (p) =>
      (hasActivity(p, "watch") && (!everDone(p.id, "watch") || doneToday(p.id, "watch"))) ||
      (hasActivity(p, "teach") && (!everDone(p.id, "teach") || doneToday(p.id, "teach"))),
  );

  for (const p of due.slice(0, 2)) {
    add(p, "cards");
    add(p, "quiz");
  }
  for (const p of fresh.slice(0, due.length ? 1 : 2)) {
    add(p, "watch");
    add(p, "teach");
  }
  const drillPack = [...due, ...fresh, ...[...packs]].find((p) => hasActivity(p, "drill"));
  if (drillPack) add(drillPack, "drill");

  // Keep it to roughly 20 minutes.
  let total = 0;
  return steps.filter((s) => {
    total += s.minutes;
    return total <= 22 || s.done;
  });
}

export function minutesPracticedToday(attempts: Attempt[], now = new Date()): number {
  let ms = 0;
  for (const a of attempts) {
    if (!isSameDay(new Date(a.startedAt), now)) continue;
    ms += Math.max(0, Math.min(30 * 60000, new Date(a.endedAt).getTime() - new Date(a.startedAt).getTime()));
  }
  return Math.round(ms / 60000);
}
