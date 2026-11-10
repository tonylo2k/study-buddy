// Hand-rolled validators for model output (PRD §9). Each one throws with a short reason
// (which is sent back to the model on the single retry) or returns a cleaned object.
// Unknown icon_id values are allowed through on purpose: the client renders them safely.
import type {
  Drill,
  Extract,
  FlashcardSet,
  PracticeTest,
  Quiz,
  QuizQuestion,
  Subject,
  TeachBack,
  TeachBackFeedback,
  VisualExplainer,
} from "../types";

const SUBJECTS = ["math", "social_studies", "science", "reading", "other"];
const HABIT_IDS = [
  "copy_number",
  "misread_question",
  "sign_error",
  "unit_error",
  "calculation",
  "keyword_miss",
  "rushed_guess",
  "other",
];

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown, fallback = ""): string =>
  typeof x === "string" ? x : typeof x === "number" ? String(x) : fallback;
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const strs = (x: unknown): string[] => arr(x).map((v) => str(v)).filter(Boolean);
const num = (x: unknown, fallback: number): number => (typeof x === "number" && isFinite(x) ? x : fallback);
function need(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export function validateExtract(raw: unknown): Extract {
  need(isObj(raw), "expected an object");
  const key_points = strs(raw.key_points);
  need(key_points.length >= 1, "key_points must have at least 1 item");
  const subject = (SUBJECTS.includes(str(raw.subject)) ? str(raw.subject) : "other") as Subject;
  return {
    subject,
    grade_hint: str(raw.grade_hint, "Grade 4"),
    title: str(raw.title, "Untitled lesson"),
    language: str(raw.language, "en"),
    key_points,
    vocabulary: arr(raw.vocabulary)
      .filter(isObj)
      .map((v) => ({ term: str(v.term), definition: str(v.definition) }))
      .filter((v) => v.term),
    worked_examples: arr(raw.worked_examples)
      .filter(isObj)
      .map((w) => ({ problem: str(w.problem), solution_steps: strs(w.solution_steps), answer: str(w.answer) }))
      .filter((w) => w.problem),
    practice_seeds: strs(raw.practice_seeds),
    raw_ocr_text: str(raw.raw_ocr_text),
    warnings: strs(raw.warnings),
  };
}

function picture(v: Obj, i: number) {
  return {
    id: str(v.id, `p${i + 1}`),
    icon_id: str(v.icon_id) || undefined,
    emoji: str(v.emoji) || undefined,
    caption: str(v.caption) || undefined,
  };
}

function diagram(d: unknown) {
  if (!isObj(d)) return null;
  if (d.type === "fraction_bar") {
    return {
      type: "fraction_bar" as const,
      id: str(d.id) || undefined,
      parts: Math.max(1, Math.round(num(d.parts, 1))),
      shaded: Math.max(0, Math.round(num(d.shaded, 0))),
      label: str(d.label) || undefined,
    };
  }
  if (d.type === "number_line") {
    return {
      type: "number_line" as const,
      id: str(d.id) || undefined,
      min: num(d.min, 0),
      max: num(d.max, 1),
      marks: strs(d.marks),
      highlight: str(d.highlight) || undefined,
      label: str(d.label) || undefined,
    };
  }
  return null;
}

export function validateFlashcards(raw: unknown): FlashcardSet {
  need(isObj(raw), "expected an object");
  const cards = arr(raw.cards)
    .filter(isObj)
    .map((c, i) => {
      const v = isObj(c.visual) ? c.visual : null;
      return {
        id: str(c.id, `c${i + 1}`),
        front: str(c.front),
        back: str(c.back),
        tags: strs(c.tags),
        visual: v
          ? {
              icon_id: str(v.icon_id) || undefined,
              emoji: str(v.emoji) || undefined,
              caption: str(v.caption) || undefined,
              diagram: diagram(v.diagram),
            }
          : undefined,
      };
    })
    .filter((c) => c.front && c.back);
  need(cards.length >= 8, "need 8–12 cards");
  need(cards.every((c) => c.visual), "every card needs a visual");
  return { cards: cards.slice(0, 12) };
}

export function validateQuiz(raw: unknown): Quiz {
  need(isObj(raw), "expected an object");
  const questions: QuizQuestion[] = arr(raw.questions)
    .filter(isObj)
    .map((q, i) => {
      const type = str(q.type) as QuizQuestion["type"];
      need(["mcq", "short", "numeric", "pick_picture", "drag_match"].includes(type), `question ${i + 1}: unknown type`);
      const out: QuizQuestion = {
        id: str(q.id, `q${i + 1}`),
        type,
        prompt: str(q.prompt),
        choices: strs(q.choices),
        answer: str(q.answer),
        explanation: str(q.explanation),
        skill_tags: strs(q.skill_tags),
      };
      need(out.prompt, `question ${i + 1}: missing prompt`);
      if (type === "mcq") {
        need(out.choices!.length >= 2, `question ${i + 1}: mcq needs choices`);
        need(out.choices!.includes(out.answer!), `question ${i + 1}: answer must match one choice exactly`);
      } else if (type === "short" || type === "numeric") {
        need(out.answer, `question ${i + 1}: missing answer`);
      } else if (type === "pick_picture") {
        out.picture_choices = arr(q.picture_choices).filter(isObj).map(picture);
        out.diagrams = arr(q.diagrams).map(diagram).filter((d): d is NonNullable<ReturnType<typeof diagram>> => !!d);
        need(out.picture_choices.length >= 2, `question ${i + 1}: pick_picture needs picture_choices`);
        need(
          out.picture_choices.some((p) => p.id === out.answer),
          `question ${i + 1}: answer must be a picture choice id`,
        );
      } else {
        out.match_left = arr(q.match_left).filter(isObj).map(picture);
        out.match_right = arr(q.match_right)
          .filter(isObj)
          .map((r, j) => ({ id: str(r.id, `r${j + 1}`), label: str(r.label) }));
        const map = isObj(q.answer_map) ? q.answer_map : {};
        out.answer_map = Object.fromEntries(Object.entries(map).map(([k, v]) => [k, str(v)]));
        need(out.match_left.length >= 2 && out.match_right.length >= 2, `question ${i + 1}: drag_match needs both sides`);
        need(
          out.match_left.every((l) => out.match_right!.some((r) => r.id === out.answer_map![l.id])),
          `question ${i + 1}: answer_map must cover every match_left id`,
        );
      }
      return out;
    });
  need(questions.length === 5, "need exactly 5 questions");
  return { questions };
}

export function validateTeachBack(raw: unknown): TeachBack {
  need(isObj(raw), "expected an object");
  const out: TeachBack = {
    prompt_for_child: str(raw.prompt_for_child),
    must_cover: strs(raw.must_cover),
    example_good_answer: str(raw.example_good_answer),
    visual_prompt: null,
  };
  need(out.prompt_for_child, "missing prompt_for_child");
  need(out.must_cover.length >= 1, "must_cover needs 2–4 ideas");
  if (isObj(raw.visual_prompt)) {
    const vp = raw.visual_prompt;
    const slots = arr(vp.slots)
      .filter(isObj)
      .map((s, i) => ({ id: str(s.id, `s${i + 1}`), label: str(s.label) }));
    const tokens = arr(vp.tokens)
      .filter(isObj)
      .map((t, i) => ({ ...picture(t, i), id: str(t.id, `t${i + 1}`), correct_slot: str(t.correct_slot) || undefined }));
    if (tokens.length >= 2) {
      out.visual_prompt = {
        instruction: str(vp.instruction, "Sort the pictures."),
        mode: vp.mode === "stamp" ? "stamp" : "arrange",
        tokens,
        slots,
      };
    }
  }
  return out;
}

export function validateFeedback(raw: unknown): TeachBackFeedback {
  need(isObj(raw), "expected an object");
  const band = str(raw.score_band);
  const out: TeachBackFeedback = {
    covered: strs(raw.covered),
    missing: strs(raw.missing),
    encouragement: str(raw.encouragement),
    score_band: band === "great" || band === "good" ? band : "keep_trying",
  };
  need(out.encouragement, "missing encouragement");
  return out;
}

export function validateDrill(raw: unknown): Drill {
  need(isObj(raw), "expected an object");
  const items = arr(raw.items)
    .filter(isObj)
    .map((d, i) => {
      const t = str(d.type);
      return {
        id: str(d.id, `d${i + 1}`),
        prompt: str(d.prompt),
        answer: str(d.answer),
        type: (t === "numeric" || t === "mcq" ? t : "short") as "numeric" | "short" | "mcq",
      };
    })
    .filter((d) => d.prompt && d.answer);
  need(items.length >= 20, "need 20–40 drill items");
  return { duration_seconds: 300, items: items.slice(0, 40) };
}

export function validatePracticeTest(raw: unknown): PracticeTest {
  need(isObj(raw), "expected an object");
  const items = arr(raw.items)
    .filter(isObj)
    .map((t, i) => {
      const type = str(t.type);
      const diff = str(t.difficulty);
      return {
        id: str(t.id, `t${i + 1}`),
        prompt: str(t.prompt),
        type: (type === "mcq" || type === "numeric" ? type : "short") as "mcq" | "short" | "numeric",
        choices: strs(t.choices),
        answer: str(t.answer),
        difficulty: (diff === "easy" || diff === "hard" ? diff : "medium") as "easy" | "medium" | "hard",
        keyword_hints: strs(t.keyword_hints),
      };
    })
    .filter((t) => t.prompt && t.answer && (t.type !== "mcq" || t.choices.includes(t.answer)));
  need(items.length >= 8, "need 10–15 items");
  return {
    title: str(raw.title, "This Week’s Practice Test"),
    duration_minutes: Math.min(30, Math.max(10, num(raw.duration_minutes, 20))),
    check_minutes: Math.min(5, Math.max(2, num(raw.check_minutes, 3))),
    items: items.slice(0, 15),
  };
}

export function validateExplainer(e: unknown, index = 0): VisualExplainer {
  need(isObj(e), "explainer must be an object");
  const scenes = arr(e.scenes)
    .filter(isObj)
    .map((s, si) => {
      const elements = arr(s.elements)
        .filter(isObj)
        .map((el, ei) => ({
          id: str(el.id, `s${si + 1}_e${ei + 1}`),
          kind: str(el.kind, "label"),
          icon_id: str(el.icon_id) || null,
          emoji: str(el.emoji) || null,
          shape: str(el.shape) || null,
          label: str(el.label) || null,
          slot: str(el.slot) || null,
          order: typeof el.order === "number" ? el.order : null,
          parts: typeof el.parts === "number" ? el.parts : null,
          shaded: typeof el.shaded === "number" ? el.shaded : null,
          color: str(el.color) || null,
        }));
      const steps = arr(s.steps)
        .filter(isObj)
        .map((st) => ({
          at_ms: Math.max(0, num(st.at_ms, 0)),
          action: str(st.action, "show"),
          targets: strs(st.targets),
          with: typeof st.with === "string" ? st.with : Array.isArray(st.with) ? strs(st.with) : null,
          motion: str(st.motion, "fade"),
        }));
      need(elements.length >= 1, `scene ${si + 1} has no elements`);
      return {
        id: str(s.id, `s${si + 1}`),
        title: str(s.title),
        // Keep each scene between 4s and 20s so nothing rushes or drags.
        duration_ms: Math.min(20000, Math.max(4000, num(s.duration_ms, 10000))),
        caption: str(s.caption),
        layout: str(s.layout, "single"),
        elements,
        steps,
      };
    });
  need(scenes.length >= 2, "an explainer needs at least 2 scenes");
  const total = scenes.reduce((a, s) => a + s.duration_ms, 0);
  need(total >= 15000 && total <= 75000, "total duration should be 20–60 seconds");
  return {
    explainer_id: str(e.explainer_id, `ve_${index + 1}`),
    concept: str(e.concept),
    key_point_ref: typeof e.key_point_ref === "number" ? e.key_point_ref : index,
    format: str(e.format, "diagram"),
    duration_seconds: Math.round(total / 1000),
    title: str(e.title, str(e.concept, "Watch the idea")),
    scenes,
    narration_captions: arr(e.narration_captions)
      .filter(isObj)
      .map((n) => ({ scene_id: str(n.scene_id), text: str(n.text) }))
      .filter((n) => n.scene_id && n.text),
  };
}

export function validateExplainers(raw: unknown): VisualExplainer[] {
  need(isObj(raw), "expected an object");
  const list = arr(raw.explainers).map((e, i) => validateExplainer(e, i));
  need(list.length >= 1, "need at least 1 explainer");
  return list.slice(0, 5);
}

export function validateClassification(raw: unknown): { suggested_id: string; alternatives: string[]; reason: string } {
  need(isObj(raw), "expected an object");
  const id = str(raw.suggested_id);
  return {
    suggested_id: HABIT_IDS.includes(id) ? id : "other",
    alternatives: strs(raw.alternatives).filter((a) => HABIT_IDS.includes(a)),
    reason: str(raw.reason),
  };
}
