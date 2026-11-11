"use client";
import { Check, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { saveSettings } from "@/lib/db";
import { captionFor } from "@/lib/scene";
import { speakText } from "@/lib/voice";
import type { VisualExplainer } from "@/lib/types";
import VisualSceneRenderer from "./VisualSceneRenderer";

const SPEEDS = [0.5, 1, 1.5] as const;
type Speed = (typeof SPEEDS)[number];

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Optional read-aloud of the narration captions using the browser's own voice. */
function useSpeechNarration(enabled: boolean, voiceURI?: string) {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const speak = useCallback(
    (text: string, rate: number) => {
      if (!enabled || !supported || !text) return;
      speakText(text, { voiceURI, rate: 0.92 * rate });
    },
    [enabled, supported, voiceURI],
  );
  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);
  useEffect(() => stop, [stop]);
  return { speak, stop, supported };
}

/** True on tablets and wider. Phones get the taller, stacked stage. */
export function useIsWide(query = "(min-width: 768px)"): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return wide;
}

function CaptionBar({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} aria-live="polite" className="min-h-[5.5rem] text-[22px] font-extrabold leading-snug text-ink [text-wrap:pretty] lg:min-h-[4.5rem] lg:text-[28px]">
      {text}
    </p>
  );
}

function SpeedPicker({ speed, onChange }: { speed: Speed; onChange: (s: Speed) => void }) {
  return (
    <div role="group" aria-label="Speed" className="flex h-14 shrink-0 gap-0.5 rounded-[20px] border border-line bg-white p-1">
      {SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={speed === s}
          onClick={() => onChange(s)}
          className={`w-[38px] rounded-2xl text-[13px] font-extrabold md:w-[46px] md:text-sm lg:w-[52px] ${speed === s ? "bg-sage-light text-sage-dark" : "text-soft"}`}
        >
          {s}×
        </button>
      ))}
    </div>
  );
}

export interface PlayerResult {
  completed: boolean;
  reducedMotion: boolean;
  durationSec: number;
}

/**
 * Plays a visual scene spec.
 * - Never starts on its own: the child taps Play.
 * - Pause stops the clock on the very next frame; Replay starts again from scene 1.
 * - Speed (0.5×, 1×, 1.5×) scales the clock, so at_ms / duration_ms shrink or stretch together.
 * - With Reduce motion (in-app or OS), the same spec becomes Back / Next slides with no animation.
 */
export default function VisualExplainerPlayer({
  explainer,
  reducedMotionSetting,
  defaultSpeed = 1,
  ttsEnabled = false,
  voiceURI,
  onFinished,
  aside,
}: {
  explainer: VisualExplainer;
  reducedMotionSetting: boolean;
  defaultSpeed?: Speed;
  ttsEnabled?: boolean;
  voiceURI?: string;
  onFinished?: (r: PlayerResult) => void;
  /** Shown under the chapter list on wide screens (for example "Next: Teach it back"). */
  aside?: ReactNode;
}) {
  const wide = useIsWide();
  const osReduced = usePrefersReducedMotion();
  const reduced = reducedMotionSetting || osReduced;
  const capId = useId();
  const scenes = explainer.scenes;

  const [speed, setSpeedState] = useState<Speed>(defaultSpeed);
  const [tts, setTts] = useState(ttsEnabled);
  const [index, setIndex] = useState(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const startedAt = useRef<number | null>(null);
  const reported = useRef(false);
  const { speak, stop, supported: ttsSupported } = useSpeechNarration(tts, voiceURI);

  // Refs let the animation frame loop read the latest values without restarting.
  const live = useRef({ index, t, speed });
  live.current = { index, t, speed };

  useEffect(() => setSpeedState(defaultSpeed), [defaultSpeed]);
  useEffect(() => setTts(ttsEnabled), [ttsEnabled]);

  // Reset when a different explainer is shown or the mode flips.
  useEffect(() => {
    setIndex(0);
    setT(0);
    setPlaying(false);
    setFinished(false);
    startedAt.current = null;
    reported.current = false;
    stop();
  }, [explainer.explainer_id, reduced, stop]);

  const report = useCallback(
    (completed: boolean) => {
      if (reported.current || !completed) return;
      reported.current = true;
      onFinished?.({
        completed,
        reducedMotion: reduced,
        durationSec: startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0,
      });
    },
    [onFinished, reduced],
  );

  // The clock. Only runs while playing and not in reduced-motion mode.
  useEffect(() => {
    if (!playing || reduced) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(100, now - last); // a hidden tab must not jump the story ahead
      last = now;
      const cur = live.current;
      const dur = scenes[cur.index]?.duration_ms ?? 0;
      const nt = cur.t + dt * cur.speed;
      if (nt >= dur) {
        if (cur.index + 1 < scenes.length) {
          live.current = { ...cur, index: cur.index + 1, t: 0 };
          setIndex(cur.index + 1);
          setT(0);
        } else {
          setT(dur);
          setPlaying(false);
          setFinished(true);
          report(true);
          return;
        }
      } else {
        live.current = { ...cur, t: nt };
        setT(nt);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, reduced, scenes, report]);

  const scene = scenes[Math.min(index, scenes.length - 1)];
  const cap = scene ? captionFor(explainer, scene) : { onScreen: "", spoken: "" };

  // Speak each scene's caption once, when it begins (or when a slide is opened).
  const spokenKey = useRef("");
  useEffect(() => {
    if (!scene) return;
    const active = reduced ? startedAt.current !== null : playing;
    const key = `${explainer.explainer_id}:${scene.id}`;
    if (active && tts && spokenKey.current !== key) {
      spokenKey.current = key;
      speak(cap.spoken, reduced ? 1 : speed);
    }
  }, [scene, playing, reduced, tts, speak, cap.spoken, speed, explainer.explainer_id]);

  if (!scene) return <p className="text-soft">This explainer has no scenes.</p>;

  const setSpeed = (s: Speed) => {
    setSpeedState(s);
    void saveSettings({ explainerSpeed: s });
  };
  const toggleTts = () => {
    const next = !tts;
    setTts(next);
    if (!next) stop();
    else spokenKey.current = "";
    void saveSettings({ ttsEnabled: next });
  };
  const replay = () => {
    stop();
    spokenKey.current = "";
    reported.current = false;
    startedAt.current = Date.now();
    setIndex(0);
    setT(0);
    setFinished(false);
    setPlaying(!reduced);
  };
  const playPause = () => {
    if (finished) return replay();
    if (playing) {
      setPlaying(false); // the clock effect is torn down immediately
      stop();
    } else {
      if (startedAt.current === null) startedAt.current = Date.now();
      setPlaying(true);
    }
  };
  const goSlide = (i: number) => {
    if (startedAt.current === null) startedAt.current = Date.now();
    const clamped = Math.max(0, Math.min(scenes.length - 1, i));
    setIndex(clamped);
    if (clamped === scenes.length - 1) {
      setFinished(true);
      report(true);
    }
  };

  const total = scenes.reduce((a, s) => a + s.duration_ms, 0);
  const elapsed = finished ? total : scenes.slice(0, index).reduce((a, s) => a + s.duration_ms, 0) + Math.min(t, scene.duration_ms);

  /** Jump to a chapter. In the animated player it starts playing from there. */
  const jump = (i: number) => {
    if (reduced) return goSlide(i);
    stop();
    spokenKey.current = "";
    if (startedAt.current === null) startedAt.current = Date.now();
    live.current = { ...live.current, index: i, t: 0 };
    setIndex(i);
    setT(0);
    setFinished(false);
    setPlaying(true);
  };

  const square = "flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border bg-white";
  const ttsButton = ttsSupported && (
    <button
      type="button"
      onClick={toggleTts}
      aria-pressed={tts}
      aria-label={tts ? "Turn read-aloud off" : "Turn read-aloud on"}
      className={`${square} lg:order-4 ${tts ? "border-sage bg-sage-light text-sage-dark" : "border-line text-ink"}`}
    >
      {tts ? <Volume2 size={24} /> : <VolumeX size={24} />}
    </button>
  );

  // One segment per scene, so she can see how far through the idea she is.
  const progress = (
    <div
      role="progressbar"
      aria-label="Progress through the idea"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round((elapsed / total) * 100)}
      className="order-first flex w-full gap-1.5 lg:order-3 lg:w-auto lg:flex-1 lg:gap-2"
    >
      {scenes.map((sc, i) => {
        const f = reduced ? (i <= index ? 1 : 0) : finished || i < index ? 1 : i === index ? Math.min(1, t / sc.duration_ms) : 0;
        return (
          <span key={sc.id} className="h-2 flex-1 overflow-hidden rounded-full bg-[#D8D2C6] lg:h-2.5">
            <span className="block h-full rounded-full bg-sage" style={{ width: `${f * 100}%` }} />
          </span>
        );
      })}
    </div>
  );

  const header = (
    <div className="flex items-end justify-between gap-3">
      <h2 className="text-xl font-black leading-tight text-ink lg:text-[26px]">{scene.title || explainer.title}</h2>
      <span className="shrink-0 pb-0.5 text-sm font-extrabold text-soft">
        {index + 1} of {scenes.length}
      </span>
    </div>
  );

  const chapters = (
    <aside className="hidden w-[276px] shrink-0 flex-col gap-4 lg:flex">
      <section className="flex-1 rounded-[28px] border border-line bg-white p-5">
        <h3 className="text-lg font-black">In this idea</h3>
        <ol className="mt-3 space-y-2">
          {scenes.map((sc, i) => {
            const done = finished || i < index;
            const current = i === index && !finished;
            return (
              <li key={sc.id}>
                <button
                  type="button"
                  onClick={() => jump(i)}
                  aria-current={current ? "step" : undefined}
                  className={`flex min-h-[64px] w-full items-center gap-3 rounded-[18px] px-3 py-2 text-left ${current ? "border-2 border-sage bg-sage-light" : "border-2 border-transparent bg-cream"}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-black ${
                      done ? "bg-sage text-white" : current ? "bg-white text-sage-dark" : "border-2 border-[#D8D2C6] bg-white text-soft"
                    }`}
                  >
                    {done ? <Check size={16} strokeWidth={3.2} aria-label="watched" /> : i + 1}
                  </span>
                  <span className={`text-base leading-tight ${current ? "font-black" : "font-extrabold"}`}>{sc.title || `Part ${i + 1}`}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
      {aside}
    </aside>
  );

  // ---------- Reduced motion: StepThroughSlides ----------
  if (reduced) {
    return (
      <div className="lg:flex lg:gap-6" data-testid="step-through">
        <div className="min-w-0 flex-1 space-y-4">
          {header}
          <VisualSceneRenderer scene={scene} t={Infinity} staticMode portrait={!wide} sceneIndex={index} describedBy={capId} />
          <CaptionBar id={capId} text={cap.onScreen} />
          <div className="flex flex-wrap items-center gap-3">
            {progress}
            <button type="button" onClick={() => goSlide(index - 1)} disabled={index === 0} className="btn-secondary !min-h-[56px] flex-1 disabled:opacity-40 lg:order-1 lg:flex-none lg:px-8">
              <ChevronLeft size={20} /> Back
            </button>
            {ttsButton}
            <button type="button" onClick={() => goSlide(index + 1)} disabled={index === scenes.length - 1} className="btn-primary !min-h-[56px] flex-1 disabled:opacity-40 lg:order-5 lg:flex-none lg:px-8">
              Next <ChevronRight size={20} />
            </button>
          </div>
          <p className="text-center text-xs text-soft lg:text-left">Reduce motion is on, so this idea is shown as still pictures.</p>
        </div>
        {chapters}
      </div>
    );
  }

  // ---------- Animated path ----------
  return (
    <div className="lg:flex lg:gap-6" data-testid="animated-player">
      <div className="min-w-0 flex-1 space-y-4">
        {header}
        <div className="relative">
          <VisualSceneRenderer scene={scene} t={t} speed={speed} portrait={!wide} sceneIndex={index} describedBy={capId} />
          {!playing && startedAt.current === null && (
            <button type="button" onClick={playPause} aria-label="Play" className="absolute inset-0 flex items-center justify-center rounded-[32px] bg-cream/60">
              <span className="flex h-24 w-24 items-center justify-center rounded-[32px] bg-sage text-white shadow-card">
                <Play size={40} fill="currentColor" className="ml-1" />
              </span>
            </button>
          )}
        </div>
        <CaptionBar id={capId} text={cap.onScreen} />
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-3 md:gap-x-3">
          {progress}
          <button type="button" onClick={replay} aria-label="Replay from the start" className={`${square} border-line text-ink lg:order-2`}>
            <RotateCcw size={24} />
          </button>
          {ttsButton}
          <button
            type="button"
            onClick={playPause}
            aria-label={playing ? "Pause" : finished ? "Watch again" : "Play"}
            className="flex h-[72px] w-[76px] shrink-0 items-center justify-center rounded-[26px] bg-sage text-white active:bg-sage-dark md:w-[84px] lg:order-1 lg:w-24"
          >
            {playing ? <Pause size={30} fill="currentColor" /> : finished ? <RotateCcw size={30} /> : <Play size={30} fill="currentColor" className="ml-0.5" />}
          </button>
          <div className="lg:order-5">
            <SpeedPicker speed={speed} onChange={setSpeed} />
          </div>
        </div>
      </div>
      {chapters}
    </div>
  );
}
