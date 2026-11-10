"use client";
import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { IconView } from "@/lib/icons";
import type { Diagram, PictureRef } from "@/lib/types";
import { MiniDiagram } from "./ui";

/**
 * Picture tokens that go into labeled areas. Used for "drag to match" quiz items and
 * the arrange-pictures teach-back. Two ways to place a token, so it works for every hand:
 *   1. drag it onto an area, or
 *   2. tap the picture, then tap the area.
 * Tap a placed picture to send it back to the tray.
 */
export default function ArrangeBoard({
  tokens,
  slots,
  value,
  onChange,
  locked = false,
  marks,
  diagrams,
}: {
  tokens: PictureRef[];
  slots: { id: string; label: string }[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  locked?: boolean;
  /** After checking: tokenId → placed correctly? */
  marks?: Record<string, boolean>;
  diagrams?: Record<string, Diagram>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const dragged = useRef(false);

  const place = (tokenId: string, slotId: string | null) => {
    if (locked) return;
    const next = { ...value };
    if (slotId) next[tokenId] = slotId;
    else delete next[tokenId];
    onChange(next);
    setSelected(null);
  };

  const dropAt = (tokenId: string, clientX: number, clientY: number) => {
    const hit = document.elementsFromPoint(clientX, clientY).find((el) => (el as HTMLElement).dataset?.slotId !== undefined) as HTMLElement | undefined;
    if (hit) place(tokenId, hit.dataset.slotId || null);
  };

  const renderToken = (t: PictureRef) => {
    const isSel = selected === t.id;
    const mark = marks?.[t.id];
    return (
      <motion.button
        key={t.id}
        type="button"
        drag={!locked}
        dragSnapToOrigin
        dragElastic={0.2}
        whileDrag={{ scale: 1.06, zIndex: 30 }}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={(e, info) => {
          dropAt(t.id, info.point.x - window.scrollX, info.point.y - window.scrollY);
          setTimeout(() => (dragged.current = false), 50);
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (locked || dragged.current) return;
          if (value[t.id]) place(t.id, null);
          else setSelected(isSel ? null : t.id);
        }}
        aria-pressed={isSel}
        aria-label={`${t.caption || t.icon_id || "picture"}${value[t.id] ? ", placed. Tap to take it back" : ""}`}
        className={`relative flex w-[7rem] max-w-full touch-none flex-col items-center gap-1 rounded-2xl border-2 bg-white px-2 py-2 text-center text-xs font-semibold leading-tight text-ink shadow-card ${
          mark === true ? "border-sage" : mark === false ? "border-gold" : isSel ? "border-sage ring-4 ring-sage-light" : "border-line"
        }`}
      >
        {diagrams?.[t.id] ? <MiniDiagram diagram={diagrams[t.id]} width={96} /> : <IconView iconId={t.icon_id} emoji={t.emoji} label={t.caption} size={34} />}
        <span>{t.caption}</span>
        {mark !== undefined && (
          <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm shadow-card" aria-hidden>
            {mark ? "✅" : "↔️"}
          </span>
        )}
      </motion.button>
    );
  };

  const tray = tokens.filter((t) => !value[t.id]);

  return (
    <div className="space-y-3">
      <div
        data-slot-id=""
        className="flex min-h-[6.5rem] flex-wrap items-start justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-cream p-3"
        aria-label="Pictures to place"
      >
        {tray.length === 0 ? <p className="self-center text-sm text-soft">All placed. Tap a picture to move it.</p> : tray.map(renderToken)}
      </div>
      <div className={`grid gap-3 ${slots.length === 2 ? "grid-cols-2" : slots.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {slots.map((s) => (
          <div
            key={s.id}
            role="button"
            tabIndex={locked ? -1 : 0}
            data-slot-id={s.id}
            onClick={() => selected && place(selected, s.id)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && selected) {
                e.preventDefault();
                place(selected, s.id);
              }
            }}
            aria-label={`Area: ${s.label}${selected ? ". Tap to place the picture here" : ""}`}
            className={`flex min-h-[9rem] flex-col items-center gap-2 rounded-2xl border-2 p-2 ${selected ? "border-sage bg-sage-light" : "border-line bg-white"}`}
          >
            <span className="chip pointer-events-none">{s.label}</span>
            <span className="flex w-full flex-wrap justify-center gap-2" data-slot-id={s.id}>
              {tokens.filter((t) => value[t.id] === s.id).map(renderToken)}
            </span>
          </div>
        ))}
      </div>
      {!locked && <p className="text-center text-xs text-soft">Drag a picture, or tap it and then tap where it goes.</p>}
    </div>
  );
}
