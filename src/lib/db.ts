"use client";
import Dexie, { type Table } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import type { Attempt, LessonPack, Mistake, PracticeTestRecord, Settings } from "./types";

// Everything the child does stays in this browser's IndexedDB. Nothing is synced.
class StudyDB extends Dexie {
  settings!: Table<Settings, string>;
  lessonPacks!: Table<LessonPack, string>;
  attempts!: Table<Attempt, string>;
  mistakes!: Table<Mistake, string>;
  practiceTests!: Table<PracticeTestRecord, string>;

  constructor() {
    super("study-buddy");
    this.version(1).stores({
      settings: "id",
      lessonPacks: "id, createdAt, subject",
      attempts: "id, packId, type, startedAt",
      mistakes: "id, attemptId, packId, taxonomyId, createdAt",
      practiceTests: "id, createdAt",
    });
  }
}

export const db = new StudyDB();

export const DEFAULT_SETTINGS: Settings = {
  id: "app",
  childDisplayName: "",
  keepPhotosLocal: false,
  reducedMotion: false,
  explainerSpeed: 1,
  ttsEnabled: false,
};

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

export async function saveSettings(patch: Partial<Settings>) {
  const current = (await db.settings.get("app")) ?? DEFAULT_SETTINGS;
  await db.settings.put({ ...current, ...patch, id: "app" });
}

/** Live settings. `ready` is false until the first read finishes. */
export function useSettings(): { settings: Settings; ready: boolean } {
  const row = useLiveQuery(async () => (await db.settings.get("app")) ?? null, []);
  return { settings: { ...DEFAULT_SETTINGS, ...(row ?? {}) }, ready: row !== undefined };
}

export function usePacks(): LessonPack[] | undefined {
  return useLiveQuery(() => db.lessonPacks.orderBy("createdAt").reverse().toArray(), []);
}
export function usePack(id: string | null): LessonPack | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.lessonPacks.get(id)) ?? null) : null), [id]);
}
export function useAttempts(): Attempt[] | undefined {
  return useLiveQuery(() => db.attempts.orderBy("startedAt").reverse().toArray(), []);
}
export function useMistakes(): Mistake[] | undefined {
  return useLiveQuery(() => db.mistakes.toArray(), []);
}
export function usePracticeTests(): PracticeTestRecord[] | undefined {
  return useLiveQuery(() => db.practiceTests.orderBy("createdAt").reverse().toArray(), []);
}

export async function logAttempt(a: Omit<Attempt, "id" | "endedAt"> & { id?: string; endedAt?: string }): Promise<string> {
  const id = a.id ?? uid();
  await db.attempts.put({ ...a, id, endedAt: a.endedAt ?? new Date().toISOString() });
  return id;
}

export async function deletePack(id: string) {
  await db.transaction("rw", db.lessonPacks, db.attempts, db.mistakes, async () => {
    await db.lessonPacks.delete(id);
    await db.attempts.where("packId").equals(id).delete();
    await db.mistakes.where("packId").equals(id).delete();
  });
}

/** "Delete all data": wipes every table (settings included) from IndexedDB. */
export async function deleteAllData() {
  await db.delete();
  await db.open();
}
