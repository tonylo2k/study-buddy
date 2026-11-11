"use client";
import { motion } from "framer-motion";
import { ArrowLeftRight, Check } from "lucide-react";
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
        className={`relative flex min-h-[5.5rem] w-[7rem] max-w-full touch-none flex-col items-center justify-center gap-1.5 rounded-[18px] border-2 bg-white px-2 py-2 text-center text-[13px] font-extrabold leading-tight text-ink shadow-card md:min-h-[7rem] md:w-[10.5rem] md:gap-2 md:text-base ${
          mark === true ? "border-sage" : mark === false ? "border-gold" : isSel ? "border-sage ring-4 ring-sage-light" : "border-line"
        }`}
      >
        {diagrams?.[t.id] ? <MiniDiagram diagram={diagrams[t.id]} width={96} /> : <IconView iconId={t.icon_id} emoji={t.emoji} label={t.caption} size={34} />}
        <span>{t.caption}</span>
        {mark !== undefined && (
          <span className={`absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full text-white shadow-card ${mark ? "bg-sage" : "bg-[#B9783F]"}`} aria-hidden>
            {mark ? <Check size={16} strokeWidth={3.2} /> : <ArrowLeftRight size={15} strokeWidth={2.8} />}
          </span>
        )}
      </motion.button>
    );
  };

  const tray = tokens.filter((t) => !value[t.id]);

  return (
    <div className="flex flex-col gap-3">
      <div
        data-slot-id=""
        className="order-2 flex min-h-[6.75rem] flex-wrap items-center justify-center gap-2.5 rounded-[22px] bg-cream p-3 md:min-h-[8.5rem] md:gap-3.5"
        aria-label="Pictures to place"
      >
        {tray.length === 0 ? <p className="self-center text-sm font-semibold text-soft">All placed. Tap a picture to move it.</p> : tray.map(renderToken)}
      </div>
      <div className={`grid gap-2 md:gap-3.5 ${slots.length === 2 ? "grid-cols-2" : slots.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
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
            className={`flex min-h-[8.5rem] flex-col items-center gap-2 rounded-[22px] border-2 p-2 md:min-h-[10.5rem] md:rounded-[26px] md:p-3 ${tokens.some((t) => value[t.id] === s.id) ? "border-sage bg-sage-light" : selected ? "border-dashed border-sage bg-sage-light/50" : "border-dashed border-[#B9B2A4] bg-cream"}`}
          >
            <span className="pointer-events-none text-center text-[13px] font-black leading-tight text-sage-dark md:text-base">{s.label}</span>
            <span className="flex w-full flex-wrap justify-center gap-2" data-slot-id={s.id}>
              {tokens.filter((t) => value[t.id] === s.id).map(renderToken)}
            </span>
          </div>
        ))}
      </div>
      {!locked && <p className="order-3 text-center text-[13px] font-bold text-soft">Tap a picture, then tap where it goes. Or drag it.</p>}
    </div>
  );
}
