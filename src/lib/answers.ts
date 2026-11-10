// Lenient answer matching for short / numeric / multiple-choice items.

export function norm(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[“”"‘’'.,!?;:()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function asNumber(s: string): number | null {
  const t = String(s ?? "").replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

export function isCorrect(expected: string, given: string): boolean {
  const g = norm(given);
  if (!g) return false;
  const e = norm(expected);
  if (g === e) return true;
  const en = asNumber(expected);
  const gn = asNumber(given);
  if (en !== null && gn !== null) return en === gn;
  // "two-sixths" vs "two sixths"
  if (g.replace(/-/g, " ") === e.replace(/-/g, " ")) return true;
  return false;
}

/** Drill mcq items carry their choices inline: "Stem? (A) one (B) two". */
export function parseInlineChoices(prompt: string): { stem: string; options: { key: string; text: string }[] } | null {
  const re = /\(([A-F])\)\s*([^()]+?)(?=\s*\([A-F]\)|$)/g;
  const options: { key: string; text: string }[] = [];
  let m: RegExpExecArray | null;
  let first = -1;
  while ((m = re.exec(prompt))) {
    if (first < 0) first = m.index;
    options.push({ key: m[1], text: m[2].trim() });
  }
  if (options.length < 2) return null;
  return { stem: prompt.slice(0, first).trim(), options };
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
