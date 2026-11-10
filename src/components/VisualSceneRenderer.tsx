"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ICON_REGISTRY } from "@/lib/icons";
import { CANVAS_H, CANVAS_W, layoutScene, sceneStateAt, wrapLabel, type Box } from "@/lib/scene";
import type { Scene, SceneElement } from "@/lib/types";

const PALETTE: Record<string, { fill: string; soft: string; stroke: string }> = {
  sky: { fill: "#8CC4E0", soft: "#E6F2F8", stroke: "#5FA5C8" },
  blue: { fill: "#6FA8D6", soft: "#E3EEF8", stroke: "#4B8DB8" },
  navy: { fill: "#5B6FA3", soft: "#E7EAF4", stroke: "#3F5187" },
  gold: { fill: "#F2C66D", soft: "#FBF0D5", stroke: "#D9A53A" },
  green: { fill: "#8FC7A3", soft: "#E3F2E8", stroke: "#5FA57A" },
  gray: { fill: "#B5BFCA", soft: "#EEF1F4", stroke: "#8A97A6" },
  rose: { fill: "#E9A9B8", soft: "#FAECEF", stroke: "#D98BA4" },
  sage: { fill: "#7FB5A8", soft: "#DDEDE8", stroke: "#4F8F80" },
};
const pal = (c?: string | null) => PALETTE[c ?? ""] ?? PALETTE.sage;
const INK = "#2B3A4A";

/** Pick a font size so the longest word fits the cell, then wrap. Keeps neighbours from colliding. */
function fitLabel(text: string, width: number, ideal: number): { size: number; maxChars: number } {
  const longest = Math.max(...text.split(/\s+/).map((w) => w.length), 1);
  const size = Math.max(16, Math.min(ideal, Math.floor((width - 6) / (longest * 0.54))));
  return { size, maxChars: Math.max(longest, Math.floor((width - 10) / (size * 0.56))) };
}

function Lines({ text, y, size, maxChars, weight = 600, fill = INK, maxLines = 2 }: { text: string; y: number; size: number; maxChars: number; weight?: number; fill?: string; maxLines?: number }) {
  const lines = wrapLabel(text, Math.max(6, maxChars), maxLines);
  return (
    <text textAnchor="middle" fontSize={size} fontWeight={weight} fill={fill}>
      {lines.map((l, i) => (
        <tspan key={i} x={0} y={y + i * size * 1.2}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

/** Icon → Lucide if allowlisted, else emoji, else a labeled rounded shape. Never throws. */
function Picture({ el, size }: { el: SceneElement; size: number }) {
  const entry = el.icon_id ? ICON_REGISTRY[el.icon_id] : undefined;
  if (entry) {
    const { Icon } = entry;
    const tint = el.color && PALETTE[el.color] ? PALETTE[el.color].stroke : entry.tint;
    return <Icon x={-size / 2} y={-size / 2} width={size} height={size} color={tint} strokeWidth={1.6} aria-hidden />;
  }
  if (el.emoji) {
    return (
      <text textAnchor="middle" dominantBaseline="central" fontSize={size * 0.82} aria-hidden>
        {el.emoji}
      </text>
    );
  }
  return (
    <g aria-hidden>
      <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={16} fill="#fff" stroke="#C9D2DA" strokeWidth={2} strokeDasharray="6 5" />
      <text textAnchor="middle" dominantBaseline="central" fontSize={size * 0.4} fill="#8A97A6">
        ?
      </text>
    </g>
  );
}

function IconEl({ el, box }: { el: SceneElement; box: Box }) {
  const hasLabel = Boolean(el.label);
  const size = Math.max(48, Math.min(box.w * 0.5, box.h * (hasLabel ? 0.5 : 0.7), 150));
  const fit = fitLabel(el.label || "", box.w, 25);
  const labelH = hasLabel ? fit.size * 2.4 : 0;
  const cy = -labelH / 2;
  return (
    <g>
      <g transform={`translate(0 ${cy})`}>
        <Picture el={el} size={size} />
      </g>
      {hasLabel && <Lines text={el.label!} y={cy + size / 2 + fit.size * 1.3} size={fit.size} maxChars={fit.maxChars} maxLines={3} />}
    </g>
  );
}

function LabelEl({ el, box }: { el: SceneElement; box: Box }) {
  const text = el.label || "";
  const p = pal(el.color);
  const lines = wrapLabel(text, Math.max(8, Math.floor((box.w - 60) / 14.5)));
  const w = Math.min(box.w - 20, Math.max(...lines.map((l) => l.length), 4) * 15 + 48);
  const h = 24 + lines.length * 31;
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2 > 26 ? 22 : h / 2} fill={p.soft} stroke={p.stroke} strokeWidth={2} />
      <Lines text={text} y={-(lines.length - 1) * 15.6 + 9} size={26} weight={700} maxChars={Math.floor((box.w - 60) / 14.5)} />
    </g>
  );
}

function FractionBarEl({ el, box, shaded }: { el: SceneElement; box: Box; shaded: number }) {
  const parts = Math.max(1, Math.min(24, Math.round(el.parts ?? 1)));
  const p = pal(el.color);
  const bw = Math.min(box.w - 80, 620);
  const bh = Math.max(36, Math.min(76, box.h * 0.34));
  const pw = bw / parts;
  return (
    <g>
      {el.label && <Lines text={el.label} y={-bh / 2 - 18} size={28} weight={700} maxChars={30} />}
      {Array.from({ length: parts }, (_, i) => (
        <g key={i}>
          <rect x={-bw / 2 + i * pw} y={-bh / 2} width={pw} height={bh} fill="#fff" stroke={p.stroke} strokeWidth={2} />
          <motion.rect
            x={-bw / 2 + i * pw}
            y={-bh / 2}
            width={pw}
            height={bh}
            fill={p.fill}
            stroke={p.stroke}
            strokeWidth={2}
            initial={false}
            animate={{ opacity: i < shaded ? 1 : 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          />
        </g>
      ))}
      <text textAnchor="middle" y={bh / 2 + 32} fontSize={22} fill="#5E6C7B">
        {shaded} of {parts} shaded
      </text>
    </g>
  );
}

function NumberLineEl({ el, box, hops }: { el: SceneElement; box: Box; hops: number }) {
  const parts = Math.max(1, Math.min(20, Math.round(el.parts ?? 1)));
  const p = pal(el.color || "navy");
  const lw = Math.min(box.w - 110, 620);
  const step = lw / parts;
  const x0 = -lw / 2;
  return (
    <g>
      <line x1={x0} y1={0} x2={x0 + lw} y2={0} stroke={INK} strokeWidth={3} strokeLinecap="round" />
      {Array.from({ length: parts + 1 }, (_, i) => (
        <line key={i} x1={x0 + i * step} y1={i === 0 || i === parts ? -14 : -9} x2={x0 + i * step} y2={i === 0 || i === parts ? 14 : 9} stroke={INK} strokeWidth={i === 0 || i === parts ? 3 : 2} />
      ))}
      <text x={x0} y={48} textAnchor="middle" fontSize={26} fontWeight={700} fill={INK}>0</text>
      <text x={x0 + lw} y={48} textAnchor="middle" fontSize={26} fontWeight={700} fill={INK}>1</text>
      {Array.from({ length: Math.max(0, el.shaded ?? 0) }, (_, i) => (
        <motion.path
          key={i}
          d={`M ${x0 + i * step} -12 Q ${x0 + (i + 0.5) * step} ${-12 - Math.min(52, step * 0.9)} ${x0 + (i + 1) * step} -12`}
          fill="none"
          stroke={p.stroke}
          strokeWidth={3}
          strokeLinecap="round"
          initial={false}
          animate={{ opacity: i < hops ? 1 : 0 }}
          transition={{ duration: 0.45 }}
        />
      ))}
      <motion.g initial={false} animate={{ x: x0 + hops * step, opacity: 1 }} transition={{ duration: 0.5, ease: "easeInOut" }}>
        <circle r={12} fill={p.fill} stroke={p.stroke} strokeWidth={3} />
        {hops > 0 && (
          <text y={48} textAnchor="middle" fontSize={26} fontWeight={700} fill={p.stroke}>
            {hops}/{parts}
          </text>
        )}
      </motion.g>
      {el.label && <Lines text={el.label} y={-Math.min(52, step * 0.9) - 36} size={24} maxChars={36} fill="#5E6C7B" />}
    </g>
  );
}

function MapRegionEl({ el, box }: { el: SceneElement; box: Box }) {
  const p = pal(el.color);
  const w = Math.max(80, box.w - 36);
  const h = Math.max(80, box.h - 36);
  const size = Math.max(48, Math.min(w * 0.45, h * 0.4, 150));
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={36} fill={p.soft} stroke={p.stroke} strokeWidth={2} />
      <g transform="translate(0 -20)">
        <Picture el={el} size={size} />
      </g>
      {el.label && <Lines text={el.label} y={size / 2 + 18} size={27} weight={700} maxChars={Math.floor(w / 15)} />}
    </g>
  );
}

function ShapeEl({ el, box }: { el: SceneElement; box: Box }) {
  const p = pal(el.color);
  const s = Math.max(40, Math.min(box.w * 0.45, box.h * 0.45, 120));
  let shape = <rect x={-s / 2} y={-s / 2} width={s} height={s} rx={14} fill={p.soft} stroke={p.stroke} strokeWidth={2.5} />;
  if (el.shape === "circle") shape = <circle r={s / 2} fill={p.soft} stroke={p.stroke} strokeWidth={2.5} />;
  if (el.shape === "line") shape = <line x1={-s} y1={0} x2={s} y2={0} stroke={p.stroke} strokeWidth={4} strokeLinecap="round" />;
  if (el.shape === "arrow")
    shape = (
      <g stroke={p.stroke} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <line x1={-s} y1={0} x2={s} y2={0} />
        <polyline points={`${s - 16},-14 ${s},0 ${s - 16},14`} />
      </g>
    );
  return (
    <g>
      <g transform="translate(0 -16)">{shape}</g>
      {el.label && <Lines text={el.label} y={s / 2 + 18} size={25} maxChars={Math.floor(box.w / 13.5)} />}
    </g>
  );
}

function ElementBody({ el, box, progress }: { el: SceneElement; box: Box; progress: number }) {
  switch (el.kind) {
    case "icon":
      return <IconEl el={el} box={box} />;
    case "arrow":
      return <IconEl el={{ ...el, icon_id: el.icon_id || "arrow" }} box={box} />;
    case "label":
      return <LabelEl el={el} box={box} />;
    case "fraction_bar":
      return <FractionBarEl el={el} box={box} shaded={progress} />;
    case "number_line":
      return <NumberLineEl el={el} box={box} hops={progress} />;
    case "map_region":
      return <MapRegionEl el={el} box={box} />;
    case "shape":
      return <ShapeEl el={el} box={box} />;
    default:
      // "group" and anything unexpected: a picture if there is one, otherwise a plain label.
      return el.icon_id || el.emoji ? <IconEl el={el} box={box} /> : <LabelEl el={{ ...el, label: el.label || el.id }} box={box} />;
  }
}

/**
 * Draws one scene on an SVG canvas.
 * - Animated path: pass the current time `t`; steps are applied with gentle Framer Motion fades.
 * - Static path (reduced motion): pass `staticMode`; the finished picture is drawn with no motion at all.
 */
export default function VisualSceneRenderer({
  scene,
  t,
  speed = 1,
  staticMode = false,
  describedBy,
}: {
  scene: Scene;
  t: number;
  speed?: number;
  staticMode?: boolean;
  describedBy?: string;
}) {
  const boxes = layoutScene(scene, staticMode);
  const state = sceneStateAt(scene, t, staticMode);
  // Speed scales motion, but nothing is ever quicker than a 200ms fade (no flashing).
  const dur = Math.max(0.2, 0.55 / speed);
  const dividers = scene.layout === "split";

  const body = (el: SceneElement) => {
    const box = boxes.get(el.id);
    if (!box) return null;
    const hl = state.highlighted.has(el.id);
    const inner = (
      <>
        {hl && (
          <rect
            x={-Math.min(box.w - 20, 620) / 2}
            y={-Math.min(box.h - 8, 170) / 2}
            width={Math.min(box.w - 20, 620)}
            height={Math.min(box.h - 8, 170)}
            rx={24}
            fill="#FBF0D5"
            stroke="#F2C66D"
            strokeWidth={2}
          />
        )}
        <ElementBody el={el} box={box} progress={state.progress.get(el.id) ?? 0} />
      </>
    );
    if (staticMode) {
      return (
        <g key={el.id} transform={`translate(${box.x} ${box.y})`}>
          {inner}
        </g>
      );
    }
    const m = state.motion.get(el.id) ?? "fade";
    const from =
      m === "slide"
        ? { opacity: 0, x: el.slot === "right" ? 28 : -28 }
        : m === "grow"
          ? { opacity: 0, scale: 0.82 }
          : { opacity: 0 };
    return (
      <g key={el.id} transform={`translate(${box.x} ${box.y})`}>
        <motion.g
          initial={m === "none" ? false : from}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dur, ease: "easeOut" }}
        >
          {inner}
        </motion.g>
      </g>
    );
  };

  const visibleEls = scene.elements.filter((e) => state.visible.has(e.id));

  return (
    <svg
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      className="block h-auto w-full select-none rounded-3xl bg-white"
      role="img"
      aria-label={scene.title || "Picture"}
      aria-describedby={describedBy}
    >
      <rect x={1} y={1} width={CANVAS_W - 2} height={CANVAS_H - 2} rx={28} fill="#FFFDFA" stroke="#E6E0D6" strokeWidth={2} />
      {dividers && <line x1={CANVAS_W / 2} y1={36} x2={CANVAS_W / 2} y2={CANVAS_H - 36} stroke="#E6E0D6" strokeWidth={2} strokeDasharray="4 10" strokeLinecap="round" />}
      {staticMode ? visibleEls.map(body) : <AnimatePresence>{visibleEls.map(body)}</AnimatePresence>}
    </svg>
  );
}
