"use client";
import { ChevronLeft, Layers, MessageSquare, MonitorPlay, Pencil, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Diagram } from "@/lib/types";

export function PageHeader({ title, back, sub }: { title: string; back?: string; sub?: string }) {
  return (
    <header className="mb-4">
      {back && (
        <Link href={back} className="btn-quiet -ml-3 mb-1">
          <ChevronLeft size={18} /> Back
        </Link>
      )}
      <h1 className="h1">{title}</h1>
      {sub && <p className="mt-1 text-soft">{sub}</p>}
    </header>
  );
}

export function Loading({ label = "Getting things ready…" }: { label?: string }) {
  return <p className="py-10 text-center text-soft">{label}</p>;
}

/** A picture in a soft rounded tile. Used wherever the old design had an emoji. */
export function IconTile({ icon: Icon, size = 44, tone = "sage" }: { icon: LucideIcon; size?: number; tone?: "sage" | "sand" | "gold" | "sky" }) {
  const tones = { sage: "bg-sage-light text-sage-dark", sand: "bg-sand text-soft", gold: "bg-gold-light text-gold-deep", sky: "bg-sky-light text-sky-deep" };
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center ${tones[tone]}`} style={{ width: size, height: size, borderRadius: size * 0.32 }}>
      <Icon size={size * 0.5} strokeWidth={2.2} />
    </span>
  );
}

export const ACTIVITY_ICON: Record<string, LucideIcon> = { watch: MonitorPlay, teach: MessageSquare, cards: Layers, quiz: Pencil, drill: Zap };

/** Compact header for activity screens: back button, small lesson name, big title. */
export function ActivityHeader({ back, eyebrow, title }: { back: string; eyebrow?: string; title: string }) {
  return (
    <header className="mb-4 flex items-center gap-3">
      <Link href={back} aria-label="Back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-white text-ink lg:h-12 lg:w-12">
        <ChevronLeft size={22} strokeWidth={2.4} />
      </Link>
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="truncate text-[13px] font-bold text-soft lg:text-sm">{eyebrow}</p>}
        <h1 className="text-xl font-black leading-tight text-ink lg:text-[26px]">{title}</h1>
      </div>
    </header>
  );
}

export function EmptyState({ icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center text-center">
      <IconTile icon={icon} size={64} />
      <h2 className="mt-3 text-xl font-black">{title}</h2>
      <div className="mt-1 w-full space-y-3 text-soft">{children}</div>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <div role="status" className={`rounded-2xl px-4 py-3 text-sm ${tone === "warn" ? "bg-gold-light text-ink" : "bg-sky-light text-ink"}`}>
      {children}
    </div>
  );
}

/** Soft timer: a ring that quietly fills. No numbers counting down in red, no alarm. */
export function SoftRing({ fraction, size = 56, label }: { fraction: number; size?: number; label?: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label ?? "Time passing"}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#D8D2C6" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#3E7F70"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
    </div>
  );
}

/** Tiny inline diagram used on flashcards and picture choices. */
export function MiniDiagram({ diagram, width = 220 }: { diagram: Diagram; width?: number }) {
  if (diagram.type === "fraction_bar") {
    const parts = Math.max(1, Math.min(24, diagram.parts));
    const pw = (width - 4) / parts;
    return (
      <svg viewBox={`0 0 ${width} 54`} width="100%" style={{ maxWidth: width }} role="img" aria-label={`${diagram.shaded} of ${parts} parts shaded${diagram.label ? `, ${diagram.label}` : ""}`}>
        {Array.from({ length: parts }, (_, i) => (
          <rect key={i} x={2 + i * pw} y={2} width={pw} height={30} fill={i < diagram.shaded ? "#F2C66D" : "#fff"} stroke="#D9A53A" strokeWidth={1.5} />
        ))}
        {diagram.label && (
          <text x={width / 2} y={50} textAnchor="middle" fontSize={13} fill="#5E6C7B">
            {diagram.label}
          </text>
        )}
      </svg>
    );
  }
  const marks = diagram.marks?.length ? diagram.marks : [String(diagram.min ?? 0), String(diagram.max ?? 1)];
  const step = (width - 30) / Math.max(1, marks.length - 1);
  return (
    <svg viewBox={`0 0 ${width} 54`} width="100%" style={{ maxWidth: width }} role="img" aria-label={`Number line${diagram.highlight ? ` showing ${diagram.highlight}` : ""}`}>
      <line x1={15} y1={18} x2={width - 15} y2={18} stroke="#2B3A4A" strokeWidth={2} strokeLinecap="round" />
      {marks.map((m, i) => (
        <g key={i}>
          <line x1={15 + i * step} y1={11} x2={15 + i * step} y2={25} stroke="#2B3A4A" strokeWidth={2} />
          {m === diagram.highlight && <circle cx={15 + i * step} cy={18} r={6} fill="#F2C66D" stroke="#D9A53A" strokeWidth={2} />}
          <text x={15 + i * step} y={44} textAnchor="middle" fontSize={13} fontWeight={m === diagram.highlight ? 700 : 400} fill="#2B3A4A">
            {m}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** End-of-activity card. Praise is for the process, and the score (if any) stays small. */
export function DoneCard({ icon, title, lines, children }: { icon: LucideIcon; title: string; lines?: string[]; children?: ReactNode }) {
  return (
    <div className="card mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
      <IconTile icon={icon} size={72} />
      <h2 className="text-2xl font-black leading-tight">{title}</h2>
      {lines?.map((l, i) => (
        <p key={i} className="text-soft">
          {l}
        </p>
      ))}
      <div className="flex w-full flex-col gap-2 pt-1">{children}</div>
    </div>
  );
}
