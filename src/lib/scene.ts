// Pure logic for the visual renderer: where each element sits, and what the scene
// looks like at a given moment. No React here, so it is easy to reason about and test.
import type { Scene, SceneElement } from "./types";

export const CANVAS_W = 800;
export const CANVAS_H = 520;

export const SHADE_STEP_MS = 650; // one fraction part at a time; never faster than ~2 changes/sec
export const HOP_STEP_MS = 800;

export interface Box {
  x: number; // centre
  y: number;
  w: number;
  h: number;
}

function replaceGroups(scene: Scene): Map<string, string> {
  // Elements linked by "replace" steps take turns in one spot. Union them into a group.
  const parent = new Map<string, string>();
  const find = (a: string): string => {
    const p = parent.get(a) ?? a;
    if (p === a) return a;
    const r = find(p);
    parent.set(a, r);
    return r;
  };
  const ids = new Set(scene.elements.map((e) => e.id));
  for (const st of scene.steps) {
    if (st.action !== "replace") continue;
    const withs = Array.isArray(st.with) ? st.with : st.with ? [st.with] : [];
    for (const t of st.targets) for (const w of withs) {
      if (ids.has(t) && ids.has(w)) parent.set(find(w), find(t));
    }
  }
  const out = new Map<string, string>();
  for (const e of scene.elements) out.set(e.id, find(e.id));
  return out;
}

const slotOf = (e: SceneElement) => (e.slot === "left" || e.slot === "right" ? e.slot : "center");

export interface Canvas {
  w: number;
  h: number;
}
/** A tinted background area: the whole stage, or one side of a comparison. */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string | null;
  slot: string;
}
export const LANDSCAPE: Canvas = { w: CANVAS_W, h: CANVAS_H };
/** Taller stage for phones held upright: the two sides of a comparison stack top and bottom. */
export const PORTRAIT: Canvas = { w: 480, h: 560 };

/**
 * Lay a scene out on a canvas.
 * staticMode (reduced motion): elements that normally take turns in one spot are
 * placed side by side instead, so the slide shows every picture at once.
 */
export function layoutSceneFull(scene: Scene, staticMode: boolean, canvas: Canvas = LANDSCAPE): { boxes: Map<string, Box>; regions: Region[] } {
  const groups = replaceGroups(scene);
  type Cell = { key: string; members: SceneElement[]; order: number; slot: string; first: number };
  const cells = new Map<string, Cell>();
  scene.elements.forEach((e, i) => {
    const key = groups.get(e.id) ?? e.id;
    let c = cells.get(key);
    if (!c) {
      c = { key, members: [], order: e.order ?? 0, slot: slotOf(e), first: i };
      cells.set(key, c);
    }
    c.members.push(e);
    c.order = Math.min(c.order, e.order ?? 0);
  });
  const list = [...cells.values()].sort((a, b) => a.order - b.order || a.first - b.first);

  const allSlotted = list.length > 0 && list.every((c) => c.slot !== "center");
  const mode: "columns" | "row" | "stack" =
    scene.layout === "split" ? "columns" : scene.layout === "row" ? (allSlotted ? "columns" : "row") : "stack";

  const W = canvas.w;
  const H = canvas.h;
  const portrait = H > W;
  const padX = portrait ? 14 : 24;
  const padY = portrait ? 16 : 20;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const cellBox = new Map<string, Box>();
  const regions: Region[] = [];
  // Stack cells top to bottom. A cell that is only a word label needs less height than a picture.
  const weight = (c: Cell) => (c.members.every((m) => m.kind === "label") ? 0.45 : 1);
  const stackCells = (cs: Cell[], cx: number, top: number, w: number, h: number) => {
    const total = cs.reduce((a, c) => a + weight(c), 0) || 1;
    let y = top;
    for (const c of cs) {
      const ch = (h * weight(c)) / total;
      cellBox.set(c.key, { x: cx, y: y + ch / 2, w, h: ch });
      y += ch;
    }
  };
  const colorOf = (cs: Cell[]) => cs.flatMap((c) => c.members).find((m) => m.color)?.color ?? null;

  if (mode === "columns") {
    const cols = (["left", "center", "right"] as const).filter((s) => list.some((c) => c.slot === s));
    const names = cols.length ? cols : (["center"] as const);
    // A split scene that only uses one side still keeps that side in its half.
    // (On an upright phone the unused half would just be empty space, so it is dropped.)
    const colCount = !portrait && scene.layout === "split" && names.length === 1 && names[0] !== "center" ? 2 : names.length;
    // Upright phone: the sides become top and bottom bands, each as wide as the stage.
    const bandW = portrait ? innerW : innerW / colCount;
    const bandH = portrait ? innerH / colCount : innerH;
    for (let i = 0; i < colCount; i++) {
      const name = colCount === 2 && names.length === 1 ? (i === 0 ? "left" : "right") : names[i];
      const inCol = list.filter((c) => c.slot === name);
      regions.push({
        x: portrait ? 0 : (W / colCount) * i,
        y: portrait ? (H / colCount) * i : 0,
        w: portrait ? W : W / colCount,
        h: portrait ? H / colCount : H,
        color: colorOf(inCol),
        slot: name,
      });
      const x0 = portrait ? padX : padX + bandW * i;
      const y0 = portrait ? padY + bandH * i : padY;
      stackCells(inCol, x0 + bandW / 2, y0, bandW, bandH);
    }
  } else if (mode === "row") {
    regions.push({ x: 0, y: 0, w: W, h: H, color: colorOf(list), slot: "all" });
    // Upright phone: a long row wraps onto two lines so nothing gets squeezed.
    const lines = portrait && list.length > 3 ? 2 : 1;
    const perLine = Math.ceil(list.length / lines);
    const lineH = innerH / lines;
    list.forEach((c, i) => {
      const line = Math.floor(i / perLine);
      const inLine = line === lines - 1 ? list.length - perLine * (lines - 1) : perLine;
      const colW = innerW / inLine;
      cellBox.set(c.key, { x: padX + colW * ((i % perLine) + 0.5), y: padY + lineH * (line + 0.5), w: colW, h: lineH });
    });
  } else {
    regions.push({ x: 0, y: 0, w: W, h: H, color: colorOf(list), slot: "all" });
    stackCells(list, W / 2, padY, innerW, innerH);
  }

  const boxes = new Map<string, Box>();
  for (const c of list) {
    const box = cellBox.get(c.key)!;
    if (staticMode && c.members.length > 1) {
      const w = box.w / c.members.length;
      c.members.forEach((m, i) => boxes.set(m.id, { x: box.x - box.w / 2 + w * (i + 0.5), y: box.y, w, h: box.h }));
    } else {
      for (const m of c.members) boxes.set(m.id, box);
    }
  }
  return { boxes, regions };
}

export function layoutScene(scene: Scene, staticMode: boolean, canvas: Canvas = LANDSCAPE): Map<string, Box> {
  return layoutSceneFull(scene, staticMode, canvas).boxes;
}

export interface SceneState {
  visible: Set<string>;
  highlighted: Set<string>;
  /** How each visible element arrived, for its entrance motion. */
  motion: Map<string, string>;
  /** Shaded parts / hops to draw right now, per element. */
  progress: Map<string, number>;
}

/** What the scene looks like at time t (ms). Pass Infinity for the finished, static picture. */
export function sceneStateAt(scene: Scene, t: number, staticMode = false): SceneState {
  const ids = scene.elements.map((e) => e.id);
  const motion = new Map<string, string>();
  const highlighted = new Set<string>();
  const progress = new Map<string, number>();
  const steps = [...scene.steps].sort((a, b) => a.at_ms - b.at_ms);

  if (staticMode) {
    for (const st of steps) if (st.action === "highlight") st.targets.forEach((x) => highlighted.add(x));
    for (const e of scene.elements) progress.set(e.id, Math.max(0, e.shaded ?? 0));
    return { visible: new Set(ids), highlighted, motion, progress };
  }

  // Anything a later step will bring in starts hidden; everything else is there from the start.
  const arrivesLater = new Set<string>();
  for (const st of steps) {
    if (st.action === "show") st.targets.forEach((x) => arrivesLater.add(x));
    if (st.action === "replace") (Array.isArray(st.with) ? st.with : st.with ? [st.with] : []).forEach((x) => arrivesLater.add(x));
  }
  const visible = new Set(ids.filter((id) => !arrivesLater.has(id)));
  const started = new Map<string, number>();
  const animated = new Set<string>();
  for (const st of steps) {
    if (st.action === "shade" || st.action === "hop") st.targets.forEach((x) => animated.add(x));
  }

  for (const st of steps) {
    if (st.at_ms > t) break;
    const m = st.motion || "fade";
    if (st.action === "show") {
      st.targets.forEach((x) => {
        visible.add(x);
        motion.set(x, m);
      });
    } else if (st.action === "hide") {
      st.targets.forEach((x) => visible.delete(x));
    } else if (st.action === "replace") {
      st.targets.forEach((x) => visible.delete(x));
      (Array.isArray(st.with) ? st.with : st.with ? [st.with] : []).forEach((x) => {
        visible.add(x);
        motion.set(x, m);
      });
    } else if (st.action === "highlight") {
      st.targets.forEach((x) => highlighted.add(x));
    } else if (st.action === "shade" || st.action === "hop") {
      st.targets.forEach((x) => started.set(x, st.at_ms));
    }
  }

  for (const e of scene.elements) {
    const total = Math.max(0, e.shaded ?? 0);
    if (!animated.has(e.id)) {
      progress.set(e.id, total);
    } else if (!started.has(e.id)) {
      progress.set(e.id, 0);
    } else {
      const per = e.kind === "number_line" ? HOP_STEP_MS : SHADE_STEP_MS;
      progress.set(e.id, Math.min(total, Math.floor((t - started.get(e.id)!) / per) + 1));
    }
  }
  return { visible, highlighted, motion, progress };
}

/** Break a label into at most `maxLines` lines of roughly `maxChars` characters. */
export function wrapLabel(text: string, maxChars: number, maxLines = 2): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= maxChars) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/.{0,2}$/, "") + "…";
    return kept;
  }
  return lines;
}

export function captionFor(
  explainer: { narration_captions?: { scene_id: string; text: string }[] },
  scene: Scene,
): { onScreen: string; spoken: string } {
  const n = explainer.narration_captions?.find((c) => c.scene_id === scene.id)?.text;
  return { onScreen: scene.caption || n || "", spoken: n || scene.caption || "" };
}
