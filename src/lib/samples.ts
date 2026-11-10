"use client";
import mathExtract from "@sample/math_grade4_extract.json";
import mathGenerated from "@sample/math_grade4_generated.json";
import socialExtract from "@sample/social_grade4_extract.json";
import socialGenerated from "@sample/social_grade4_generated.json";
import visualFractions from "@sample/visual_fractions.json";
import visualLocal from "@sample/visual_local_products.json";
import visualWeather from "@sample/visual_weather_vs_climate.json";
import { db } from "./db";
import { newSchedule } from "./schedule";
import type { Drill, Extract, FlashcardSet, LessonPack, Quiz, TeachBack, VisualExplainer } from "./types";

type Generated = { teachBack: TeachBack; flashcards: FlashcardSet; quiz: Quiz; drill: Drill };

const strip = <T,>(x: unknown): T => {
  const { _comment, ...rest } = x as Record<string, unknown>;
  void _comment;
  return rest as T;
};

export const SAMPLE_EXPLAINERS: VisualExplainer[] = [
  strip<VisualExplainer>(visualWeather),
  strip<VisualExplainer>(visualFractions),
  strip<VisualExplainer>(visualLocal),
];

/** Dev hook: loads the golden examples from sample-data/ without calling the API. */
export async function loadSamplePacks(): Promise<string[]> {
  const now = new Date();
  const weather = strip<VisualExplainer>(visualWeather);
  const mk = (id: string, extract: Extract, gen: Generated | null, explainers: VisualExplainer[]): LessonPack => ({
    id,
    createdAt: now.toISOString(),
    subject: extract.subject,
    title: extract.title,
    extract,
    teachBack: gen?.teachBack,
    flashcards: gen?.flashcards,
    quiz: gen?.quiz,
    drill: gen?.drill,
    visualExplainers: explainers,
    schedule: newSchedule(now),
    isSample: true,
  });

  const weatherExtract: Extract = {
    subject: "science",
    grade_hint: "Grade 4",
    title: "Weather vs Climate",
    language: "en",
    key_points: [
      "Weather is what the sky is doing today; it can change hour by hour",
      "Climate is the usual pattern over a long time, like a year of seasons cycling",
      "Raining this afternoon is weather; warm summers every year is climate",
    ],
    vocabulary: [
      { term: "weather", definition: "What the sky and air are like right now or today" },
      { term: "climate", definition: "The usual pattern of weather in a place over many years" },
    ],
    worked_examples: [],
    practice_seeds: ["Is “it snowed this morning” weather or climate?", "Is “winters here are usually mild” weather or climate?"],
    raw_ocr_text: "(example) Weather vs climate…",
    warnings: [],
  };

  const packs: LessonPack[] = [
    mk("sample-math", strip<Extract>(mathExtract), strip<Generated>(mathGenerated), [strip<VisualExplainer>(visualFractions)]),
    mk("sample-social", strip<Extract>(socialExtract), strip<Generated>(socialGenerated), [strip<VisualExplainer>(visualLocal)]),
    // Explainer-only pack: the rest can be generated from its extract once an API key is set.
    mk("sample-weather", weatherExtract, null, [weather]),
  ];
  await db.lessonPacks.bulkPut(packs);
  return packs.map((p) => p.id);
}
