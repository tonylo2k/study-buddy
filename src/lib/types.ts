// Shared data shapes. These mirror PRD §9 and the files in sample-data/.

export type Subject = "math" | "social_studies" | "science" | "reading" | "other";
export const SUBJECTS: Subject[] = ["math", "social_studies", "science", "reading", "other"];
export const SUBJECT_LABEL: Record<Subject, string> = {
  math: "Math",
  social_studies: "Social Studies",
  science: "Science",
  reading: "Reading",
  other: "Other",
};

export interface Extract {
  subject: Subject;
  grade_hint: string;
  title: string;
  language: string;
  key_points: string[];
  vocabulary: { term: string; definition: string }[];
  worked_examples: { problem: string; solution_steps: string[]; answer: string }[];
  practice_seeds: string[];
  raw_ocr_text: string;
  warnings: string[];
}

export type Diagram =
  | { type: "fraction_bar"; id?: string; parts: number; shaded: number; label?: string }
  | {
      type: "number_line";
      id?: string;
      min?: number;
      max?: number;
      marks?: string[];
      highlight?: string;
      label?: string;
    };

export interface PictureRef {
  id: string;
  icon_id?: string;
  emoji?: string;
  caption?: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  tags: string[];
  visual?: { icon_id?: string; emoji?: string; caption?: string; diagram?: Diagram | null };
}
export interface FlashcardSet {
  cards: Flashcard[];
}

export type QuizType = "mcq" | "short" | "numeric" | "pick_picture" | "drag_match";
export interface QuizQuestion {
  id: string;
  type: QuizType;
  prompt: string;
  choices?: string[];
  picture_choices?: PictureRef[];
  diagrams?: Diagram[];
  match_left?: PictureRef[];
  match_right?: { id: string; label: string }[];
  answer?: string;
  answer_map?: Record<string, string>;
  explanation?: string;
  skill_tags?: string[];
}
export interface Quiz {
  questions: QuizQuestion[];
}

export interface TeachToken extends PictureRef {
  correct_slot?: string;
}
export interface TeachBack {
  prompt_for_child: string;
  must_cover: string[];
  example_good_answer: string;
  visual_prompt?: {
    instruction: string;
    mode: "arrange" | "stamp";
    tokens: TeachToken[];
    slots: { id: string; label: string }[];
  } | null;
}
export interface TeachBackFeedback {
  covered: string[];
  missing: string[];
  encouragement: string;
  score_band: "great" | "good" | "keep_trying";
  picture?: { correct: number; total: number };
}

export interface DrillItem {
  id: string;
  prompt: string;
  answer: string;
  type: "numeric" | "short" | "mcq";
}
export interface Drill {
  duration_seconds: number;
  items: DrillItem[];
}

export interface PracticeTestItem {
  id: string;
  prompt: string;
  type: "mcq" | "short" | "numeric";
  choices?: string[];
  answer: string;
  difficulty: "easy" | "medium" | "hard";
  keyword_hints?: string[];
}
export interface PracticeTest {
  title: string;
  duration_minutes: number;
  check_minutes: number;
  items: PracticeTestItem[];
}

// ---- Visual explainer scene spec (PRD §9.7) ----
export interface SceneElement {
  id: string;
  kind: string; // icon|shape|label|fraction_bar|number_line|map_region|arrow|group (unknown kinds render a safe fallback)
  icon_id?: string | null;
  emoji?: string | null;
  shape?: string | null;
  label?: string | null;
  slot?: string | null;
  order?: number | null;
  parts?: number | null;
  shaded?: number | null;
  color?: string | null;
}
export interface SceneStep {
  at_ms: number;
  action: string; // show|hide|replace|highlight|shade|hop
  targets: string[];
  with?: string | string[] | null;
  motion?: string | null; // fade|slide|grow|none
}
export interface Scene {
  id: string;
  title?: string;
  duration_ms: number;
  caption?: string;
  layout?: string; // single|split|row|stack
  elements: SceneElement[];
  steps: SceneStep[];
}
export interface VisualExplainer {
  explainer_id: string;
  concept?: string;
  key_point_ref?: number;
  format?: string;
  duration_seconds?: number;
  title: string;
  scenes: Scene[];
  narration_captions?: { scene_id: string; text: string }[];
}

// ---- Local storage (IndexedDB) ----
export interface Settings {
  id: "app";
  childDisplayName: string;
  keepPhotosLocal: boolean;
  reducedMotion: boolean;
  explainerSpeed: 0.5 | 1 | 1.5;
  ttsEnabled: boolean;
}

export interface Review {
  dueAt: string; // ISO
  status: "pending" | "done" | "repeat";
  doneAt?: string;
}

export interface LessonPack {
  id: string;
  createdAt: string;
  subject: Subject;
  title: string;
  extract: Extract;
  teachBack?: TeachBack;
  flashcards?: FlashcardSet;
  visualExplainers: VisualExplainer[];
  quiz?: Quiz;
  drill?: Drill;
  schedule: Review[]; // review 1, 2, 3 (D+1, D+3, D+7)
  photoThumbnail?: string;
  isSample?: boolean;
}

export type AttemptType =
  | "teachback"
  | "quiz"
  | "drill"
  | "practice_test"
  | "flashcard"
  | "visual_explainer";

export interface Attempt {
  id: string;
  packId: string; // "" for practice tests
  type: AttemptType;
  startedAt: string;
  endedAt: string;
  payload: Record<string, unknown>;
  processFlags?: { usedChecklist: boolean; finishedCheckPhase: boolean };
}

export interface Mistake {
  id: string;
  attemptId: string;
  packId: string;
  itemId: string;
  taxonomyId: string;
  createdAt: string;
}

export interface PracticeTestRecord {
  id: string;
  createdAt: string;
  itemPackIds: string[];
  testJSON: PracticeTest;
  attemptId?: string;
}

export type GenerateKind =
  | "teachback"
  | "flashcards"
  | "visual_flashcards"
  | "visual_explainers"
  | "quiz"
  | "drill";
