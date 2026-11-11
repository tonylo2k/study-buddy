"use client";
import { apiFetch } from "@/lib/api";
import { Check, Play } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { logAttempt } from "@/lib/db";
import { IconView } from "@/lib/icons";
import { activityHref, hasActivity } from "@/lib/plan";
import type { LessonPack, TeachBackFeedback, TeachToken } from "@/lib/types";
import ArrangeBoard from "../ArrangeBoard";
import { Notice } from "../ui";
import VisualSceneRenderer from "../VisualSceneRenderer";

type Stamp = { tokenId: string; x: number; y: number };

/** Stamp mode: tap a picture, then tap the board to place it. Not graded. */
function StampCanvas({ tokens, stamps, onChange, locked }: { tokens: TeachToken[]; stamps: Stamp[]; onChange: (s: Stamp[]) => void; locked: boolean }) {
  const [sel, setSel] = useState<string | null>(tokens[0]?.id ?? null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-center gap-2">
        {tokens.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={sel === t.id}
            onClick={() => setSel(t.id)}
            className={`flex w-24 flex-col items-center gap-1 rounded-2xl border-2 bg-white p-2 text-xs font-semibold ${sel === t.id ? "border-sage ring-4 ring-sage-light" : "border-line"}`}
          >
            <IconView iconId={t.icon_id} emoji={t.emoji} label={t.caption} size={30} />
            {t.caption}
          </button>
        ))}
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Picture board. Tap to stamp the chosen picture."
        onClick={(e) => {
          if (locked || !sel) return;
          const r = e.currentTarget.getBoundingClientRect();
          onChange([...stamps, { tokenId: sel, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }]);
        }}
        className="relative h-56 w-full overflow-hidden rounded-2xl border-2 border-dashed border-line bg-white"
      >
        {stamps.map((s, i) => {
          const t = tokens.find((x) => x.id === s.tokenId);
          return (
            <span key={i} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}>
              <IconView iconId={t?.icon_id} emoji={t?.emoji} label={t?.caption} size={36} />
            </span>
          );
        })}
        {stamps.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-soft">Pick a picture, then tap here.</p>}
      </div>
      {!locked && stamps.length > 0 && (
        <button type="button" className="btn-quiet" onClick={() => onChange(stamps.slice(0, -1))}>
          Undo last stamp
        </button>
      )}
    </div>
  );
}

export default function Teach({ pack }: { pack: LessonPack }) {
  const tb = pack.teachBack!;
  const vp = tb.visual_prompt ?? null;
  const [text, setText] = useState("");
  const [arrangement, setArrangement] = useState<Record<string, string>>({});
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [state, setState] = useState<"edit" | "sending" | "done">("edit");
  const [feedback, setFeedback] = useState<TeachBackFeedback | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const started = useRef(new Date().toISOString());

  const arrangeMode = vp?.mode === "arrange";
  const hasPicture = arrangeMode ? Object.keys(arrangement).length > 0 : stamps.length > 0;
  const canSubmit = text.trim().length >= 3 || hasPicture;

  const localPicture = () => {
    if (!arrangeMode || !vp) return undefined;
    const gradable = vp.tokens.filter((t) => t.correct_slot);
    if (!gradable.length || !Object.keys(arrangement).length) return undefined;
    return { correct: gradable.filter((t) => arrangement[t.id] === t.correct_slot).length, total: gradable.length };
  };

  const submit = async () => {
    setState("sending");
    setOffline(null);
    const pictureArrangement = arrangeMode && Object.keys(arrangement).length ? arrangement : undefined;
    let fb: TeachBackFeedback | null = null;
    try {
      const res = await apiFetch("/api/teachback-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          extract: { subject: pack.subject, title: pack.title, key_points: pack.extract.key_points },
          teachBack: tb,
          childAnswer: text,
          pictureArrangement,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Feedback is not available right now.");
      fb = j as TeachBackFeedback;
    } catch (e) {
      // No key or no network: still honor the effort, and let her check herself against the key ideas.
      setOffline(e instanceof Error ? e.message : "Feedback is not available right now.");
      fb = {
        covered: [],
        missing: [],
        encouragement: "You explained it in your own words. That is the part that makes ideas stick.",
        score_band: "good",
        picture: localPicture(),
      };
    }
    setFeedback(fb);
    setState("done");
    await logAttempt({
      packId: pack.id,
      type: "teachback",
      startedAt: started.current,
      payload: { childAnswer: text, pictureArrangement: pictureArrangement ?? null, stamps: stamps.length ? stamps : null, feedback: fb },
    });
  };

  const again = () => {
    setState("edit");
    setFeedback(null);
    started.current = new Date().toISOString();
  };

  const marks =
    state === "done" && arrangeMode && vp
      ? Object.fromEntries(vp.tokens.filter((t) => t.correct_slot && arrangement[t.id]).map((t) => [t.id, arrangement[t.id] === t.correct_slot]))
      : undefined;
  const locked = state !== "edit";

  // A still from the explainer to glance at while teaching: the first scene with a diagram, else the last scene.
  const explainer = pack.visualExplainers[0];
  const peek = explainer
    ? (explainer.scenes.find((sc) => sc.elements.some((e) => e.kind === "fraction_bar" && (e.shaded ?? 0) > 0)) ??
      explainer.scenes.find((sc) => sc.elements.some((e) => ["fraction_bar", "number_line", "map_region"].includes(e.kind))) ??
      explainer.scenes[explainer.scenes.length - 1])
    : null;
  const peekIndex = explainer && peek ? explainer.scenes.indexOf(peek) : 0;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      <div className="flex flex-col gap-4 lg:w-[372px] lg:shrink-0">
        <section className="flex flex-col gap-2 rounded-[28px] bg-ink px-5 py-[18px] text-white lg:gap-2.5 lg:rounded-[32px] lg:p-6">
          <p className="text-[13px] font-extrabold uppercase tracking-wider text-gold lg:text-sm">You are the teacher</p>
          <p className="text-lg font-extrabold leading-snug [text-wrap:pretty] lg:text-[23px]">{tb.prompt_for_child}</p>
        </section>

        {peek && (
          <section className="hidden flex-col gap-3 rounded-[32px] border border-line bg-white p-5 lg:flex">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-black">Peek at the idea</h2>
              <Link href={activityHref(pack.id, "watch")} className="flex min-h-[44px] items-center gap-2 rounded-2xl bg-cream px-4 text-[15px] font-extrabold text-ink">
                <Play size={15} fill="#3E7F70" stroke="#3E7F70" /> Watch again
              </Link>
            </div>
            <VisualSceneRenderer scene={peek} t={Infinity} staticMode sceneIndex={peekIndex} />
            {peek.caption && <p className="text-[15px] font-semibold leading-snug text-soft">{peek.caption}</p>}
          </section>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {vp && (
          <section className="card flex flex-col gap-3 lg:rounded-[32px]" aria-label="Show it with pictures">
            <h2 className="text-[17px] font-black leading-snug lg:text-[21px]">{vp.instruction}</h2>
            {arrangeMode ? (
              <ArrangeBoard tokens={vp.tokens} slots={vp.slots} value={arrangement} onChange={setArrangement} locked={locked} marks={marks} />
            ) : (
              <StampCanvas tokens={vp.tokens} stamps={stamps} onChange={setStamps} locked={locked} />
            )}
          </section>
        )}

        <section className="card flex flex-col gap-2 lg:rounded-[32px]">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="teach-text" className="text-[17px] font-black lg:text-[21px]">
              {vp ? "And in your own words" : "In your own words"}
            </label>
            <span className="hidden text-[13px] font-bold text-soft sm:inline">Two or three sentences</span>
          </div>
          <textarea
            id="teach-text"
            className="min-h-[7.5rem] w-full resize-none rounded-xl border-0 bg-white px-1 text-[17px] font-semibold leading-[40px] text-ink placeholder:text-soft/60 focus:outline-none lg:min-h-[8.5rem] lg:text-[21px] lg:leading-[44px]"
            style={{ backgroundImage: "repeating-linear-gradient(180deg, transparent 0 calc(var(--ln) - 2px), #E4DED3 calc(var(--ln) - 2px) var(--ln))", backgroundAttachment: "local" }}
            value={text}
            disabled={locked}
            onChange={(e) => setText(e.target.value)}
            placeholder="This idea means…"
          />
        </section>

        {state !== "done" && (
          <button className="btn-primary !min-h-[60px] w-full !text-[19px] lg:w-auto lg:self-end lg:px-11" disabled={!canSubmit || state === "sending"} onClick={submit}>
            {state === "sending" ? "Reading your teaching…" : "I taught it"}
          </button>
        )}

        {state === "done" && feedback && (
          <section className="card space-y-3 lg:rounded-[32px]" aria-live="polite">
            <p className="text-xl font-black leading-snug">{feedback.encouragement}</p>
            {feedback.picture && (
              <p className="text-sm font-semibold text-soft">
                Pictures: {feedback.picture.correct} of {feedback.picture.total} are in their place.
                {feedback.picture.correct < feedback.picture.total ? " The ones with the arrows could move." : ""}
              </p>
            )}
            {feedback.covered.length > 0 && (
              <div>
                <p className="text-sm font-extrabold text-sage-dark">You covered</p>
                <ul className="mt-1 space-y-1.5 text-[15px] font-semibold">
                  {feedback.covered.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <Check size={18} strokeWidth={3} className="mt-0.5 shrink-0 text-sage" aria-hidden /> {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {feedback.missing.length > 0 && (
              <div className="rounded-2xl bg-gold-light px-4 py-3 text-[15px] font-semibold">
                <span className="font-extrabold">One more idea to add: </span>
                {feedback.missing[0]}
              </div>
            )}
            {offline && (
              <>
                <Notice tone="warn">Helper feedback is not available right now ({offline}). Your teach-back is saved.</Notice>
                <div>
                  <p className="text-sm font-extrabold">Check yourself. Did you say these?</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-[15px] font-semibold">
                    {tb.must_cover.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
            <div className="flex flex-col gap-2 pt-1 lg:flex-row-reverse">
              {hasActivity(pack, "cards") && (
                <Link href={activityHref(pack.id, "cards")} className="btn-primary lg:flex-1">
                  On to flashcards
                </Link>
              )}
              <button className="btn-secondary lg:flex-1" onClick={again}>
                Add to my answer
              </button>
              {hasActivity(pack, "watch") && (
                <Link href={activityHref(pack.id, "watch")} className="btn-quiet lg:hidden">
                  Watch the idea again
                </Link>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
