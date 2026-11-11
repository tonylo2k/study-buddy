# Study Buddy (MVP)

A calm Grade 4 study app. Photograph a homework or textbook page and it becomes a small study pack: short animated explainers, a teach-back, picture flashcards, a 5-question quiz, a 5-minute speed practice, and a weekly practice test that ends with a personal careless-mistakes checklist.

English only. Everything the child does is stored in the browser (IndexedDB); there is no account and no backend database.

## Setup

Requires Node 20 or newer.

```bash
cp .env.example .env.local      # then paste your key into .env.local
npm install
npm run dev                     # http://localhost:3000
```

`.env.local`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
# Optional:
# ANTHROPIC_MODEL=claude-sonnet-5-5   # any vision-capable Sonnet
# EXPLAINER_CAP=4                     # explainers per lesson, 1-5
# FAMILY_PASSCODE=                    # optional locally, required on a public deployment (see below)
```

The key is read only by the server routes under `src/app/api/`. It is never sent to the browser. If it is missing, those routes answer 503 with “Ask Tony to add ANTHROPIC_API_KEY to .env.local”, and Settings shows “Configured: no”.

To try it on a phone, run `npm run dev -- -H 0.0.0.0` and open `http://<your-computer-ip>:3000` on the same Wi-Fi. Camera capture and offline caching need HTTPS on phones, so for real use deploy it (next section).

## Putting it on the internet (Vercel)

1. Push this folder to a GitHub repo (private is fine; `.env.local` is git-ignored).
2. In Vercel, create a project from that repo.
3. Add two environment variables, then deploy:
   - `ANTHROPIC_API_KEY`
   - `FAMILY_PASSCODE`: a shared secret for the family. Make it long; four random words is good.
4. Open the site on each device, go to Parent → Settings, and enter the passcode once. It is remembered on that device.
5. In the Anthropic Console, set a monthly spend limit on the key as a backstop.

### How the family passcode works

Every route that spends API credits (`extract`, `generate`, `teachback-feedback`, `classify-mistake`, `practice-test`) checks the `x-family-passcode` header against `FAMILY_PASSCODE` before doing anything else.

| Situation | Result |
|---|---|
| `FAMILY_PASSCODE` set, correct passcode sent | Request proceeds |
| Set, passcode missing or wrong | 401, “Enter the family passcode in Parent → Settings” |
| Not set, running locally | Open, so `npm run dev` needs no extra setup |
| Not set, running on Vercel | 503. A public deployment refuses to make lessons until a passcode exists |
| 10 wrong tries from one address in 10 minutes | 429 for the rest of that window |

Limits to know about:

- It is one shared secret. Anyone you give it to can use your credits until you change it. To change it, edit the variable in Vercel, redeploy, and re-enter it on each device.
- The wrong-try limit is kept in server memory, so on serverless hosting it only slows guessing rather than stopping it. The length of the passcode and the spend limit on the key are what actually protect you.
- The passcode is stored in the browser's localStorage on each device. “Delete all data” removes it.
- It protects the API key, not the child's data. Her data never leaves her device in the first place.
- Elsewhere than Vercel, set `REQUIRE_PASSCODE=1` to get the same “refuse if no passcode is set” behaviour.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server (this is where offline caching is active) |
| `npm run typecheck` | TypeScript check |
| `npm run prompts` | Regenerates `src/lib/server/prompts.generated.ts` from `prompts/*.md`. Run after editing a prompt. |

## Trying it without a photo or a key

Parent tab → Developer tools → **Load sample pack**. This loads the golden examples from `sample-data/`:

- *Intro to Fractions* (full pack + the fractions explainer)
- *Local Products and Community Life* (full pack + the map explainer)
- *Weather vs Climate* (explainer only; with a key, “Finish making this pack” generates the rest from its extract)

**Make reviews due today** (same place) pulls every lesson's next review forward so the 80% rule can be tried without waiting a day. The practice test screen has **Build from saved questions**, which works with no key and no network.

## How it fits together

```
Snap (camera/file) → compressImage() in the browser (resize, re-encode, EXIF dropped)
   → POST /api/extract          prompts/01
   → Confirm content (edit title, subject, key ideas)
   → POST /api/generate × 5     prompts/03, 04, 05, 08, 09 (one request per kind, in parallel)
   → pack saved in IndexedDB, reviews scheduled at D+1, D+3, D+7
   → Watch → Teach back → Flashcards → Quiz → Speed practice
   → mistake tags → My Careless Mistakes Checklist → weekly practice test
```

| Path | What lives there |
|---|---|
| `src/app/` | Screens: `/` Today, `/practice`, `/pack`, `/activity`, `/snap`, `/test`, `/checklist`, `/parent`, `/parent/settings` |
| `src/app/api/` | `extract`, `generate`, `teachback-feedback`, `classify-mistake`, `practice-test`, `status` |
| `src/components/VisualExplainerPlayer.tsx` | Timeline (play, pause, replay, 0.5×/1×/1.5×), caption bar, optional read-aloud, reduced-motion step-through |
| `src/components/VisualSceneRenderer.tsx` | SVG renderer for a scene: icon, label, fraction bar, number line, map region, arrow, shape |
| `src/lib/scene.ts` | Pure layout and “what is on screen at time t” logic |
| `src/lib/icons.tsx` | **IconRegistry**: the one allowlist of `icon_id` values |
| `src/lib/db.ts` | Dexie schema: `settings`, `lessonPacks`, `attempts`, `mistakes`, `practiceTests` |
| `src/lib/schedule.ts` | D+1 / D+3 / D+7 and the 80% rule |
| `src/lib/server/` | Claude call with one “JSON only” retry, the validators for every schema, and the family passcode check (`auth.ts`) |
| `prompts/` | Prompt templates, used verbatim |
| `sample-data/` | Golden examples |

### One layout, three shapes

`src/components/AppShell.tsx` picks the navigation by screen width:

| Width | Navigation | Notes |
|---|---|---|
| Under 768 px (phone) | Floating tab bar at the bottom | Hidden inside an activity, so the picture gets the screen |
| 768–1023 px (iPad upright) | Slim icon rail on the left | |
| 1024 px and up (iPad sideways) | Full side menu | Shrinks to the rail inside an activity |

Today, Watch and Teach use the extra width (right-hand column, chapter list, two panes). The other screens stay a comfortable reading width. The explainer stage uses a taller canvas on phones (`PORTRAIT` in `src/lib/scene.ts`), where the two sides of a comparison stack top and bottom.

### Visual explainers

The model returns a scene-spec JSON (PRD §9.7). No image or video model is called and no media file is stored. Notes on how the renderer reads a spec:

- Elements that a `show` or `replace` step brings in start hidden; everything else is visible from the start.
- Elements linked by `replace` share one spot and cross-fade. With Reduce motion on they are laid side by side instead, so the still slide shows them all.
- `shade` fills a fraction bar one part at a time; `hop` walks a number line one hop at a time.
- Speed scales the clock. No fade is ever shorter than 200 ms.
- Unknown `icon_id` → the spec's emoji; no emoji → a dashed box with the label. Unknown element kinds render as a label.
- Reduce motion (the in-app setting or the device's own setting) swaps the player for Back / Next slides with the same captions.

If you add an icon, add it in `src/lib/icons.tsx` **and** in the allowlists in `prompts/08_visual_explainer.md` and `prompts/09_visual_flashcards.md`, then run `npm run prompts`.

### Decisions worth knowing about

- **IndexedDB via Dexie**, as the brief recommends. No disagreement.
- **Explainers are requested one per key point, in parallel** (first 4 key points by default, `EXPLAINER_CAP` to change). A single response holding five explainers takes too long to meet the “playable within about a minute” goal. The prompt text is unchanged; one extra line names the key point.
- **A quiz taken before its review is due counts as extra practice** and does not move the schedule. On a due review, 80% or higher advances; lower repeats the next day.
- **Short answers are matched leniently** (case, punctuation, numbers). On a quiz, a short answer marked wrong has a “My answer means the same thing” button, because exact matching on free text is unfair without the model.
- **The checklist always shows three items**: her top habits (last 30 days, at least 2 tags each), topped up from a starter list until she has three of her own.
- **Photos**: resized in the browser, sent once for reading, held in server memory for that request only. With “Keep a small photo thumbnail” on, a 160 px thumbnail is stored on the device; the full photo never is.
- **Drag to match** also works by tap-then-tap, which is easier for small hands and for keyboard users.
- **No parent PIN** on the Parent tab. The PRD does not ask for one. The family passcode is a different thing: it guards the API key, not the Parent screens.

## Acceptance checklist

Checked in a headless browser against the production build, using the sample packs and a stand-in for the Claude API:

- All three sample explainers play start to finish (46–50 s); pause holds, replay restarts, speeds change the pace
- Reduce motion (setting and device preference) gives step-through slides, same captions, no animation
- Unknown `icon_id` values fall back safely in explainers and flashcards
- Flashcards show a picture and caption; quiz renders pick-the-picture and drag-to-match; teach-back arranges picture tokens
- Quiz: early = practice only; due and under 80% = repeat tomorrow; due and 80%+ = advance
- Speed practice ends softly at 300 s and compares only with her own best
- Mistake tags are saved; the top habits appear in the practice test's checking phase
- Practice test: skip, return to skipped, checking phase with checklist, process flags saved
- Missing key gives the 503 setup message; the key does not appear in the client bundle
- Family passcode: every credit-spending route refuses without it (401), accepts with it, locks after 10 wrong tries, and refuses outright on Vercel when none is set; neither passcode nor key appears in the client bundle
- Delete all data empties every IndexedDB table
- After one online visit to the production build, saved packs, explainers and practice work offline
- Photo → extract → confirm → generate → saved pack, including the one-retry path for malformed model output

**Not yet checked, needs a real key and a real page:**

- Extraction quality on a real textbook or worksheet photo
- Whether live model output meets the counts (8–12 cards, exactly 5 questions, 20+ drill items) on the first try, and how the explainers it writes actually look
- Time from photo to first playable explainer
- Read-aloud voice quality on the target phone
