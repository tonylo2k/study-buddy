"use client";
import { useEffect, useState } from "react";
import { Loading, PageHeader } from "@/components/ui";
import { apiFetch, getPasscode, setPasscode } from "@/lib/api";
import { deleteAllData, saveSettings, useSettings } from "@/lib/db";
import { pickVoice, speakText, useEnglishVoices, voiceQuality } from "@/lib/voice";

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[56px] cursor-pointer items-center justify-between gap-3 py-2">
      <span>
        <span className="block font-bold">{label}</span>
        {hint && <span className="block text-sm text-soft">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="h-7 w-7 shrink-0 accent-[#4F8F80]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

const SAMPLE_LINE = "Weather is what the sky is doing today. It can change hour by hour.";

function VoicePicker({ chosen }: { chosen?: string }) {
  const voices = useEnglishVoices();
  const [showAll, setShowAll] = useState(false);
  if (voices.length === 0) return <p className="py-3 text-sm text-soft">This browser has no read-aloud voices to choose from.</p>;
  const auto = pickVoice("");
  const shown = showAll ? voices : voices.slice(0, 6);
  const row = (key: string, uri: string, name: string, note: string) => {
    const on = (chosen ?? "") === uri;
    return (
      <li key={key} className={`flex items-center gap-2 rounded-2xl border-2 p-2 ${on ? "border-sage bg-sage-light" : "border-line bg-white"}`}>
        <button type="button" role="radio" aria-checked={on} onClick={() => saveSettings({ ttsVoiceURI: uri })} className="min-h-[44px] flex-1 text-left">
          <span className="block font-bold">{name}</span>
          <span className="block text-xs text-soft">{note}</span>
        </button>
        <button type="button" className="btn-secondary !min-h-[44px] !px-3 !py-2 text-sm" onClick={() => speakText(SAMPLE_LINE, { voiceURI: uri })} aria-label={`Play a sample of ${name}`}>
          ▶ Play
        </button>
      </li>
    );
  };
  return (
    <div className="py-3">
      <p className="font-bold">Choose a voice</p>
      <p className="text-sm text-soft">These are the English voices on this device. Tap Play to hear each one, then tap its name to use it.</p>
      <ul role="radiogroup" aria-label="Read-aloud voice" className="mt-2 space-y-2">
        {row("auto", "", "Automatic", auto ? `Uses the best one found: ${auto.name}` : "Uses the device default")}
        {shown.map((v) => row(v.voiceURI, v.voiceURI, v.name, `${voiceQuality(v)} · ${v.lang}`))}
      </ul>
      {voices.length > 6 && (
        <button type="button" className="btn-quiet mt-1" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Show fewer" : `Show all ${voices.length} voices`}
        </button>
      )}
      <p className="mt-2 text-xs text-soft">
        Want better ones? On iPhone or iPad, download an “Enhanced” or “Premium” English voice in Settings → Accessibility → Read &amp; Speak → Voices (called Spoken Content on older iOS; or search Settings for “Voices”). On Android, update or
        install Google’s speech services. New voices show up here after reopening the app.
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, ready } = useSettings();
  const [name, setName] = useState("");
  const [key, setKey] = useState<"checking" | "yes" | "no" | "unknown">("checking");
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<string>("checking");
  const [confirm, setConfirm] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    if (ready) setName(settings.childDisplayName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  const checkStatus = () =>
    apiFetch("/api/status")
      .then((r) => r.json())
      .then((j) => {
        setKey(j.configured ? "yes" : "no");
        setCodeState(typeof j.passcode === "string" ? j.passcode : "unknown");
      })
      .catch(() => {
        setKey("unknown");
        setCodeState("unknown");
      });
  useEffect(() => {
    setCode(getPasscode());
    void checkStatus();
  }, []);

  const CODE_LABEL: Record<string, string> = {
    checking: "checking…",
    not_required: "Not required here (no FAMILY_PASSCODE is set on this server)",
    ok: "Accepted",
    missing: "Needed. Enter it below",
    wrong: "Not accepted. Check the spelling",
    locked: "Too many wrong tries. Wait ten minutes",
    not_configured: "This deployment has no FAMILY_PASSCODE yet, so lessons cannot be made",
    unknown: "Could not check (offline?)",
  };

  if (!ready) return <Loading />;

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" back="/parent" />

      <section className="card space-y-2">
        <label htmlFor="name" className="font-bold">
          Child’s display name
        </label>
        <div className="flex gap-2">
          <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          <button className="btn-primary" disabled={name.trim() === settings.childDisplayName} onClick={() => saveSettings({ childDisplayName: name.trim().slice(0, 30) })}>
            Save
          </button>
        </div>
        <p className="text-sm text-soft">Only a first name is stored, and only on this device.</p>
      </section>

      <section className="card divide-y divide-line">
        <Toggle
          label="Reduce motion"
          hint="Show explainers as still slides with Back and Next. The device’s own reduce-motion setting is always respected too."
          checked={settings.reducedMotion}
          onChange={(v) => saveSettings({ reducedMotion: v })}
        />
        <div className="py-3">
          <p className="font-bold">Explainer speed</p>
          <div role="radiogroup" aria-label="Explainer speed" className="mt-2 flex gap-2">
            {([0.5, 1, 1.5] as const).map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={settings.explainerSpeed === s}
                onClick={() => saveSettings({ explainerSpeed: s })}
                className={`min-h-[44px] flex-1 rounded-2xl border-2 font-bold ${settings.explainerSpeed === s ? "border-sage bg-sage-light text-sage-dark" : "border-line bg-white text-soft"}`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
        <Toggle label="Narration voice" hint="Reads the captions aloud with this device’s built-in voice. Captions are always on screen either way." checked={settings.ttsEnabled} onChange={(v) => saveSettings({ ttsEnabled: v })} />
        {settings.ttsEnabled && <VoicePicker chosen={settings.ttsVoiceURI} />}
        <Toggle label="Keep a small photo thumbnail" hint="Off by default. The full photo is never stored; it is only sent once to read the page." checked={settings.keepPhotosLocal} onChange={(v) => saveSettings({ keepPhotosLocal: v })} />
      </section>

      <section className="card space-y-2">
        <label htmlFor="passcode" className="font-bold">
          Family passcode
        </label>
        <p className="text-sm">
          Status: <span className="font-bold">{CODE_LABEL[codeState] ?? codeState}</span>
        </p>
        {codeState !== "not_required" && (
          <div className="flex gap-2">
            <input id="passcode" type="password" className="field" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
            <button
              className="btn-primary"
              onClick={() => {
                setPasscode(code);
                setCodeState("checking");
                void checkStatus();
              }}
            >
              Save
            </button>
          </div>
        )}
        <p className="text-sm text-soft">Stops anyone outside the family from using the API key. It is remembered on this device, so it only needs entering once.</p>
      </section>

      <section className="card space-y-1">
        <h2 className="font-bold">Anthropic API key</h2>
        <p className="text-sm">
          Status:{" "}
          <span className="font-bold">
            {key === "checking" ? "checking…" : key === "yes" ? "Configured: yes" : key === "no" ? "Configured: no" : "Could not check (offline?)"}
          </span>
        </p>
        <p className="text-sm text-soft">
          The key lives in <code>.env.local</code> on the server and is never shown or sent to this screen.
          {key === "no" && " Ask Tony to add ANTHROPIC_API_KEY to .env.local, then restart the app."}
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-bold">Delete all data</h2>
        <p className="text-sm text-soft">Removes every lesson, attempt, mistake tag, practice test, and setting from this device, including the saved passcode. This cannot be undone.</p>
        {deleted ? (
          <p className="font-bold text-sage-dark" role="status">
            All data has been deleted.
          </p>
        ) : confirm ? (
          <div className="flex gap-2">
            <button
              className="btn-primary flex-1 !bg-ink"
              onClick={async () => {
                await deleteAllData();
                setPasscode("");
                setCode("");
                setName("");
                setConfirm(false);
                setDeleted(true);
              }}
            >
              Yes, delete everything
            </button>
            <button className="btn-secondary flex-1" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn-secondary w-full" onClick={() => setConfirm(true)}>
            Delete all data
          </button>
        )}
      </section>
    </div>
  );
}
