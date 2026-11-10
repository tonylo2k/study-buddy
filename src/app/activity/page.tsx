"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Cards from "@/components/play/Cards";
import DrillRun from "@/components/play/DrillRun";
import QuizRun from "@/components/play/QuizRun";
import Teach from "@/components/play/Teach";
import Watch from "@/components/play/Watch";
import { EmptyState, Loading, PageHeader } from "@/components/ui";
import { usePack, useSettings } from "@/lib/db";
import { ACTIVITY_META, hasActivity, type ActivityKind } from "@/lib/plan";

const TITLES: Record<ActivityKind, string> = {
  watch: "Watch the idea",
  teach: "Teach it back",
  cards: "Flashcards",
  quiz: "Quick quiz",
  drill: "Speed practice",
};

function ActivityInner() {
  const params = useSearchParams();
  const id = params.get("id");
  const kind = (params.get("do") ?? "") as ActivityKind;
  const pack = usePack(id);
  const { settings, ready } = useSettings();

  if (pack === undefined || !ready) return <Loading />;
  if (!pack || !(kind in ACTIVITY_META) || !hasActivity(pack, kind))
    return (
      <EmptyState emoji="🔎" title="This part is not ready yet">
        <Link href={pack ? `/pack?id=${pack.id}` : "/practice"} className="btn-primary">
          Back
        </Link>
      </EmptyState>
    );

  return (
    <div>
      <PageHeader title={TITLES[kind]} back={`/pack?id=${pack.id}`} sub={pack.title} />
      {kind === "watch" && <Watch pack={pack} settings={settings} />}
      {kind === "teach" && <Teach pack={pack} />}
      {kind === "cards" && <Cards pack={pack} />}
      {kind === "quiz" && <QuizRun pack={pack} />}
      {kind === "drill" && <DrillRun pack={pack} />}
    </div>
  );
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ActivityInner />
    </Suspense>
  );
}
