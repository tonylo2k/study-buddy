import type { LessonPack, Review } from "./types";

// PRD §10: pack-level spaced reviews at D+1, D+3, D+7.
export const REVIEW_OFFSETS_DAYS = [1, 3, 7];
export const PASS_MARK = 0.8;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
export function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function newSchedule(createdAt: Date): Review[] {
  const day0 = startOfDay(createdAt);
  return REVIEW_OFFSETS_DAYS.map((n) => ({ dueAt: addDays(day0, n).toISOString(), status: "pending" as const }));
}

export function currentReviewIndex(schedule: Review[]): number {
  return schedule.findIndex((r) => r.status !== "done");
}

export function isDue(pack: LessonPack, now = new Date()): boolean {
  const i = currentReviewIndex(pack.schedule);
  if (i < 0) return false;
  return new Date(pack.schedule[i].dueAt).getTime() <= now.getTime();
}

export function nextDue(pack: LessonPack): Date | null {
  const i = currentReviewIndex(pack.schedule);
  return i < 0 ? null : new Date(pack.schedule[i].dueAt);
}

export type QuizOutcome = "practice" | "advanced" | "finished" | "repeat";

/**
 * 80% or higher on a due review: mark that interval done and move on.
 * Under 80%: stay on the same interval and try again tomorrow.
 * A quiz taken before the review is due is extra practice and does not move the schedule,
 * because the spacing is the point.
 */
export function applyQuizResult(
  schedule: Review[],
  fraction: number,
  now = new Date(),
): { schedule: Review[]; outcome: QuizOutcome } {
  const i = currentReviewIndex(schedule);
  if (i < 0) return { schedule, outcome: "practice" };
  if (new Date(schedule[i].dueAt).getTime() > now.getTime()) return { schedule, outcome: "practice" };

  const next = schedule.map((r) => ({ ...r }));
  const tomorrow = addDays(startOfDay(now), 1);
  if (fraction >= PASS_MARK) {
    next[i].status = "done";
    next[i].doneAt = now.toISOString();
    if (i + 1 < next.length) {
      // Never make the next review due the same day she just passed one.
      const planned = new Date(next[i + 1].dueAt);
      if (planned.getTime() < tomorrow.getTime()) next[i + 1].dueAt = tomorrow.toISOString();
      return { schedule: next, outcome: "advanced" };
    }
    return { schedule: next, outcome: "finished" };
  }
  next[i].status = "repeat";
  next[i].dueAt = tomorrow.toISOString();
  return { schedule: next, outcome: "repeat" };
}

export function friendlyDay(d: Date, now = new Date()): string {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "tomorrow";
  return `in ${diff} days`;
}
