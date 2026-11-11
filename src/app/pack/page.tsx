"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import GeneratePanel from "@/components/GeneratePanel";
import { Search } from "lucide-react";
import { ACTIVITY_ICON, EmptyState, IconTile, Loading, PageHeader } from "@/components/ui";
import { usePack } from "@/lib/db";
import { missingKinds } from "@/lib/generate";
import { ACTIVITY_META, activityHref, hasActivity, type ActivityKind } from "@/lib/plan";
import { friendlyDay, isDue, nextDue } from "@/lib/schedule";
import { SUBJECT_LABEL } from "@/lib/types";

const ORDER: ActivityKind[] = ["watch", "teach", "cards", "quiz", "drill"];

function PackInner() {
  const id = useSearchParams().get("id");
  const pack = usePack(id);
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (pack === undefined) return <Loading />;
  if (!pack)
    return (
      <EmptyState icon={Search} title="That lesson is not here">
        <Link href="/practice" className="btn-primary">
          See all lessons
        </Link>
      </EmptyState>
    );

  const missing = missingKinds(pack);
  const due = nextDue(pack);

  return (
    <div className="space-y-4">
      <PageHeader title={pack.title} back="/practice" />
      <div className="flex flex-wrap items-center gap-2 text-sm text-soft">
        <span className="chip">{SUBJECT_LABEL[pack.subject]}</span>
        {pack.isSample && <span className="chip !bg-sky-light !text-ink">Sample</span>}
        {isDue(pack) ? <span className="chip !bg-gold-light !text-ink">Review due today</span> : due ? <span>Next review {friendlyDay(due)}</span> : <span>All three reviews done</span>}
      </div>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {ORDER.map((kind, n) => {
          const meta = ACTIVITY_META[kind];
          const ok = hasActivity(pack, kind);
          const inner = (
            <>
              <IconTile icon={ACTIVITY_ICON[kind]} size={n === 0 ? 56 : 48} tone={n === 0 ? "sage" : "sand"} />
              <span className="text-[17px] font-extrabold">{meta.label}</span>
              <span className="text-sm font-semibold text-soft">{ok ? `about ${meta.minutes} min` : "not made yet"}</span>
            </>
          );
          return (
            <li key={kind} className={n === 0 ? "col-span-2 md:col-span-4" : ""}>
              {ok ? (
                <Link href={activityHref(pack.id, kind)} className={`card flex min-h-[8rem] flex-col items-center justify-center gap-1.5 text-center ${n === 0 ? "!border-2 !border-sage" : ""}`}>
                  {inner}
                </Link>
              ) : (
                <div className="card flex min-h-[8rem] flex-col items-center justify-center gap-1.5 text-center opacity-50" aria-disabled>
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {missing.length > 0 &&
        (generating ? (
          <GeneratePanel
            packId={pack.id}
            extract={pack.extract}
            kinds={missing}
            onFinished={(r) => {
              setGenerating(false);
              setNote(r.keyMissing ? `${r.keyMissing}.` : r.failed ? "Some pieces could not be made this time. You can try again." : null);
            }}
          />
        ) : (
          <div className="card space-y-2">
            <p className="font-bold">Some pieces of this lesson are not made yet.</p>
            {note && <p className="text-sm text-soft">{note}</p>}
            <button className="btn-secondary w-full" onClick={() => setGenerating(true)}>
              Finish making this pack
            </button>
            <p className="text-xs text-soft">Needs the internet. If it asks for a passcode, a parent can enter it in Settings.</p>
          </div>
        ))}

      <details className="card">
        <summary className="cursor-pointer font-bold">Key ideas in this lesson</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {pack.extract.key_points.map((k, i) => (
            <li key={i}>{k}</li>
          ))}
        </ul>
        {pack.extract.vocabulary.length > 0 && (
          <dl className="mt-3 space-y-1 text-sm">
            {pack.extract.vocabulary.map((v, i) => (
              <div key={i}>
                <dt className="inline font-bold">{v.term}: </dt>
                <dd className="inline text-soft">{v.definition}</dd>
              </div>
            ))}
          </dl>
        )}
      </details>
    </div>
  );
}

export default function PackPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PackInner />
    </Suspense>
  );
}
