# CASE CLOSED

*Because "It Depends" isn't an answer.* 😏

**Duolingo for consulting and PM interviews.** An interactive web app where MBA / consulting / PM
candidates practise **India-focused** market-sizing guesstimates, business cases and product
**decision simulations**. An AI interviewer guides the first two with Socratic questions, escalating
hints (never the answer early) and a detailed evaluation; the third is played against a
deterministic causal model that answers with consequences rather than a mark.

It is built **local-first / zero-key**: it runs and is fully usable with **no external services** —
a local SQLite database, dev auth, and a deterministic offline "mock" interviewer. Real
Supabase / OpenAI / Anthropic / Stripe swap in purely through environment variables, with no code
changes.

---

📊 **[Architecture & visual documentation](docs/ARCHITECTURE.md)** — system diagram, user flow,
data model (ERD), LLM adapter sequence, evaluation rubric, and gamification/rank flow.

📝 **[Changes](docs/CHANGES.md)** — recent fixes: priced help modes, case authoring, and other
scoring/integrity corrections.

🔁 **[Retention](docs/RETENTION.md)** — why a finite library is not the reason people leave,
and the four levers (mastery, a daily loop, leagues, cheap content) that would keep them.

🏃 **[Scrum simulator plan](docs/SCRUM_SIMULATOR.md)** — a design spec for teaching agile with the
existing simulation engine: Scrum's ceremonies mapped onto the engine's tick, a Product Owner who
decides rather than obeys, and both a solo and a classroom mode.

🎤 **[Pitch deck kit](docs/PITCH_DECK.md)** — a 16-slide spec (headline, visual, speaker notes
per slide) plus the prompts to generate the deck, for pitching what this is and where it's going.

---

## Quick start

```bash
cp .env.example .env   # Prisma needs DATABASE_URL; .env is gitignored, so a clone has none
pnpm install
pnpm db:push           # create the SQLite database from prisma/schema.prisma
pnpm db:seed           # 18 categories, 65 questions (30 guesstimates + 10 cases + 25 simulations), achievements, demo users
pnpm dev               # http://localhost:3000
```

The `.env` step is easy to skip and confusing when you do: the app itself defaults
`DATABASE_URL` (`lib/config/env.ts`), but `prisma/schema.prisma` does not, so it is the
`db:*` commands that fail rather than the site.

**pnpm settings live in `pnpm-workspace.yaml`, not in `package.json`.** pnpm 11 stopped
reading the `package.json#pnpm` field, and it does not fail loudly when it goes missing —
it warns, drops every key and carries on. That takes the build-script allowlist with it,
so nothing is allowed to run an install script and pnpm exits with
`ERR_PNPM_IGNORED_BUILDS`. If you meet that error after running `pnpm dev` rather than
`pnpm install`, they are the same error: `dev` runs a dependency check that shells out to
`install`, so the message names the command you did not type.

The build settings are written twice in that file on purpose. pnpm 11 did not move
`onlyBuiltDependencies` and `ignoredBuiltDependencies`, it **removed** them in favour of
an `allowBuilds` map, while `overrides` survived unchanged — so on pnpm 11 the override
applies while the allowlist beside it silently does nothing, and the file looks like it
is being read because it is. `allowBuilds` covers pnpm 11+, the legacy pair covers
pnpm 10.6–10.x, and the two lists have to be kept in step.

**The database is not in the repo** — `prisma/dev.db` is gitignored, as a binary build
artifact should be. All the content lives in `prisma/seed-data.ts`, so an empty question
library means the seed hasn't been run, not that the questions are missing.

**Pulling a branch that changed the schema?** Run `pnpm db:push && pnpm db:seed` — the push adds
the new columns in place and keeps your local data. `pnpm db:reset` also works and is what you want
if the schema drifted badly, but it drops and rebuilds, so local attempts and sign-ups are
discarded.

Then walk the flow: **landing → Start practising (guest, no login) → practice → submit →
evaluation → sign up to save**. Or sign in with the seeded accounts:

| Account | Email | Password |
|---|---|---|
| Demo user | `demo@caseclosed.app` | `demo1234` |
| Admin | `admin@caseclosed.app` | `admin1234` |

**Testing a locked catalogue? Not with these two.** `demo` and `prof` are seeded with a live
Pro pass, re-asserted on every `pnpm db:seed` (`prisma/seed.ts`), and Pro means `content: "all"`
— the daily unlock never applies to them, so the library correctly looks wide open. Use a plain
account you signed up yourself, or `admin@caseclosed.app`, which is deliberately left on the
free tier so both sides of the gate are reachable on a fresh install.

**Deploying publicly?** These passwords are in this file, so change them before the URL goes
out — `admin` in particular opens the whole admin panel. Changing them by hand sticks:
`passwordHash` is written only when the account is first created, never on a re-seed. Roles and
Pro passes *are* re-asserted every time, so a re-seed puts demo and prof back on Pro.

Useful scripts: `pnpm typecheck` · `pnpm build` · `pnpm test` · `pnpm db:reset`.

---

## Enabling a real LLM (add a key)

By default the interviewer runs on an **offline deterministic mock** (great for demos/tests, no
cost). To use a real model, it's a **config change, not a code change**:

1. Get a free Gemini key from [Google AI Studio](https://aistudio.google.com/apikey) — no card required.
2. `cp .env.example .env.local` and add `GEMINI_API_KEY=...`.
   Optionally set `LLM_PROVIDER` and `LLM_MODEL`.
3. Restart the dev server.

The adapter (`lib/llm/index.ts`) auto-detects the provider from the key, streams replies
token-by-token, and **falls back to the mock** when the provider is unavailable. Anthropic and
OpenAI also work (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY`) but neither has a free tier. Keys stay
**server-side** only.

### NVIDIA NIM

`NVIDIA_API_KEY` points the interviewer at the hosted catalogue on
[build.nvidia.com](https://build.nvidia.com). It is OpenAI-compatible, so `lib/llm/nvidia.ts` is
the same forty lines of JSON as every other adapter — no SDK, like the rest of `lib/llm`.

Two things to know:

- **It wins the auto-detection race, ahead of Gemini.** That is deliberate, and it is silent when
  it is wrong: a machine holding both keys answers perfectly well on NVIDIA while you think you
  are spending Gemini's free tier. Set `LLM_PROVIDER` explicitly if you keep more than one.
- **Pick the model deliberately.** `NVIDIA_MODEL` takes the namespaced id from the model's page
  (`meta/llama-3.1-8b-instruct`), kept separate from the shared `LLM_MODEL` so a name belonging to
  another provider is never sent here. The default is a floor, not a recommendation — the
  catalogue is large and moves.

It is metered like any hosted provider, so the spend guards in `lib/config/practice.ts` apply. If
you were hoping to reach NVIDIA by pointing `OLLAMA_BASE_URL` at it, that does not work: the
Ollama adapter deliberately sends no `authorization` header, and NVIDIA needs a bearer token.

To keep sessions running on a local model when NVIDIA is out of credit, rate limited or returning
nothing, put one behind it with `LLM_FALLBACK_PROVIDER=ollama` — see
[Keeping a second engine behind the first](#keeping-a-second-engine-behind-the-first).

### Know the free-tier ceiling before you deploy

Gemini's free-tier limits are **per API key, so they're shared by every user of the deployment** —
not per user. At the time of writing that's **250 requests/day** on `gemini-2.5-flash`
(`gemini-2.5-flash-lite` gives 1,000 for somewhat weaker instruction-following). A practice session
runs 10–20 turns, so a free key supports roughly **12–25 sessions per day in total**. Check the
[current limits](https://ai.google.dev/gemini-api/docs/rate-limits) — Google has cut them before.

The app is built to hit that ceiling gracefully rather than break:

- **Two spend guards** in `lib/config/practice.ts` (`llmBudget`) — a per-user hourly cap so one
  candidate can't drain the day's budget, and a deployment-wide daily cap set below the real limit.
- **Exceeding either degrades to the mock**, badged "offline interviewer" in the chat, instead of
  erroring mid-session. Same for a rate limit or an outage.
- Raise `llmBudget` when you move to a paid tier or a higher-quota model.
- **How much the model may write** is `llmOutput` in the same file, and it is two budgets
  because the modes are two lengths of thing. An ordinary turn — a Socratic question, a hint,
  the war room's bullets — gets `visibleAnswerTokens`, sized to the "2–4 sentences" those
  prompts already ask for. **Teacher mode gets `teacherAnswerTokens`**, because it is the one
  mode asked to work the problem end to end and a walkthrough truncates at the width a question
  fits in. Raise whichever one is arriving cut off mid-word; they move independently on purpose.

**A reasoning model costs more than it looks.** Its private deliberation is billed against the
same ceiling as the answer, and the app strips those `<think>` blocks before rendering — so a
student never sees them and the deployment still pays. That is why `llmOutput` carries a second
number, `reasoningHeadroomTokens`, for the providers that cannot be told to stop (NVIDIA's flag
is advisory, and Gemini Pro has none); Gemini's flash models genuinely switch it off and get the
answer budget alone. If the bill looks high on NVIDIA, the lever is `NVIDIA_MODEL` — a
non-reasoning model — well before it is the cap.

Also note free-tier prompts and responses may be used to improve Google's models — worth
disclosing if you run this publicly.

### Developing against a local model (Ollama)

250 requests/day disappears quickly when you're debugging the practice flow, and the free tier
is not always reliable. **Ollama** runs a model on your own machine instead — free, unmetered,
offline, and again a config change rather than a code change:

```bash
curl http://localhost:11434        # expect "Ollama is running"
ollama pull qwen2.5:7b
echo 'LLM_PROVIDER=ollama' >> .env.local
pnpm dev
```

On **Windows and macOS the server is already running** — the installer starts it at login and
it sits in the tray, so `ollama serve` fails with "only one usage of each socket address is
normally permitted" (or "address already in use"). That error means it's up, not broken. Run
`ollama serve` yourself only on Linux or a headless box, where nothing started it for you.

`OLLAMA_MODEL` picks the model (kept separate from `LLM_MODEL`, which is shared by every
provider, so a leftover `gemini-2.5-flash` isn't sent to Ollama). `OLLAMA_BASE_URL` points at
any OpenAI-compatible local server — LM Studio, vLLM — not just Ollama's default
`http://localhost:11434/v1`. Unlike the hosted providers, Ollama is **never auto-detected**:
there is no key to sniff for, so it has to be asked for by name, and no stray env var can
point a deployment at a localhost model that isn't there.

Three things worth knowing:

- **A local model is not a stand-in for Gemini's judgement.** The Socratic prompts in
  `lib/llm/prompts.ts` lean hard on never revealing the answer early, and a 7B model breaks
  that rule more often than Gemini does. Use it to exercise the wiring, streaming, persistence
  and fallback paths — not to judge how good the interviewer is.
- **It is slow without a GPU.** Replies stream token-by-token so you see progress, but a full
  turn takes tens of seconds. `OLLAMA_MODEL=llama3.2` is roughly 2.5x smaller and much faster.
- **The spend guards are skipped**, since a local model draws on no shared quota. Otherwise
  they'd substitute the mock partway through a session and you'd be testing the wrong thing.

If Ollama isn't running or the model was never pulled, the turn falls back to the mock like any
other provider failure — so watch for the "offline interviewer" badge, and check the server log,
which names the fix (`is ollama serve running?` / `run ollama pull <model>`).

### Keeping a second engine behind the first

`LLM_FALLBACK_PROVIDER` names an engine to try when the configured one cannot answer, so a turn
NVIDIA can't serve reaches a real model instead of the offline mock:

```bash
LLM_PROVIDER=nvidia
LLM_FALLBACK_PROVIDER=ollama
```

The chain is **provider → fallback → mock**, and each link is tried only when the one in front of
it produces no text at all: a rejected key, spent credits, a rate limit that survives its one
retry, an unreachable host, or a `200` that streams nothing back. Any provider name works on
either side — `gemini` in front of `ollama` walks the same code — and naming the same provider
twice, or `mock`, is ignored, since neither adds a link the chain doesn't already have.

Four things worth knowing:

- **Nothing changes unless you set it.** Unset — the shipped default — the mock is the only
  stand-in, exactly as before.
- **It is never auto-detected**, for the reason Ollama itself isn't: a fallback silently routes
  real student turns to a different engine, so it has to be asked for by name. Pointing it at a
  local server that happens to be down just costs one failed request before the mock.
- **A reply that has already started streaming is never finished by the other engine.** Falling
  forward mid-paragraph would change voice and reasoning halfway through an answer the student is
  already reading, which is worse than an obviously truncated one — so that turn is marked
  `interrupted` and stops. The chain only ever helps *before* the first token.
- **Stand-in turns are labelled**, in the chat as a "backup model" badge (distinct from the mock's
  "offline interviewer") and in `Message.provider` as `ollama (fallback)` — so a turn the fallback
  answered is never recorded as one NVIDIA did.

The spend guards follow the engine actually being asked. A metered fallback behind a local
primary turns them **on** (`LLM_PROVIDER=ollama` + a hosted fallback bills real money the moment
the local server goes down), and a *blocked* budget now degrades to an unmetered fallback rather
than to the mock — a local model draws on none of the quota being protected, so it is a strictly
better answer than the offline one.

---

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind + shadcn-style UI ·
Framer Motion · Prisma (SQLite dev → Postgres/Supabase prod) · Recharts · Vitest.

---

## Look and feel

**One theme, and it is dark.** Near-black surfaces, an electric cyan accent, a tight grotesk and
sharp corners. There is no light mode and no toggle: a second palette is a second thing to keep
looking right, for nobody.

Everything routes through tokens, which is why the whole product changed colour without a
component being touched:

- **`app/globals.css` holds one `:root` palette.** `tailwind.config.ts` maps every Tailwind colour
  to it, and the Recharts callers read the same variables (`hsl(var(--primary))`), so the graphs
  followed too. Across `app/` and `components/` there are exactly two hardcoded colours, both
  modal scrims.
- **One number controls the cornering.** `--radius` is `0.25rem`, and `rounded-xl`/`2xl`/`3xl` are
  derived from it in the Tailwind config rather than left on Tailwind's defaults — otherwise the
  nineteen places using them would stay soft while everything around them sharpened.
  `rounded-full` is untouched, because a pill with a 4px corner is a rectangle.
- **`--primary-foreground` must stay dark.** The accent is bright enough that white on it is
  unreadable, and every filled button in the app is `bg-primary text-primary-foreground`. A test
  pins it (`tests/theme.test.ts`).
- **Printing still goes to white.** The evaluation report is a document people hand over, so
  `@media print` flips the whole surface set — cards, borders, muted text and the signal colours,
  not just the page. With no light palette left to fall back on, anything it forgot would print as
  a dark grey panel.

### The logo, redrawn as vector

The mark is a magnifier with a chess king inside it, over a stacked `CASE` /
stamped `CLOSED` wordmark — the supplied artwork, rebuilt as SVG in the theme's
colours (its amber is our accent) rather than dropped in as a raster. A PNG logo
is soft at the sizes it appears at most — a 28px header, a 16px tab — heavy
everywhere else, and cannot follow the accent if the palette ever moves.

It exists in three forms, which is the ordinary answer for a logo that has to
work from a browser tab to a sign-in page rather than a compromise:

| Form | Where | What it drops |
|---|---|---|
| `components/brand-lockup.tsx` | Sign-in pages | Nothing — mark, wordmark, stamp, padlock, tagline |
| `components/brand.tsx` | Every header | The stacked wordmark; one line of type beside the mark |
| `app/icon.svg` | Browser tab | The king — a figure inside the lens is 4px tall at 16px |

**The words are HTML, not paths.** We already ship a heavy grotesk
(`font-display`), so setting real text keeps the logo crisp on every screen,
selectable and translatable, without a second copy of the alphabet in the bundle.

**The tab icon inverts on purpose.** In the app the accent is the stroke on a
near-black page; in the tab it is the *fill*, because a browser paints the icon
against its own chrome — dark for about half of everyone — and a near-black mark
disappears into a dark tab strip. It also carries literal colours rather than
tokens, since a favicon lives outside the document and can read neither our CSS
variables nor the page it belongs to. Keep it in step with `brand-mark.tsx` by
hand.

### The fonts are in the repo on purpose

Inter for body, **Inter Tight** for headings (applied to every `h1`–`h3` by one rule in
`globals.css`, not by a class on each heading), loaded with `next/font/local` from `app/fonts/`.

Self-hosted rather than `next/font/google` because that fetches at build time, and a project that
advertises "no external services" should not need the network to rebuild.

**Each face ships twice, and the second file is not a mistake.** Google's `latin` subset does not
contain U+20B9 — the rupee sign — which appears on nearly every screen here. It lives in
`latin-ext`, so both subsets are declared and both sit in the Tailwind font stack; the browser
resolves per glyph, taking ₹ from the second file and everything else from the first. Listing two
`src` entries in one `@font-face` would *not* do this: multiple sources there are fallbacks for a
failed download, not for a missing glyph.

---

## Where to change common things

| I want to… | Edit |
|---|---|
| Add / edit questions and cases | Admin panel (`/admin`), CSV/JSON import, or `prisma/seed-data.ts` |
| Add / edit a decision simulation | `lib/sim/scenarios/` + a row in `lib/sim/registry.ts` and `prisma/seed-data.ts` |
| Retune a simulation's numbers without a deploy | Admin panel → **Simulations** (see below) |
| Tune simulation scoring / bands | `lib/config/simulation.ts` |
| Retune the analytics windows and thresholds | `lib/admin-analytics.ts` (`QUIET_AFTER_DAYS`, `RETURN_WINDOWS`, `ACTIVITY_WINDOW_DAYS`, `EXHAUSTION_THRESHOLD`) |
| Change the interviewer's behaviour / wording | `lib/llm/prompts.ts` |
| Tune XP, levels, streak rules | `lib/config/gamification.ts` |
| Change rank percentile bands (Silver→Diamond) | `lib/config/gamification.ts` (`rankBands`) |
| Adjust evaluation rubric weights / readiness bands | `lib/config/evaluation.ts` |
| Change hint count / panel defaults | `lib/config/practice.ts` |
| Change what a tutorial teaches | `components/practice/tutorial-tour.tsx` (practice), `components/simulation/war-room-tour.tsx` (war room) — both are step lists over one shell, `components/tour/guided-tour.tsx` |
| Change what each tier reaches | `lib/config/access.ts` (`tierAccess`) |
| Give a specific question away on the free tier | Admin panel → **Questions** → the lock button |
| Grant or revoke a Pro pass | Admin panel → **Users** → +30 / +90 / Revoke |
| Change the pass lengths | `lib/billing.ts` (`PRO_PASS_DAYS`) |
| Add a college to the picker | `lib/config/colleges.ts` |
| Change avatar size / quality / limits | `lib/config/profile.ts` (`avatarLimits`) |
| Store avatars somewhere other than the DB | `AVATAR_STORE` + a file in `lib/storage/` |
| Change what the post-signup step asks | `components/onboarding/welcome-steps.tsx` |
| Change what a question may contain | `lib/question-schema.ts` (one contract for admin + import) |
| Swap the LLM provider | env vars (`LLM_PROVIDER`, `*_API_KEY`) |
| Use NVIDIA NIM's hosted models | `NVIDIA_API_KEY` + `NVIDIA_MODEL` (see above) |
| Develop against a free local model | `LLM_PROVIDER=ollama` + `OLLAMA_MODEL` (see above) |
| Keep a second engine behind the first | `LLM_FALLBACK_PROVIDER=ollama` (see above) |
| Tune LLM rate/spend limits | `lib/config/practice.ts` (`llmBudget`) |
| Change the voice-input language | `lib/config/practice.ts` (`speechConfig.lang`) |
| Add an achievement | `prisma/seed-data.ts` + award rule in `lib/gamification.ts` |

**Architecture principles:** central typed config (no magic numbers), pluggable adapters behind
interfaces, content-as-data, one data-access module per domain (`lib/questions`, `lib/progress`),
pure & unit-tested rule functions (`lib/evaluation`, `lib/gamification`).

---

## India-only content

All seeded questions use Indian context — cities, markets, demographics, companies and ₹. Ideal
ranges and sample solutions use Indian reference figures. Admin-added and imported questions should
follow the same convention (the import panel shows a reminder).

---

## Voice input

The chat composer has a mic button: click to start dictating, click again to stop. Text lands in
the box as you speak and **nothing sends by itself** — recognition mishears names and numbers
often enough that auto-sending would post a mangled answer and have it scored. Edit, then Enter.

It uses the browser's built-in Web Speech API, so there is no key, no cost and no dependency —
the same zero-key stance as the rest of the app. Two limitations are worth stating plainly:

- **Chrome or Edge only.** Firefox doesn't implement the API; the button renders disabled there
  and says why rather than quietly going missing.
- **The audio leaves your machine.** Chrome transcribes on Google's servers, so this one feature
  isn't offline the way everything else is. That's exactly why it sits behind a
  `SpeechRecogniser` interface (`lib/speech/types.ts`): a self-hosted transcriber behind
  `/api/transcribe` closes the gap without any call site changing, the same way Ollama closed it
  for the interviewer. `lib/speech/index.ts` documents what such a provider needs.

The language is `en-IN` (`lib/config/practice.ts`, `speechConfig`), and that isn't cosmetic —
every question here is India-focused, and `en-US` transcribes "two lakh" as "two lack".


## Voice output

Every interviewer reply carries a small speaker button, and the chat header has a toggle that
reads new replies aloud as they arrive, plus a speed control. Both settings persist.

It uses the browser's built-in `speechSynthesis` — no key, no cost, no dependency, the same
zero-key stance as voice input. Two things are worth knowing, and the first contradicts what
you just read above:

- **This is NOT Chrome-and-Edge-only.** `SpeechRecognition` (input) is; `speechSynthesis`
  (output) is implemented in Firefox and Safari too. Voice output reaches browsers voice input
  cannot, so don't carry the dictation caveat over to it.
- **Auto-speak waits for the reply to finish.** Replies stream token by token, and speech
  queues whole utterances, so speaking each delta would stutter and interleave. It also only
  fires for turns that streamed in front of you — reopening an attempt does not read the whole
  past transcript aloud, and switching between the Interviewer and Teacher tabs does not read
  the other conversation's last turn.

The voice is chosen automatically for `en-IN` where the platform has one, falling back to any
English voice and then to the platform default (`speechConfig.lang`, `lib/config/practice.ts`).
There is no voice picker on purpose: the installed list differs wildly per OS, so a dropdown
looks broken on a machine with one voice. Speed is the setting people actually change, and
that one is exposed.

What gets spoken is the text as rendered, not as the model wrote it — `toSpeakableText`
reuses the same normalisation the bubble uses, so LaTeX, markdown markers and any reasoning
block are gone before anything is said. Emoji are dropped too (a hint is stored as
"💡 Hint 3: …" and would otherwise be read as "light bulb"), while ₹ and × are deliberately
kept, since a sizing answer read without them is unintelligible.

---

## Profile, and what it's for

An account has a profile at `/profile`, reachable from the avatar in the header: photo, name,
batch, phone, city, a short bio, background (student or professor, experience), goals, and a
password change. Signing up lands on `/welcome`, a two-step version of the same
questions that is **skippable in one click except for the batch** — see below. A dashboard nudge
asks once more about the rest, and "Not now" is a real dismissal rather than a banner that comes
back tomorrow.

**Only one section changes what the app does, and it says so.** Target roles reuse
`INTERVIEW_LEVELS` — the same vocabulary the library already filters by — so they aren't a
survey answer, they're a filter:

- `recommendQuestions` runs preference passes, sharpest first: weakest category *at* a target
  level, then the level alone, then the weak category, then anything. The level passes are
  skipped entirely when no goals are set, so the personalisation is a **provable no-op** for
  anyone who never filled in a profile.
- A bare visit to `/library` pre-applies a target level, announces that it did, and clears in
  one click — for the session, so the Clear button doesn't look broken. It only fires with
  **exactly one** target: `?level=` holds a single value, so applying one of three would show
  someone a third of what they asked for while claiming to have used their goals. Two or more
  targets get one-click chips instead.

Everything else on the page is display-only, and the copy says that too rather than implying
the phone number does something.

### One campus, so nobody is asked which

`INSTITUTION_NAME` in `lib/config/profile.ts` is the whole college model: this runs for
**IIM Visakhapatnam**, so the institution is a constant rather than a question. The curated
60-college list, `User.collegeId`, the written-in "Other" and the college line on every
leaderboard row are all gone — a field whose answer is the same for everyone is a question that
costs a signup step and a column that says nothing.

What survives is the constant, because the copy still has to name the campus: "your official
IIM Visakhapatnam email address" is the entire check on a password reset. A second campus would
be a bigger change than editing that line, and deliberately so — it needs the question, the
column and the row back.

### Batch is the one required answer

`lib/config/batches.ts` holds the two PGP years — **PGP-1 (2026–28)** and **PGP-2 (2025–27)** —
and `User.batch` stores the id. Every leaderboard row prints it, and with the college gone it is
the only affiliation a row carries: the board answers not just who is ahead, but whether they are
your year or the year above.

Because a blank there is a row nobody can read, this is the single field the app will not let
you past. It is enforced twice, deliberately:

- `profileCoreSchema` requires it, so `/welcome` and `/profile` refuse a save without one and a
  hand-rolled POST gets the same refusal. `skipOnboarding` refuses too — the "Skip for now"
  button is hidden until a batch is picked, but hiding a button is a courtesy, not a control.
- `requireBatch` (`lib/batch-gate.ts`) redirects a signed-in account with no batch to `/welcome`
  from `/dashboard`, `/library`, `/simulations`, `/practice/[attemptId]` and `/simulate/[runId]`.
  That is what catches accounts created before the field existed; validation alone never reaches
  them, because they never submit the form again.

Two exemptions, both load-bearing. **Guests are never gated** — a class joins a room as guests by
design, so gating them would break `/join` and `/room/[code]`, and a guest is filtered off every
board anyway. **`/admin`, `/host` and `/profile` are not gated** — an admin who cannot open the
admin panel cannot fix whatever locked them out, and a professor should not meet a form
mid-lecture.

The years are display text; the id (`pgp1`, `pgp2`) is what a row stores. A batch rolling over is
a label edit in that one file, never an id change — an id carrying a year would orphan a cohort's
worth of rows every September.

### Professor is a request, not a dropdown

Occupation has two values, Student and Professor, and **picking Professor grants nothing**. It
stamps `User.professorRequestedAt` — a request — and the admin panel's Users tab badges it and
offers Approve (the existing "Make professor" button) or Decline. `role` is the grant and no
action a person can reach ever writes it; a dropdown that did would hand any student the
classroom console and the roster of names, emails and scores behind it.

A stored request rather than reading "did they pick Professor?" off the profile, because a
decision needs a state: a declined request inferred from a display field comes back as pending on
every admin visit, forever. Declining leaves their occupation exactly as they wrote it — that is
a sentence about who they are, not an access claim to correct.

### Locked out: the reset path

There is no reset email, so the flow is a person:

1. The student writes to the address on `/forgot-password` **from their official college email
   address** — that address is the only check, and the page says so. It is an admin-editable
   setting (Admin → Daily → Password-reset contact), not a constant, because it is somebody's
   mailbox and mailboxes change hands.
2. The admin clicks the key icon on their row in Admin → Users. The password becomes **the
   account's own email address**, and the reply tells them so.
3. `mustChangePassword` is set in the same write, so `requirePasswordChange`
   (`lib/password-gate.ts`) lets that account reach `/set-password` and nothing else until it
   picks a real password — which cannot be their email again.

That gate is deliberately wider than `requireBatch`: the batch gate exempts `/admin`, `/host` and
`/profile` so nobody is locked out of the surface that fixes their problem, and this one exempts
nothing, because the way out needs no permission and the point is that a guessable password opens
nothing at all.

### Where an avatar actually goes

Zero-key by default, like everything else. The browser centre-crops to a square, scales to
256px and encodes JPEG before anything is uploaded — about 30 KB instead of the 4 MB that came
out of a phone — so there is no `sharp`, no upload middleware and nothing to install.

None of that is a control. `lib/avatar.ts` re-reads the type **out of the bytes**
(`sniffImageMime`) rather than trusting the data URI's declared mime, and caps the size before
decoding. That matters because the image is served back from our own origin with the type we
stored, so "it says it's a JPEG" is not good enough. SVG is refused outright: it's a document
that can carry script, not an image.

The bytes sit behind `AvatarStore` (`lib/storage/`), the same shape as `lib/speech` and
`lib/llm`. `put()` returns a **URL**, which is the entire seam — the built-in `db` provider
returns `/api/avatar/<id>?v=<n>` and the route serves the row; an S3 provider would return a
CDN address; `User.image` stores whichever and no call site can tell. The version in the query
string is what makes an `immutable` cache header truthful: a replaced photo is a new URL.

`User.image` holds a URL and never bytes, and that isn't tidiness — `getSessionUser()` returns
the whole `User` row on every page in the app, so an avatar there would be serialised into
every payload the app sends. Everything else profile-shaped lives on a separate `Profile`
table for the same reason.

---

## Three exercise types

A **guesstimate** ends in a number and is scored against an ideal range. A **case** ends in a
recommendation and is scored on whether the candidate's issue tree localised the declared root
cause. `answerModeFor(type)` in `lib/types.ts` is the fork between those two; everything downstream
branches on that rather than on `type`.

Both are authored through the same contract (`lib/question-schema.ts`), used by the admin panel
and the CSV/JSON importer alike — download the CSV template from the import panel for a worked
example of each. A case can't be saved with an ideal range, and a guesstimate can't be saved with
a root cause; a malformed `rootCause` is a save error rather than a case that silently can't
score Diagnosis.

A **simulation** is not answered at all — it is played. See below.

**A guesstimate's report names what it is talking about.** The band a strong answer lands in is
shown next to the number the candidate committed to, and every observation quotes their own work:
which step's branches added to more than the whole, which box holds something that isn't a figure,
how far out the answer landed and in which direction. A miss that lands within a quarter of a
round power of ten — 10×, 100×, 1000× — is called what it almost always is, a unit slip rather
than a judgement error, because re-doing the reasoning reproduces it exactly. Every deduction is
priced in the sentence that names it (`buildFeedback` in `lib/evaluation.ts`), which the war room's
debrief already did and the practice report did not: sibling shares over 100% and a tree the
judge could not read both moved the score silently. The list is ordered by impact and capped, so
what a weak attempt reads first is what cost it most, and the authored "consultant's angle" always
closes it.

A fourth thing exists and is deliberately not on this list: an **Arena** match is not an exercise,
it is a game against three rivals that answer back, it is scored on its own rubric, and it is
granted per account rather than reached by a tier. See [The Arena](#the-arena).

---

## Tiers: what each one reaches

Access is a property of a **tier**, not of the user row:

| Tier | Who | Reaches |
|---|---|---|
| `guest` | no account (or a guest session) | questions flagged `freeTier` |
| `free` | a registered account | the same questions, plus saved progress, streaks, rank and a profile |
| `pro` | a live pass (`User.proUntil > now`) | the whole library |

Plus one thing that is **not** a tier: sitting in a classroom room opens that room's single
question — a war room or a guesstimate — and nothing else, for as long as the room is open. See
[Classroom rooms](#classroom-rooms).

The free set is **one of each format** — one guesstimate, one case and one simulation. Today
those are chai in Bangalore, the food-delivery margin case, and the Kadak Coffee war room: the
most inviting of each kind rather than the first of each kind. Widening it is the admin
panel's per-question toggle, not a code change.

### Pro is a deadline, not a subscription

`User.proUntil` is a single nullable timestamp, and `tierFor()` compares it against *now*.
That one decision removes most of what a paid tier usually drags in: **there is no renewal job,
no cron, no "cancel" flow, and no stored label that can drift out of date.** A pass that ran
out an hour ago is simply not greater than now, so the account is back on the free tier —
verified by backdating a pass and watching the library re-lock with nothing having run.

Granting a pass **extends** rather than resets (`nextProUntil` in `lib/billing.ts`), because
resetting to `now + 30` would confiscate whatever was left on exactly the action the buyer is
watching.

**Nothing is purchasable yet** — no payment gateway is wired up. Passes are granted from
**Admin → Users**, which is where a checkout webhook will eventually call the same
`grantPro` action. That is deliberate sequencing: the entitlement half is complete and
testable before any money moves, and the app stays zero-key.

`lib/entitlements.ts` is the whole rule and is pure, so **the library card and the server gate
call the same function** — a card can never offer something `startAttempt` then refuses. The
card is a courtesy; `startAttempt` and `startSimulation` are the control, and a hand-rolled
Server Action call with a locked question id gets bounced to `/library?wall=locked` like any
other.

The tier table is why turning the paywall on was a one-line change to
`lib/config/access.ts` rather than an audit of every gate. Adding a payment gateway is the
same shape: verify a signature, call `grantPro`, and nothing else moves.

Which questions are free is authored, not derived — `Question.freeTier`, seeded in
`prisma/seed-data.ts` and toggled per question from **Admin → Questions**. It is deliberately
*not* part of the authoring contract in `lib/question-schema.ts`: whether a question is good
and whether it is given away are different decisions, and folding the flag into
`toQuestionColumns` would mean every admin edit and every CSV re-import silently relocked the
shop window. It is also the only control that works on a simulation, whose catalogue row the
question form refuses to edit.

Guests may **replay** their three as often as they like. The old caps — three submitted
attempts, one simulation run — are gone: two walls with two different messages meant a guest
could be turned away from a question they had never opened, and the reason to sign up is
saving your work rather than a play counter.

Seeded so both sides are reachable on a fresh clone: `demo@caseclosed.app` carries a 30-day
pass and sees everything; `admin@caseclosed.app` has none and hits the paywall. A re-seed
re-asserts both, so a pass granted while testing doesn't leave you without an account that can
see the locked state.

---

## Decision simulations

A war room. The candidate reads an analytics dashboard, commits to a hypothesis *before* spending
anything, buys data pulls out of a budget of analyst-days, names a root cause, and splits a
quarter of engineering capacity and a rupee budget across candidate fixes. The next periods are
then projected forward and reported as **moved metrics — orders, retention, margin — rather than as
a mark**. A debrief reveals the true causal chain and compares the candidate's allocation to the
best available one.

**You spend against the cause you named.** Naming it is its own step and it locks: from that point
the board shows only the fixes that address it, and nothing else can be bought. Diagnosing the
wrong branch and then funding the right fix anyway used to score full marks on decision and
outcome, which is not how the decision works anywhere else. Where a cause is one nothing can fix —
a monsoon, a competitor's launch — holding the capacity is the answer, and the quarter plays out
as if nobody acted, because on that reading nobody usefully could.

**Two things teach the screen, and they are different things.** The concept primer opens on
arrival with the scenario's vocabulary — ROAS, contribution margin, plain English before the
formula — and is reopenable from the header all run. The **tutorial** beside it walks the run
itself: the four phases and that they only move forward, the analyst-day budget and what going
past par costs, what the free board already answers, and the five dimensions the run is graded on,
read off the format so the card cannot drift from the scorer. It opens once per run and waits for
the primer to close rather than stacking on top of it, and "don't show this again" is remembered
for good. Steps for a phase the run has not reached keep their words and lose their pointer, so a
candidate at Observe still learns what Decide will ask of them.

A finished run can be **played again** from the debrief or its card, and an unfinished one resumes
from where it stopped. Only a first result is ever ranked, and the replay says so before it starts
rather than after the budget is gone.

War rooms live at **`/simulations`**, not in the library. They used to be a filtered view of it,
which put a four-phase exercise with its own budget in the same grid as a twenty-minute
guesstimate and implied the two were interchangeable. They have their own leaderboard for the same
reason: a war room is scored on a different rubric, so adding its score to a practice score — which
the cumulative board used to do — produced a number that measured nothing.

Twenty scenarios ship today, easiest first — which is the order the library shows them in, except
that a track stays contiguous rather than being broken up to keep the difficulties in line. Eleven
teach product and marketing economics; four are an **analytics track**, filed under Data &
Analytics; four are a **finance track**, filed under Finance — one per financial statement, then a
capstone on the decision the three of them equip you to take; and the last is the catalogue's only
**turnaround**, a different exercise from everything above it. A twenty-first simulation, the
buyback contract, runs on its own multi-period simulator rather than as a war room — see below.

The **finance track** is a sequence too. Kirti teaches a candidate to read a P&L; Nirmal shows them
that statement cannot say whether the company can pay anybody; Deccan adds the capital neither of
the first two can see. Pragati is the capstone, and the only one whose question is about a decision
that has not been taken yet — which is why it turns on the *incremental* return on capital rather
than the average return Deccan teaches. An average return grades what a company has already built;
an incremental one is the forecast for the next rupee, and they can point in opposite directions.

The **analytics track** is a sequence rather than four scenarios that share a subject. Rangoli
teaches a candidate to read one comparison; Sahyog shows them that a comparison between groups
somebody else chose is not a comparison at all; Chalo shows them what happens to a p-value when you
ask fourteen questions instead of one; Kavach moves from reading a number to reading a classifier,
where every headline metric can be computed correctly and still be the wrong metric. All four sit
together at the easy end, ahead of the finance block.

| Scenario | Level | Teaches |
|---|---|---|
| **Kadak Coffee** — ROAS 4.0 and losing money | Easy | CPM, impressions, CTR, conversion, AOV, CAC, ROAS, ROI — and that a campaign only breaks even once ROAS clears 1 ÷ gross margin |
| **Rangoli** — the test says +6%, ship it Monday? | Easy | A/B tests, sample size, significance, novelty effect, confounded variants — and reading a test on the metric that pays the bills |
| **Sahyog Finance** — the best agency got 60% of the book, and recovery fell | Easy | Group means against group variance, between- and within-group spread (the ANOVA idea), confounding, ageing buckets — and that a ranked league table can be a mix table wearing a performance table's clothes |
| **Chalo Fitness** — fourteen ways to read one test, and the one that said yes | Easy | Multiple comparisons, family-wise error, Bonferroni, optional stopping, statistical power — and that "not significant" and "no effect" are different statements |
| **Kavach Pay** — 99.4% accurate, and payment success is falling | Easy | The confusion matrix, class imbalance, precision against recall, why precision cannot be carried across a rebalanced test set, threshold as a cost decision, calibration — and that a flag does not have to mean allow or decline |
| **Vyapar Mitra** — 38% more signups, the same 11,000 paying shops | Easy | Activation against acquisition, funnel arithmetic, ARPU, CAC and payback — and how to spot a **bottleneck**, a step whose fixed capacity decides the output however much arrives at it |
| **Padhai Plus** — growing subscribers, growing burn | Easy | Churn, lifetime, LTV, CAC, payback, and that a subscriber base settles at joiners ÷ churn |
| **Chaska** — share up five points, profit down a third | Easy | Net realisation, trade promotion, incrementality, cannibalisation — and why market share is a diagnostic rather than a target |
| **Kirti Apparel** — revenue up 22%, profit down 62% | Easy | Reading a P&L: revenue, COGS, gross margin, opex, EBITDA, depreciation, net profit — and that a consolidated statement is an average of two businesses until you split it like-for-like |
| **Nirmal Pipes** — a record profit and no money for payroll | Easy | Cash flow and working capital: DSO, DIO, DPO, the cash conversion cycle, and the one plank bridging EBITDA to cash |
| **Deccan Ceramics** — record EBITDA, and the bank wants a word | Medium | The balance sheet: current and quick ratios, debt to equity, interest cover, ROCE and the DuPont split — and that refinancing and a rights issue both fix a ratio and move the return by nothing |
| **Pragati Precision** — record EBITDA, and the CEO wants a hundred crore more | Hard | Capital allocation: incremental return against average return, cost of capital and the economic spread, interest cover against debt service cover — and that the number which decides the next rupee is not the one on the pitch deck |
| **Suraksha Home** — match the competitor's price cut? | Medium | Contribution per unit, break-even volume on a price change, price elasticity, trade promotion |
| **Ujala Solar** — planned 10.8 lakh, sold 4.3 lakh | Medium | TAM / SAM / SOM, and channel economics on net rather than gross revenue |
| **Ghar Sewa** — both sides grew, both sides are angry | Medium | Match rate, liquidity, utilisation, GMV, take rate — and that a platform-level average hides the only markets that matter |
| **Sehat Plus** — 87% availability on 24% more stock | Medium | Fill rate, service level, safety stock, coefficient of variation, inventory turns and stockout cost — and that one service level across items with different demand variability is the same error as a national average |
| **Setu** — shipped the whole roadmap, retention fell | Medium | Prioritising by value at risk rather than request volume, revenue concentration, NRR, opportunity cost — and that a demand signal can be precise and unrepresentative at once |
| **Lekha** — our best customer wants 18% off | Medium | ARR, cost to serve, seats vs usage pricing, NRR, and total cost of ownership from both sides of the table |
| **NukkadEats** — orders down 9%, nobody knows why | Medium | Metric-drop diagnosis with the model hidden — the original, and the hardest |
| **Nayi Disha** — four quarters of cash and a ₹3 crore hole | Medium | A **turnaround**: net burn, runway, and that a cut which lands after the horizon reads as free unless the projection outlives the decision |

Plus one that is not a war room at all:

| Simulation | Level | Teaches |
|---|---|---|
| **Buyback contract** — twelve months against a supplier who is watching | Medium | Ordering under a buyback clause: over-ordering is covered until the supplier reprices it, so the clause is a relationship rather than a term sheet |

**Every scenario but one teaches the vocabulary first.** Each carries a `teaching` block: a concept
primer that opens before the run and reopens from the header, and a **metric map** derived from the
driver graph showing how every number is built from the ones under it, with live values. Showing
the map is opt-in per scenario, and that gate matters in both directions — on NukkadEats, Lekha and
Setu the *shape* of the model is part of what the candidate has to work out, so the map stays hidden
while the primer still ships. Pragati hides it for the same reason: on the finance capstone, finding
that a return splits into a margin and a turnover — and that the marginal one is a different number
from the average — is the exercise.

`difficulty` is enforced rather than promised: `validateScenario` rejects an `Easy` scenario with
more than six drilldowns, more than five interventions, a cause tree deeper than one level, a
punishing budget, or no primer. Note what is *not* on that list any more — how many causes are on
the board. Every war room owes eight to ten, parents included, whatever its difficulty, so Easy and
Medium are separated by how much a candidate must hold at once rather than by how much there is to
read.

Three rules apply to every war room, and they are the ones to know before authoring one:

- **Eight to ten causes, parents counted** (`CAUSE_BOARD`). Fewer and the board can be cleared by
  elimination — buy most of the pulls, rule out four, and the remainder is the answer without a
  hypothesis ever being formed. More and it is a reading exercise. At most three may be named
  (`maxSuspects`), and hedging is priced: `tests/sim-score.test.ts` pins that one confident pick
  beats three across every board width the app allows.
- **Every pull costs the same** — two analyst-days. Mixed pricing made a candidate weigh what a
  pull would rule out *and* what it cost, and only the first is the exercise. A budget is therefore
  a count of questions, which is also what makes the overspend penalty legible: buying past par
  sharpens the investigation ratio and takes points off the overall score, disclosed on the report.
- **A dashboard has to be worth reading** (`DASHBOARD_FLOOR`). Minimum reported metrics and panels,
  met with decoys — true, correctly derived, and off the causal path. Denser, deliberately not
  harder: a decoy must never introduce a concept, only the judgement of what to ignore.

Four things are worth knowing before you touch it:

- **Content is code, with the driver graph overridable.** A scenario lives in `lib/sim/scenarios/`,
  registered in `lib/sim/registry.ts`, which is also the order the library shows them in (easiest
  first). Nothing queries into it, the causal model needs compile-time id checking a JSON column
  can't give, and it survives `db:reset`. **Adding a scenario still needs a deploy**; since the
  Simulations tab landed, *retuning one's numbers* does not — see below. The catalogue row in
  `prisma/seed-data.ts` is a normal `Question` whose `externalId` matches the scenario `slug`, which
  is what gets it library filters, search and bookmarks for free.
- **It never writes an `Attempt` or an `Evaluation`.** `updateProgress` and `recomputeRank` read
  those tables directly, so separate tables mean simulation results *structurally* cannot move
  interview readiness or percentile rank — there is no exclusion filter to forget. Simulations do
  earn XP and keep a streak alive.
- **Outcomes are deterministic and authored.** Metrics are a small DAG (`lib/sim/drivers.ts`); only
  `input` drivers can be moved by an intervention and the rest are derived, so a scenario cannot
  claim a cost fell and a margin that didn't move. Effects compose multiplicatively, so allocation
  order can't matter, and `SimResult.outcomeJson` is pinned at commit — retuning content later
  cannot rewrite a past report.
- **The answer is server-side until it is earned.** `lib/sim/redact.ts` builds the client object
  field by field, so a field added to a scenario is absent from the RSC payload until someone
  deliberately adds it there. `tests/sim-redact.test.ts` asserts against the serialised payload.

Balance is tested, not asserted: `checkBalance` in `lib/sim/balance.ts` brute-forces every
affordable combination of interventions and reports anything that beats the scenario's declared
`bestAllocation`. Retune an effect and that is what tells you the scenario now teaches the wrong
lesson. `tests/sim-scenario.test.ts` runs it over every authored scenario; the admin save path runs
it over the proposed one.

### Retuning a scenario from the admin panel

**Admin → Simulations** edits a scenario's *driver graph* — baselines, constants, labels, and the
wiring between them — without a deploy. Two views of the same thing: a table for changing numbers,
and the whole graph as JSON for adding, removing or re-wiring drivers.

**Code stays the default.** The scenarios in `lib/sim/scenarios/` are what ships. Saving writes a
`SimScenarioOverride` row keyed by slug; resetting deletes it, and the scenario tracks the code
again. The app runs correctly against an empty table, the test suite goes on exercising the real
authored numbers, and a bad edit is undone by deleting a row rather than by restoring a backup.
Only `drivers` is overridable — causes, drilldowns, interventions and copy stay in code.

Every save is checked against the *merged* scenario, and refused if any of three fail:

1. **Shape** — a Zod parse of `SimDriver[]`, so an `input` with no baseline or a `1e999` that would
   turn every derived driver into `NaN` never reaches the column.
2. **Structure** — `validateScenario`, so an edit that renames a driver an intervention effect
   targets, orphans a `reported` metric, or introduces a cycle is caught.
3. **Balance** — `checkBalance`, because `bestAllocation` is the ceiling outcome scores normalise
   against. An edit that lets some other affordable allocation beat it would leave the scenario
   rendering and scoring perfectly while grading against a ceiling that is not the top. This is the
   check that used to belong to CI, and it is the reason runtime editing is safe.

Loading re-checks 1 and 2 and **falls back to the authored scenario** if either fails, so a code
change that moves something a stored override still points at degrades one scenario to its shipped
version instead of taking out the page. The editor flags any override in that state, with the
reason. (Balance is not re-run per load — it costs 2^n outcome projections; the editor's **Check**
button re-runs all three on demand.)

The debrief coach is optional. The authored debrief is the product; with no API key the same
follow-up questions are answered from the scenario's `coachFallback` by the mock, using the same
matcher that serves a case's `dataPack`.

**Both speak in bullets, in plain words.** `strongAnswer` and every `coachFallback` answer are
`string[]` — one idea per bullet, the everyday word ahead of the term of art, and a gloss the first
time one is unavoidable. Two reasons, and the second is the substantive one: the debrief is read by
someone who has just been told they were wrong, which is the worst possible moment for a paragraph
of six load-bearing clauses; and the structure is half the lesson, because an interview answer has
moves and a list makes them countable. `simCoachRules` asks a real model for the same shape. The
two surfaces that still need a string — the prompt block, and `sampleSolution`/`dataPack`, whose
contract is shared with ordinary practice questions — go through `asBulletText`, so the offline
mock's replies read as a list too.

**Money is typed, not dragged.** Every commitment on the commit panel is a number the candidate
enters. A slider used to sit behind the money, on the argument that a saturating curve makes *where
to stop* the interesting question and you cannot see a knee in a text field — true, and outweighed
by what a track does to the exercise: it invites dragging until something looks right. Where the
curve stops paying is now stated in words under the box, which is what the tick on the track was
carrying anyway.

**Help is priced.** Hints cost Confidence as they escalate. Teacher mode — the one AI mode whose
prompt actually works the problem — costs the equivalent of the whole hint ladder and is disclosed
in the report. The chat interviewer gives none of it away for free: asked how to break the problem
down, it turns the question back and points at the hint button, because a guesstimate is graded on
the decomposition and an untracked hint is the answer at no price. The ladder escalates in how
concrete its *single* next step gets, never in how much of the chain it reveals. A **guided** tree isn't scored on structure at all, since the app built it. Each is
derived from what was persisted rather than tracked separately, so none of it can drift out of
sync with the transcript.

---

## The Arena

A **game**, not an exercise, and the distinction is the point. Every other format in this app asks
you to produce an answer, alone, against a model that has already decided what it thinks. The
Arena puts four quick-commerce firms in one city for eight quarters and lets three of them answer
back.

It lives at **`/arena`**, behind its own nav link, and it is the only surface in the app that is
granted **one account at a time** — see below.

### What a quarter is

Four numbers: **price** per order, **marketing** spend, **dark stores** to open, and the
**delivery promise** you put on the app. Then the market resolves and you find out what it did.

Demand is a **fixed pie split by relative attractiveness**, which is what makes it a market rather
than four solitaires: every order you win is one somebody else lost. The pie itself moves with a
**hidden regime** — festive, steady or a squeeze — that is never shown and that changes where the
right price is by about ₹25. Reading which one you are in is the whole exercise, and it is
genuinely hard, because "demand is soft" and "I am losing share" look identical from inside.

Capacity is a bet placed a quarter early. The queue is convex past about 85% utilisation, so the
promise you can keep at two-thirds full is the promise that destroys your reputation at 95% — and
a stockout is paid for in the quarter after it, not the one it happened in.

### The rivals decide, they do not obey

Each of the three is an `AgentConfig` on the engine in `lib/sim/engine/agent.ts`: a softmax over a
weighted utility with a belief term, and **no branch on any state variable anywhere**. A price war
is not scripted. Somebody cuts, the cut moves every rival's `peace` posterior, a lower posterior
prices *starting a fight* out of their utility, and the board drifts back up. The war has an end
as well as a beginning and both fall out of one number.

Which three personalities you get is **drawn from the match seed** out of a pool of six, so
"seat 2 always discounts" is not something to learn. What each was actually playing for is
withheld all match and released in the debrief.

**The whole thing costs nothing to run.** No LLM call is made at any point — the outcomes are
deterministic arithmetic over seeded draws, and every line a rival says is authored per action.

### Two modes, and a match that always starts

Solo is you plus three house firms and it begins immediately. Multiplayer mints a join code, and
three rules make it safe to open one at three in the afternoon:

- **Every empty seat is played by the house**, so a match with one human is a valid match.
- **A round timer.** The quarter resolves when every person has committed *or* when the clock runs
  out; anyone who has not chosen plays what they played last quarter, flagged as an auto-commit so
  the board never passes it off as a decision. One idle tab cannot stall three other people.
- **Leaving hands your seat back to the house** and the match carries on.

The engine cannot tell the two modes apart. A human's four numbers arrive in `decision` and a
rival's arrive in `quoteOffers`, `runTick` merges both, and a seat is only ever *who fills which
keys of the decision vector* — the rule [`SCRUM_SIMULATOR.md`](docs/SCRUM_SIMULATOR.md) §8 sets out.

**There is no cron.** The round deadline is evaluated when somebody asks — loading the board or
committing a quarter is what moves the world on — which is `lib/daily-unlock.ts`'s posture applied
to a clock instead of a calendar. Nothing to fail at midnight, nothing to backfill.

### Access is granted, not bought

`User.arenaGrantedAt` is a timestamp; non-null means the door is open. It is deliberately **not a
tier**: `tierFor()` answers "what does this person's plan reach", and folding the Arena in would
mean every Pro pass silently granted it. Admin → Users has the toggle, next to the Pro buttons.

One predicate — `canPlayArena` — is called by the nav that renders the link and by every server
action that honours it, which is the invariant `lib/entitlements.ts` exists to protect. The link is
a courtesy; the action is the control. Guests are refused outright. On a fresh clone `demo` has the
grant and `admin` does not, so both sides are reachable without granting anything by hand.

### Balance is measured, not asserted

`scripts/arena-sweep.ts` is the Arena's `checkBalance`. It plays a library of strategies across
hundreds of matches and reports how often each wins, and the bar has **two halves**:

- no **fixed** line — one that ignores every signal in the game — may win more than half its
  matches;
- the best **responsive** line must beat the best fixed one.

Only the first would pass happily on a game where nothing a player does matters. As tuned, the best
fixed line wins about 36% against chance's 25%, undercutting and over-building win essentially
never, and reading the board is worth about four points of win rate.

It earned its place. It found, in order: demand that ignored rivals entirely; an exposure term that
made price wars one-way, so all three rivals converged on one price by the second quarter and
stayed; capacity so tight that every firm was capacity-bound at every price, which made raising
price free revenue; a scale-economies feedback loop strong enough that the balance stopped
responding monotonically to its own parameters; a cobweb oscillation that had rivals swinging
between ₹68 and ₹113 in consecutive quarters; and two derived keys opening at zero, which quietly
put a ₹12 best-response price in front of anyone who read them. None of those announced itself, and
every one produced a plausible-looking game that was wrong.

```bash
npx tsx scripts/arena-sweep.ts 250   # the authoring loop
pnpm test tests/arena-sweep.test.ts  # the gate, seed-pinned
```

### Adding a second game

The Arena has its own registry (`lib/arena/registry.ts`), separate from
`lib/sim/configs/registry.ts`, because everything in that one is expected to have a catalogue
`Question` row and be startable from the war-room surface — and an arena game is none of those
things. A second game is a `SimulatorConfig` in `lib/sim/configs/` and one line in the arena
registry. Mandi is also the second config-driven domain the architecture always claimed to support
and had never had.

---

## Admin analytics

`/admin` opens on **Analytics**, which answers how the cohort is doing; the Users tab beside it
answers who a particular person is. The split is deliberate — one is a chart, the other is a
roster with buttons that change somebody's account.

The four metrics on it are not ours. [`RETENTION.md`](docs/RETENTION.md) §2 commits to them
before any of its levers, and this is them: **D1 / D7 / D30 return rate**, **how often people
come back in a week they are active**, **where they stop**, and **how much of the library they
have seen**. Around them sit the counts the panel is opened for — registered, guests, active,
never started, Pro, professors, Arena — and the mix of what is actually being practised, opened
against finished, per format.

**Computed from the database, not from an analytics provider.** That memo assumes a PostHog
adapter is needed first. It is not: `Attempt`, `SimRun` and `ArenaMatch` all stamp `createdAt`,
so all four fall out of tables that already exist — no schema change, no key, no external service,
and the zero-key promise intact. An adapter is still the right answer for event-level questions
this panel cannot reach (which button, which step, which drop-off inside an attempt), and nothing
here forecloses it.

Four things it is careful about, because each one is a way a dashboard lies:

- **Denominators are shown.** A D7 of "60%" off five accounts is not a rate, so every return
  figure carries the `returned of eligible` beneath it, and an account too new for a window to
  have closed is not counted as having failed to return.
- **Counts are queries.** The Users tab derives its headline numbers from a list capped at 500
  rows; these come from `count`/`groupBy`, so they stay true when the roster stops fitting.
- **Activity means opened, not finished.** Read from the tables' own timestamps rather than
  `User.lastActiveDate`, which is written only when something is *completed* — somebody who came
  back and opened a war room is invisible to that column, and they are exactly who a return rate
  is about.
- **It says what it cannot say.** There is no session table, so the weekly panel counts distinct
  active days and calls them that. Only Pro reaches the whole library, so coverage shows Pro
  apart from free rather than averaging two different denominators.

`lib/admin-analytics.ts` holds the shaping as pure functions with the loader beside them, the way
`lib/admin-stats.ts` does — the arithmetic is unit-tested in `tests/admin-analytics.test.ts`
without a database.

---

## Leaderboards

The dashboard opens on **today's questions and then the practice leaderboard** — the two things a
student can act on — with the charts, skills and history below them. The board has two windows:

| Window | What it ranks | When it clears |
|---|---|---|
| **Today** | First-attempt scores earned today | Midnight UTC |
| **This week** | First-attempt scores earned this week | Monday 00:00 UTC |

**Today leads, and that is not cosmetic.** Under the daily unlock the whole cohort works the same
guesstimate on the same day, so a daily board ranks people on one shared problem rather than on
how much of the library they have got through — the only window where the comparison is
genuinely like-for-like.

**Both windows reset on their own.** `weekStartUtc` and `dayStartUtc` bound the query, so there
is no cron to fail at midnight, nothing to backfill after downtime and nothing that can drift out
of sync with the clock — the same reasoning as `User.proUntil` and the daily unlock. UTC
throughout, and the day boundary is pinned by a test to the one `lib/daily-unlock.ts` uses:
a board whose day started at a different hour would rank half the cohort on yesterday's question.

**Only a first attempt is ranked, and points are the sum of those scores.** A replay is easier —
you remember roughly where the ideal range was — so a second score never moves a standing, and
the rule is enforced by `LeaderboardEntry`'s unique constraint rather than by a check each write
path has to remember. Points are deliberately not XP: XP carries streak and daily bonuses, so an
XP board would rank whoever practised *most* rather than whoever practised *best*, and would
reward exactly the replaying the first-attempt rule refuses to count.

A row is **first name, college · batch, points**. First name only and never the email: this is
the one screen that shows one candidate to another, and a full name against a low score is a cost
the feature does not need to impose. Someone outside the visible top slice sees their own
position on a dashed line below it — shown to them, never listed publicly.

War rooms keep their own board on `/simulations`, with this week and all time. A simulation's
score and a guesstimate's come off different rubrics, so the sum of the two measured nothing.

---

## Classroom rooms

A professor runs a war room **or a guesstimate** as a class exercise. They pick one from the
catalogue, choose **host this in class**, and get a six-character code and a password to read
out. Students join at `/join` — **no account needed** — and each works their own copy at their
own pace while the professor watches a live roster: who's in, where they are, and what they
finished with.

Seeded to try immediately: `prof@caseclosed.app` / `prof1234`.

**Who can host.** `User.role` gained a third value, `professor`, granted from **Admin → Users**.
It opens rooms and nothing else — every admin gate in the app still tests `role === "admin"`
exactly as narrowly as before.

**What a student gets.** Joining opens **that room's one war room and nothing else**. The rest
of the catalogue stays locked, and the student stays a guest — `tierFor` is untouched, so they
are still offered the signup path everywhere else. `canOpen` takes an optional `AccessGrant`
that sits *beside* the tier table rather than in it, because a tier is a property of a person
and this is a property of one room. Both the button and the server gate derive that grant from
one function, so they cannot disagree.

**What hosting costs.** A professor can only host a war room **their own account can open**.
Otherwise the role would be a way to hand the whole paid catalogue to sixty people, so a
free-tier professor hosts the free war room and an admin grants Pro alongside the role when a
professor should reach the rest. The "host this in class" control is absent on locked cards for
the same reason, which keeps the card and the gate saying the same thing.

**Closing a room** stops new joins and new runs and leaves runs in flight completely alone.
Stranding a student six analyst-days into Investigate to enforce a room setting is not a trade
worth making — the same reasoning the entitlement gates already use when they resume before
they refuse.

**The room code is designed for transcription, not entropy.** Crockford base32, and the
normaliser *folds* `O`→`0` and `I`/`L`→`1` rather than rejecting them, so a student who copies
the wrong glyph off a projector still gets in. The generator therefore never emits a character
the normaliser folds away — otherwise two codes would collide into one — and that property has
a test.

**One refusal message.** A bad code, a closed room and a wrong password all say the same thing.
Three messages would tell an attacker which codes exist and tell the student nothing, since
they typed all three fields off the same whiteboard. A guest row is minted only *after* the
password verifies, so wrong guesses don't accumulate `User` rows.

**No websockets.** The console polls a JSON route every five seconds, pausing when the tab is
hidden. A self-paced room has no event to push, so a stream would be a poll with extra
machinery — and `router.refresh()` on a timer would re-render the whole page to update one
table. Only the professor's console polls; the student's page doesn't.

**Standings and a cost-vs-score chart.** The console's second tab ranks the class — score
first, then *fewer* analyst-days, which is the rule `LeaderboardEntry.effort` already
documents ("lower is always better"), so the class board and the public board can't disagree
about the same two results. Genuine ties share a rank rather than being ordered arbitrarily on
a screen someone reads out.

Beside it, a scatter of analyst-days against score with a dashed line at the scenario's par.
That chart is the one worth having: it separates the student who found the cause cheaply from
the one who bought every data pull and arrived at the same answer — a distinction the score
alone hides, and the thing a debrief should open on.

Both are derived from the roster the console is **already** polling, so the tab is live with
no extra request, no extra endpoint and no schema change. The only data addition is one column
(`daysPar`) on a `select` that was already running.

**Class analytics** is the third tab, and it answers what neither of the others can: not who is
in the room and not who won, but **how the class as a whole is doing**.

- **Where the class is standing**, phase by phase, live. The question a professor actually has
  mid-session is whether to keep going or stop and explain the pull market, and counting badges
  down a table of forty is not a way to find that out.
- **What they were good at** — the five scored dimensions averaged across finished runs. An
  average of 65 is not something to teach from; "they diagnosed it and then funded the wrong
  thing" is a lecture.
- **What they blamed** — the causes named at Decide, with the true one marked. A decoy that
  pulled in half the room is worth ten minutes of the next class, and it is invisible on every
  other screen. Students may name up to three, so the bars deliberately sum to more than the
  class size.
- **How the scores fell**, by band, because two clusters and a mean of 60 is a different class
  from everyone landing on 60. And **what it cost them**, as under / at / over the scenario's
  authored par.

Same posture as the standings: derived from the roster already being polled, so the whole tab
is live for free. It needed three more columns on a `select` that was already running, and the
scenario's cause labels — static for the life of a room, so they are passed in from the page
rather than re-sent every five seconds.

Two things it is careful about. A **turnaround** result stores zeros in the war room's five
typed columns and its real scores in `scoresJson`, so a result from another format carries no
dimensions and is skipped rather than averaged as a room that scored nothing. And the true
causes reach the console but never the student's page — this screen is behind the host check,
and the debrief reveals them to students anyway.

### Hosting a guesstimate

The room is **the same row**. `SimRoom` was always coordination and entitlement and nothing
else — it points at a `Question`, hands out a grant for that one question, and collects a
roster of seats — so hosting a guesstimate needed no second kind of room, no second code
space and no second join flow. What differs is only what the students produce: an `Attempt`
where a war room produces a `SimRun`. `roomKindFor(question.type)` decides which, and the room
page, the console and the poll route all ask that one function rather than each keeping an idea
of what the room is.

**One column.** `Attempt` gained a nullable `roomId`, mirroring `SimRun.roomId` down to the
`SetNull` — a professor tidying up after term must not delete the work sixty students did.

**Two sittings, not one.** A class attempt and a solo attempt on the same guesstimate are
separate, exactly as they already are for war rooms: `startAttempt` resumes only `roomId: null`
rows and `attemptStateByQuestion` counts only those, so the library can't reopen — or offer a
Resume button for — work started in a lecture.

**The way in is the room page, and only the room page.** `startRoomAttempt` is the practice-side
twin of `startRoomRun`: it takes the code alone and *derives* the question from the room, so
there is no client-supplied id to cross-check and no forgery path to keep getting right. The
library and the dashboard go on deriving their grant from the daily unlock, untouched — each
surface's button and gate still call one function, which is the whole invariant.

**What the console shows** is the seat-driven roster the war room has, in the terms a
guesstimate has: not started / working / submitted, the estimate, minutes on the question, and
the score — under the question's accepted range, with a count of how many landed inside it. A
submitted attempt with no score reads *unscored* rather than zero, because a Teacher-mode
attempt states the answer and so measures nothing. The five-second poll itself is shared with
the war-room console (`useRosterPoll`); the tables are not, because standings on analyst-days
and a cause-mix chart have no guesstimate counterpart.

**What is deliberately not hosted.** `HOSTABLE_TYPES` is an allow-list of two. `case` has no
runtime at all, and `qualitative` is left out for a smaller reason worth stating: nothing about
the room refuses one, but the console has no shape for it yet, and a room a professor cannot
watch is worse than one they cannot open. The cross-room roll-up below stays war-room-only for
the same kind of honesty — every figure in it (found the cause, under par) is a war room's.

**`/host` sums it across rooms** (war rooms — see above): how many people a professor has
taught, how many finished, the average, the share that found the cause and came in under par —
plus a row per war room they have run, so two sittings of the same scenario can be compared. A student who sat in two
rooms counts once. The shaping is `lib/rooms/teaching.ts`, pure and tested like the roster
beside it, and it counts a student as a **seat** rather than a run — the same rule the console
uses, so the two screens can never disagree about how many people were in the room.

---

## Deploying to production

1. **Host** on Vercel (push the repo, import it).
2. **Database:** provision Postgres (Supabase/Neon), set `DATABASE_URL`, change the Prisma
   `datasource` provider to `postgresql`, run `prisma migrate deploy` + seed.
3. **Auth:** the dev cookie session is Supabase-Auth-ready (`lib/auth.ts` is the seam).
4. Set env vars in the host dashboard (DB, `AUTH_SECRET`, optional LLM key). Redeploy.

The same codebase runs free/offline locally and as a public web app once these are set — but read
the limitations below first.

---

## Known limitations

This is built and tuned as a **portfolio / demo** app. It runs end to end, but some surfaces are
deliberately unfinished, and it's better to say so than to let you find out:

- **Password reset is a person, not an email.** No email provider is wired up, so
  `/forgot-password` tells the student to write to the admin from their official college address;
  the admin resets them from the Users tab, and the account's password becomes its own email until
  `/set-password` takes a real one. Between those two moments the account is guessable by anyone
  who knows the address — tell them promptly, and see "Locked out: the reset path" above.
- **Dropped columns need a migration in production.** `Profile.gradYear`, `User.collegeId` and
  `Profile.collegeOther` went with `prisma db push --accept-data-loss`, which is fine on a local
  SQLite file where the launch hasn't happened. A deployed Postgres wants `prisma migrate`, and
  the same goes for the columns added beside them (`batch`, `professorRequestedAt`,
  `mustChangePassword`).
- **Changing a password doesn't sign out other devices.** `verify()` ignores the timestamp in
  the session token and there's no revocation list, so existing sessions survive a change until
  their cookie expires. The form says so under the button. Fixing it properly is a
  `sessionEpoch` column on `User`, embedded in the token and compared against the row
  `getSessionUser()` already loads — no extra query.
- **Avatar URLs aren't authenticated.** Anyone with the URL can fetch the image. Checking the
  session on `/api/avatar/[userId]` would mean a database read per image and no caching, which
  is a poor trade for a photo its owner put on a profile — but it is obscurity, not access
  control.
- **Nothing prunes an orphaned avatar** if an external store is ever configured. The built-in
  database store has no such problem: the bytes are on `Profile`, which cascades with the user.
- **Pro is real but not purchasable.** The tier, the gating and the pass all work; no payment
  gateway is wired up, so the only way to grant one is Admin → Users. The landing page's Pro
  card stays disabled and says so. A gateway is a `PaymentProvider` and a webhook that calls
  the existing `grantPro`.
- **`User.batch` was added with `prisma db push`**, like everything else here, so a deployed
  Postgres wants a real `prisma migrate` for it. The column is nullable on purpose — existing
  rows have no batch, and `requireBatch` asks them for one rather than a `NOT NULL` deciding who
  is locked out.
- **Dropping `User.plan` needs a migration in production.** It was replaced by `proUntil` and
  removed with `prisma db push --accept-data-loss`, which is fine on a local SQLite file
  where every row held the default. A deployed Postgres wants `prisma migrate` instead.
- **Sessions don't expire server-side.** The signed cookie carries a timestamp that `verify()`
  ignores, so only the cookie's own `maxAge` bounds a session.
- **Guest rows accumulate.** Every visitor who starts practising gets a `User` row and nothing
  prunes them. They're kept out of the rank population, but they are never collected.
- **Signing in from a guest session migrates attempts, war-room runs and classroom seats.**
  Bookmarks and achievements earned as a guest are still dropped. Signing *up* from a guest
  session upgrades the row in place and keeps everything. (Runs used to be dropped here too —
  the guest row is deleted and everything hanging off it cascades, and `SimRun` was simply not
  in the list of things moved first. Classroom rooms made that the common path rather than a
  rare one, since a class joins as guests by design.)
- **Room join rate limiting is in-memory**, so it is per-process and resets on redeploy; on a
  multi-instance deployment the effective ceiling is the limit times the instance count. It is
  guarding a classroom password rather than a credential, which is the trade it was chosen for.
  The upgrade is a shared store behind the same `lib/rate-limit.ts` interface.
- **A room password can't be shown again** once set — it is scrypt-hashed like any other. The
  console has a reset control, which is the way out of forgetting it mid-class.
- **A guest in a classroom is bound to one device.** The session is a 30-day cookie, so a
  student who joins on a phone and reopens on a laptop is a new person to the app and must join
  again (and starts a new run). The room page says so and offers signup as the fix.
- **`recomputeRank` only updates the submitting user**, so everyone else's percentile is stale
  until they next submit. At real scale this belongs in a scheduled job.

---

## Testing

`pnpm test` runs Vitest unit tests covering the evaluation scorer (both modes), the diagnosis
matcher, the priced-help rules, the mock interviewer's **no-early-reveal** behaviour,
gamification/rank math and the rank population filter, the calculator engine, the question
authoring contract, the framework save payload, the LLM layer — Gemini message mapping, the
NDJSON stream protocol, the before/after-first-token fallback split, the provider→fallback→mock
chain, the spend guards, and the Ollama adapter's SSE parsing and error classification — and the voice layer's transcript
assembly and error triage. Only the network boundary and the database are mocked, so the adapter
wiring and error classification are exercised for real.

`tests/theme.test.ts` reads `app/globals.css` as text, because a palette rewrite fails quietly:
a token Tailwind maps but the CSS no longer defines resolves to `hsl()` of nothing, which paints
transparent — an invisible border, or a card that is suddenly the page colour. It also pins the
one contrast pairing a reasonable-looking edit can break (dark text on the bright accent) and that
the print block flips every surface.

The batch, the gates and the professor request add four more, all pure: `tests/batches.test.ts`
pins that the id never carries a year (so a batch rolling over stays a label edit),
`tests/batch-gate.test.ts` and `tests/password-gate.test.ts` pin who each gate lets through —
including the guest exemption a classroom depends on, which is the one that breaks `/join` if it
is ever "tidied up" — and `professorRequestFor`'s cases in `tests/profile-schema.test.ts` pin the
three-way answer that keeps a partial save from cancelling a request somebody is waiting on.

The profile layer adds three suites, all pure. `tests/avatar.test.ts` is the one worth reading:
it pins that a payload declaring `image/jpeg` while carrying a shell script is refused, that an
SVG is refused, that the **sniffed** type wins over the declared one when the two disagree, and
that a re-upload mints a different URL — the property the immutable cache header depends on.
`tests/profile-schema.test.ts` covers the authoring contract, including that a blank graduation
year stays absent instead of becoming the year zero (the `z.coerce.number()` trap
`lib/question-schema.ts` documents), and that "Other" is stored as a null id plus a written-in
name. `tests/colleges.test.ts` pins the id contract and `prefillLevel`'s refusal to override a
URL the visitor chose.

`tests/billing.test.ts` pins the pass arithmetic — that granting again **extends** a live pass
rather than resetting it, that a lapsed one restarts from now, and that days remaining round up
so eighteen hours left doesn't read as zero. `tests/entitlements.test.ts` covers the expiry
matrix against an injected `now`, including the case that stands in for a cron job: a pass one
second past its deadline is already free.

`tests/entitlements.test.ts` covers the access tiers: that no session reads as a guest rather
than as an error, that a guest row carrying a paid plan is still a guest, that a tier which
locks content always has somewhere to send the person it blocked, and — against
`prisma/seed-data.ts` itself — that the shop window really is one guesstimate, one case and
one simulation, that the case has a `rootCause` so it can score Diagnosis, and that the
simulation is an Easy one.

Vitest runs in a `node` environment with no jsdom, so React components and hooks aren't covered.
The logic worth testing in `lib/speech` is kept pure and exported for exactly that reason.

The Arena adds six: the access gate (one predicate, both callers), the round rule (a quarter runs
when everyone is in **or** the clock is out, and a solo match waits for nobody), determinism (a
match resumed from its journal lands exactly where an uninterrupted one did, on the regime its seed
drew), the config's own invariants (one shock per mechanism, a factorisable covariance matrix, and
every derived key given an opening value — the bug that valued eight quarters of trading at nil),
redaction asserted against the serialised payload, and the balance gate above.

The simulation engine adds its own suites: the driver DAG, the outcome model (including that an
allocation's *order* cannot change the result), drilldown pricing and locking, each scoring
dimension on its own, the payload guards, the redaction projection, the authoring invariants, and
the scenario's balance — which brute-forces every affordable combination of interventions to prove
the declared best allocation really is best.

Three of those pin rules rather than numbers, which is the distinction worth preserving when you
retune. `overspendPenaltyFor` is tested for its *shape* — nothing at or under par, linear in the
overage — so the constants can move in `simConfig` without a test edit. Hedging is tested as a
property across every board width the app allows, rather than against a leaf count that
`CAUSE_BOARD` now caps. And `tests/sim-fixture.ts` satisfies the authoring rules itself, so the
suite cannot certify a scenario shape the app would refuse to load.

`tests/fixtures/sim-golden.json` pins every scenario's projected paths, and
`pnpm tsx scripts/sim-golden.ts` regenerates it while printing which slugs moved. Run it only when
you meant to change a scenario's numbers — a diff in a scenario nobody touched is the bug it exists
to catch. Changes to the *board* — causes, panels, day-costs, budgets — should move nothing.

`tests/sim-overlay.test.ts` covers admin driver overrides, and its through-line is that a stored
override can never make the app worse than not having one: malformed JSON, an edit that orphans a
driver an intervention moves, one that introduces a cycle, and one that turns a lever into a derived
driver all end at the authored scenario. It also proves the case structure alone cannot see — a
re-wiring that unhooks the best allocation's levers passes `validateScenario` and is caught only by
`checkBalance`.

Also useful: `pnpm typecheck` (strict, clean), `pnpm lint`, `pnpm build`.

---

## Deferred / future

Stripe payments, PostHog analytics, whiteboard, adaptive difficulty,
weekly report emails — each structured as an additive plug-in. The `case` value in
`QUESTION_TYPES` is reserved for the full-length interview format and has no runtime yet, so the
library filters it out and the admin panel doesn't offer it (see `PRACTISABLE_TYPES`).

More decision simulations remain the cheapest next thing: the engine takes the scenario as a
parameter throughout and no scenario id appears in engine code, so another one is a file in
`lib/sim/scenarios/`, a line in the registry and a seed row. The three this note used to name —
prioritisation, supply-chain service level and activation — have shipped as Setu, Sehat Plus and
Vyapar Mitra, and none of them needed an engine change. What is still open is a scenario built
**on** decision periods, which is the one thing that does: see the note at `lib/sim/types.ts:623`
for the two prerequisites that have to land before a war room may set `decisionPeriods` again.
