import { parseInlineChoices, shuffle } from "./answers";
import type { LessonPack, PracticeTest, PracticeTestItem } from "./types";

const KEYWORDS = ["not", "which two", "except", "greater", "smaller", "least", "most", "units"];

function hintsFor(prompt: string): string[] {
  const p = prompt.toLowerCase();
  return KEYWORDS.filter((k) => new RegExp(`\\b${k}\\b`).test(p));
}

/** Lessons from the last two weeks (or, if there are none, the most recent few). */
export function recentPacks(packs: LessonPack[], now = Date.now()): LessonPack[] {
  const cutoff = now - 14 * 86400000;
  const recent = packs.filter((p) => new Date(p.createdAt).getTime() >= cutoff);
  return (recent.length ? recent : packs).slice(0, 6);
}

/** What we send to the model: compact summaries, never photos. */
export function packSummaries(packs: LessonPack[]) {
  return packs.map((p) => ({
    title: p.title,
    subject: p.subject,
    key_points: p.extract.key_points,
    vocabulary: p.extract.vocabulary,
    worked_examples: p.extract.worked_examples,
    quiz_seeds: (p.quiz?.questions ?? [])
      .filter((q) => q.type === "mcq" || q.type === "short" || q.type === "numeric")
      .map((q) => ({ prompt: q.prompt, type: q.type, choices: q.choices, answer: q.answer })),
  }));
}

/**
 * Works with no network and no API key: assembles a test from questions already saved
 * in the packs. Used as a fallback, and by the sample packs.
 */
export function buildLocalPracticeTest(packs: LessonPack[]): PracticeTest | null {
  const items: Omit<PracticeTestItem, "id">[] = [];
  for (const p of packs) {
    for (const q of p.quiz?.questions ?? []) {
      if (q.type !== "mcq" && q.type !== "short" && q.type !== "numeric") continue;
      // Long free-text answers cannot be marked fairly without the model, so leave them out here.
      if (q.type === "short" && (q.answer ?? "").trim().split(/\s+/).length > 3) continue;
      items.push({ prompt: q.prompt, type: q.type, choices: q.choices ?? [], answer: q.answer ?? "", difficulty: "medium", keyword_hints: hintsFor(q.prompt) });
    }
    const drill = shuffle(p.drill?.items ?? []).slice(0, 5);
    for (const d of drill) {
      const inline = d.type === "mcq" ? parseInlineChoices(d.prompt) : null;
      if (inline) {
        const right = inline.options.find((o) => o.key === d.answer);
        if (!right) continue;
        items.push({ prompt: inline.stem, type: "mcq", choices: inline.options.map((o) => o.text), answer: right.text, difficulty: "easy", keyword_hints: hintsFor(inline.stem) });
      } else {
        items.push({ prompt: d.prompt, type: d.type === "numeric" ? "numeric" : "short", choices: [], answer: d.answer, difficulty: "easy", keyword_hints: hintsFor(d.prompt) });
      }
    }
  }
  if (items.length < 4) return null;
  const picked = shuffle(items).slice(0, 12);
  return {
    title: "This Week’s Practice Test",
    duration_minutes: 20,
    check_minutes: 3,
    items: picked.map((it, i) => ({ ...it, id: `t${i + 1}` })),
  };
}
