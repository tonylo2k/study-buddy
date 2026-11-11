"use client";
import { useEffect, useState } from "react";

// Read-aloud uses the voices installed on the device (Web Speech API). Quality varies a lot
// between voices, so we rank them, pick the best one by default, and let a parent choose.

const NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|ralph|rocko|shelley|sandy|grandma|grandpa|eddy|flo|reed)\b/i;
const NICE = /\b(samantha|ava|allison|zoe|evan|nicky|serena|daniel|karen|moira|tessa|susan|joelle|noelle|aria|jenny|libby|sonia)\b/i;

export function voiceScore(v: SpeechSynthesisVoice): number {
  let s = 0;
  if (/premium|enhanced|natural|neural/i.test(v.name)) s += 4;
  if (/siri|google|online/i.test(v.name)) s += 2;
  if (NICE.test(v.name)) s += 1;
  if (/^en[-_]US/i.test(v.lang)) s += 1;
  if (/compact|espeak/i.test(v.name)) s -= 2;
  return s;
}

export function voiceQuality(v: SpeechSynthesisVoice): string {
  if (/premium|enhanced|natural|neural/i.test(v.name)) return "More natural";
  if (/siri|google|online/i.test(v.name)) return "Good";
  return "Standard";
}

export function englishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => /^en([-_]|$)/i.test(v.lang) && !NOVELTY.test(v.name))
    .sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name));
}

/** The chosen voice if it still exists on this device, otherwise the best-ranked English voice. */
export function pickVoice(voiceURI?: string): SpeechSynthesisVoice | null {
  const list = englishVoices();
  return list.find((v) => v.voiceURI === voiceURI) ?? list[0] ?? null;
}

export function speakText(text: string, opts: { voiceURI?: string; rate?: number } = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(opts.voiceURI);
  if (v) {
    u.voice = v;
    u.lang = v.lang;
  } else u.lang = "en-US";
  u.rate = Math.max(0.7, Math.min(1.2, opts.rate ?? 0.92));
  window.speechSynthesis.speak(u);
}

/** Voices load asynchronously in most browsers, so this re-reads them when they arrive. */
export function useEnglishVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setVoices(englishVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  return voices;
}
