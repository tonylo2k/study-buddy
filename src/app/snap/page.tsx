"use client";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import GeneratePanel from "@/components/GeneratePanel";
import { Notice, PageHeader } from "@/components/ui";
import { db, uid, useSettings } from "@/lib/db";
import { PACK_KINDS } from "@/lib/generate";
import { compressImage } from "@/lib/image";
import { newSchedule } from "@/lib/schedule";
import { SUBJECT_LABEL, SUBJECTS, type Extract, type Subject } from "@/lib/types";

type Stage = "pick" | "reading" | "confirm" | "making";

export default function SnapPage() {
  const router = useRouter();
  const { settings } = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [hint, setHint] = useState<Subject | "">("");
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [extract, setExtract] = useState<Extract | null>(null);
  const [thumb, setThumb] = useState<string | undefined>();
  const [packId, setPackId] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setRawText(null);
    setStage("reading");
    try {
      const img = await compressImage(file);
      setThumb(img.thumb);
      const res = await apiFetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: img.base64, mediaType: img.mediaType, hintSubject: hint ? SUBJECT_LABEL[hint] : "" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRawText(typeof j.rawText === "string" ? j.rawText : null);
        throw new Error(j.error || "The page could not be read. Please try another photo.");
      }
      setExtract(j as Extract);
      setStage("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStage("pick");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const startGenerate = async () => {
    if (!extract) return;
    const cleaned: Extract = { ...extract, title: extract.title.trim() || "Untitled lesson", key_points: extract.key_points.map((k) => k.trim()).filter(Boolean) };
    if (cleaned.key_points.length === 0) {
      setError("Add at least one key idea first.");
      return;
    }
    setError(null);
    const id = uid();
    const now = new Date();
    // Save the lesson right away; each generated piece is added to it as it arrives.
    await db.lessonPacks.put({
      id,
      createdAt: now.toISOString(),
      subject: cleaned.subject,
      title: cleaned.title,
      extract: cleaned,
      visualExplainers: [],
      schedule: newSchedule(now),
      // The original photo is never stored. A tiny thumbnail is kept only if the parent opted in.
      photoThumbnail: settings.keepPhotosLocal ? thumb : undefined,
    });
    setExtract(cleaned);
    setPackId(id);
    setStage("making");
  };

  const setPoint = (i: number, v: string) => extract && setExtract({ ...extract, key_points: extract.key_points.map((k, n) => (n === i ? v : k)) });

  return (
    <div className="space-y-4">
      <PageHeader title={stage === "confirm" ? "Confirm content" : "Snap a lesson"} back="/practice" sub={stage === "pick" ? "A grown-up can help with this part." : undefined} />

      {error && (
        <Notice tone="warn">
          {error}
          {rawText && (
            <details className="mt-2">
              <summary className="cursor-pointer font-semibold">What came back</summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs">{rawText.slice(0, 1500)}</pre>
            </details>
          )}
        </Notice>
      )}

      {stage === "pick" && (
        <div className="card space-y-4">
          <div className="text-center text-5xl" aria-hidden>
            📷
          </div>
          <p className="text-center text-soft">Take a clear photo of one homework or textbook page (English). Flat page, good light, whole page in view.</p>
          <div>
            <label htmlFor="hint" className="text-sm font-bold">
              Subject (optional)
            </label>
            <select id="hint" className="field mt-1" value={hint} onChange={(e) => setHint(e.target.value as Subject | "")}>
              <option value="">Let Study Buddy decide</option>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {SUBJECT_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Take or choose a photo" />
          <button
            className="btn-primary w-full"
            onClick={() => {
              fileRef.current?.setAttribute("capture", "environment");
              fileRef.current?.click();
            }}
          >
            Take a photo
          </button>
          <button
            className="btn-secondary w-full"
            onClick={() => {
              fileRef.current?.removeAttribute("capture");
              fileRef.current?.click();
            }}
          >
            Choose from photos
          </button>
          <p className="text-center text-xs text-soft">
            The photo is sent once to read the page, and it is not saved{settings.keepPhotosLocal ? " (a small thumbnail stays on this device)" : ""}.
          </p>
        </div>
      )}

      {stage === "reading" && (
        <div className="card space-y-2 text-center" aria-live="polite">
          <div className="text-5xl" aria-hidden>
            🔎
          </div>
          <p className="text-lg font-bold">Reading the page…</p>
          <p className="text-soft">This takes a little while. No need to hurry.</p>
        </div>
      )}

      {stage === "confirm" && extract && (
        <div className="space-y-4">
          {extract.warnings.length > 0 && (
            <Notice tone="warn">
              <p className="font-semibold">Worth a quick look:</p>
              <ul className="list-disc pl-5">
                {extract.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </Notice>
          )}
          <div className="card space-y-3">
            <div>
              <label htmlFor="title" className="text-sm font-bold">
                Title
              </label>
              <input id="title" className="field mt-1" value={extract.title} onChange={(e) => setExtract({ ...extract, title: e.target.value })} />
            </div>
            <div>
              <label htmlFor="subject" className="text-sm font-bold">
                Subject
              </label>
              <select id="subject" className="field mt-1" value={extract.subject} onChange={(e) => setExtract({ ...extract, subject: e.target.value as Subject })}>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {SUBJECT_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="card space-y-2">
            <p className="font-bold">Key ideas</p>
            <p className="text-sm text-soft">These are what she will learn to teach back. Fix anything that looks off.</p>
            {extract.key_points.map((k, i) => (
              <div key={i} className="flex gap-2">
                <textarea className="field min-h-[3.5rem] text-sm" value={k} aria-label={`Key idea ${i + 1}`} onChange={(e) => setPoint(i, e.target.value)} />
                <button
                  className="btn-quiet shrink-0"
                  aria-label={`Remove key idea ${i + 1}`}
                  onClick={() => setExtract({ ...extract, key_points: extract.key_points.filter((_, n) => n !== i) })}
                >
                  Remove
                </button>
              </div>
            ))}
            {extract.key_points.length < 8 && (
              <button className="btn-quiet" onClick={() => setExtract({ ...extract, key_points: [...extract.key_points, ""] })}>
                + Add a key idea
              </button>
            )}
          </div>
          {extract.vocabulary.length > 0 && (
            <details className="card">
              <summary className="cursor-pointer font-bold">Words found ({extract.vocabulary.length})</summary>
              <dl className="mt-2 space-y-1 text-sm">
                {extract.vocabulary.map((v, i) => (
                  <div key={i}>
                    <dt className="inline font-bold">{v.term}: </dt>
                    <dd className="inline text-soft">{v.definition}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          <button className="btn-primary w-full" onClick={startGenerate}>
            Looks right. Make the study pack
          </button>
          <button className="btn-quiet w-full" onClick={() => setStage("pick")}>
            Try a different photo
          </button>
        </div>
      )}

      {stage === "making" && extract && packId && (
        <GeneratePanel packId={packId} extract={extract} kinds={PACK_KINDS.map((k) => k.kind)} onFinished={() => setTimeout(() => router.push(`/pack?id=${packId}`), 900)} />
      )}
    </div>
  );
}
