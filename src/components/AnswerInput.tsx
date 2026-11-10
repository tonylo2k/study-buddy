"use client";
import { IconView } from "@/lib/icons";
import type { Diagram, PictureRef } from "@/lib/types";
import { MiniDiagram } from "./ui";

export function ChoiceList({
  choices,
  value,
  onPick,
  locked,
  correct,
}: {
  choices: string[];
  value: string;
  onPick: (c: string) => void;
  locked?: boolean;
  correct?: string;
}) {
  return (
    <div className="grid gap-2" role="radiogroup">
      {choices.map((c) => {
        const on = value === c;
        const showRight = locked && correct !== undefined && c === correct;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={locked}
            onClick={() => onPick(c)}
            className={`min-h-[52px] rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold ${
              showRight ? "border-sage bg-sage-light" : on ? "border-sage bg-sage-light" : "border-line bg-white"
            } ${locked && on && !showRight ? "!border-gold !bg-gold-light" : ""}`}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

export function PictureChoices({
  choices,
  diagrams,
  value,
  onPick,
  locked,
  correct,
}: {
  choices: PictureRef[];
  diagrams?: Diagram[];
  value: string;
  onPick: (id: string) => void;
  locked?: boolean;
  correct?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup">
      {choices.map((c) => {
        const on = value === c.id;
        const d = diagrams?.find((x) => x.id === c.id);
        const showRight = locked && correct !== undefined && c.id === correct;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={locked}
            onClick={() => onPick(c.id)}
            className={`flex min-h-[7.5rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 text-center text-sm font-semibold ${
              showRight ? "border-sage bg-sage-light" : on ? "border-sage bg-sage-light" : "border-line bg-white"
            } ${locked && on && !showRight ? "!border-gold !bg-gold-light" : ""}`}
          >
            {d ? <MiniDiagram diagram={d} width={130} /> : <IconView iconId={c.icon_id} emoji={c.emoji} label={c.caption} size={48} />}
            <span>{c.caption}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TextAnswer({
  value,
  onChange,
  onEnter,
  numeric,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  numeric?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <input
      className="field text-lg"
      value={value}
      disabled={disabled}
      autoFocus={autoFocus}
      inputMode={numeric ? "decimal" : "text"}
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      placeholder="Your answer"
      aria-label="Your answer"
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onEnter?.();
      }}
    />
  );
}

/** Underlines keyword hints inside a question prompt (practice-test tip). */
export function PromptWithKeywords({ prompt, keywords }: { prompt: string; keywords?: string[] }) {
  const kws = (keywords ?? []).filter((k) => k && k.length > 1);
  if (kws.length === 0) return <>{prompt}</>;
  const esc = kws.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = prompt.split(new RegExp(`\\b(${esc.join("|")})\\b`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        kws.some((k) => k.toLowerCase() === p.toLowerCase()) ? (
          <span key={i} className="underline decoration-gold decoration-4 underline-offset-4">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
