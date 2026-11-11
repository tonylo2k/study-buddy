"use client";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
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

function CaptionBar({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} aria-live="polite" className="min-h-[4.5rem] rounded-2xl bg-sage-light px-4 py-3 text-center text-lg leading-snug text-ink">
      {text}
    </p>
  );
}

function SpeedPicker({ speed, onChange }: { speed: Speed; onChange: (s: Speed) => void }) {
  return (
    <div role="group" aria-label="Speed" className="flex overflow-hidden rounded-full border-2 border-line bg-white">
      {SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={speed === s}
          onClick={() => onChange(s)}
          className={`min-h-[44px] px-3 text-sm font-semibold ${speed === s ? "bg-sage text-white" : "text-soft"}`}
        >
          {s}×
        </button>
      ))}
    </div>
  );
}

function Dots({ count, index }: { count: number; index: number }) {
  return (
    <div className="flex justify-center gap-2" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-sage" : i < index ? "w-2 bg-sage/60" : "w-2 bg-line"}`} />
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
}: {
  explainer: VisualExplainer;
  reducedMotionSetting: boolean;
  defaultSpeed?: Speed;
  ttsEnabled?: boolean;
  voiceURI?: string;
  onFinished?: (r: PlayerResult) => void;
}) {
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
  const elapsed = scenes.slice(0, index).reduce((a, s) => a + s.duration_ms, 0) + Math.min(t, scene.duration_ms);

  const ttsButton = ttsSupported && (
    <button
      type="button"
      onClick={toggleTts}
      aria-pressed={tts}
      aria-label={tts ? "Turn read-aloud off" : "Turn read-aloud on"}
      className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${tts ? "border-sage bg-sage-light text-sage-dark" : "border-line bg-white text-soft"}`}
    >
      {tts ? <Volume2 size={20} /> : <VolumeX size={20} />}
    </button>
  );

  // ---------- Reduced motion: StepThroughSlides ----------
  if (reduced) {
    return (
      <div className="space-y-3" data-testid="step-through">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">{scene.title || explainer.title}</h2>
          <span className="text-sm text-soft">
            {index + 1} of {scenes.length}
          </span>
        </div>
        <VisualSceneRenderer scene={scene} t={Infinity} staticMode describedBy={capId} />
        <CaptionBar id={capId} text={cap.onScreen} />
        <Dots count={scenes.length} index={index} />
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => goSlide(index - 1)} disabled={index === 0} className="btn-secondary flex-1 disabled:opacity-40">
            <ChevronLeft size={20} /> Back
          </button>
          {ttsButton}
          <button type="button" onClick={() => goSlide(index + 1)} disabled={index === scenes.length - 1} className="btn-primary flex-1 disabled:opacity-40">
            Next <ChevronRight size={20} />
          </button>
        </div>
        <p className="text-center text-xs text-soft">Reduce motion is on, so this idea is shown as still pictures.</p>
      </div>
    );
  }

  // ---------- Animated path ----------
  return (
    <div className="space-y-3" data-testid="animated-player">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-ink">{scene.title || explainer.title}</h2>
        <span className="shrink-0 text-sm text-soft">
          {index + 1} of {scenes.length}
        </span>
      </div>
      <div className="relative">
        <VisualSceneRenderer scene={scene} t={t} speed={speed} describedBy={capId} />
        {!playing && startedAt.current === null && (
          <button
            type="button"
            onClick={playPause}
            aria-label="Play"
            className="absolute inset-0 flex items-center justify-center rounded-3xl bg-cream/70"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-sage text-white shadow-card">
              <Play size={36} className="ml-1" />
            </span>
          </button>
        )}
      </div>
      <CaptionBar id={capId} text={cap.onScreen} />
      <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((elapsed / total) * 100)}>
        <div className="h-full rounded-full bg-sage" style={{ width: `${(elapsed / total) * 100}%` }} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={playPause} className="btn-primary min-w-[7.5rem]" aria-label={playing ? "Pause" : finished ? "Watch again" : "Play"}>
          {playing ? <Pause size={20} /> : finished ? <RotateCcw size={20} /> : <Play size={20} />}
          {playing ? "Pause" : finished ? "Again" : "Play"}
        </button>
        <button type="button" onClick={replay} aria-label="Replay from the start" className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-line bg-white text-soft">
          <RotateCcw size={20} />
        </button>
        {ttsButton}
        <SpeedPicker speed={speed} onChange={setSpeed} />
      </div>
    </div>
  );
}
