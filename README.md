# EstimateIQ

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

---

## Quick start

```bash
cp .env.example .env   # Prisma needs DATABASE_URL; .env is gitignored, so a clone has none
pnpm install
pnpm db:push           # create the SQLite database from prisma/schema.prisma
pnpm db:seed           # 15 categories, 35 questions (24 guesstimates + 2 cases + 9 simulations), achievements, demo users
pnpm dev               # http://localhost:3000
```

The `.env` step is easy to skip and confusing when you do: the app itself defaults
`DATABASE_URL` (`lib/config/env.ts`), but `prisma/schema.prisma` does not, so it is the
`db:*` commands that fail rather than the site.

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
| Demo user | `demo@estimateiq.app` | `demo1234` |
| Admin | `admin@estimateiq.app` | `admin1234` |

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

---

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind + shadcn-style UI ·
Framer Motion · Prisma (SQLite dev → Postgres/Supabase prod) · Recharts · Vitest.

---

## Where to change common things

| I want to… | Edit |
|---|---|
| Add / edit questions and cases | Admin panel (`/admin`), CSV/JSON import, or `prisma/seed-data.ts` |
| Add / edit a decision simulation | `lib/sim/scenarios/` + a row in `lib/sim/registry.ts` and `prisma/seed-data.ts` |
| Retune a simulation's numbers without a deploy | Admin panel → **Simulations** (see below) |
| Tune simulation scoring / bands | `lib/config/simulation.ts` |
| Change the interviewer's behaviour / wording | `lib/llm/prompts.ts` |
| Tune XP, levels, streak rules | `lib/config/gamification.ts` |
| Change rank percentile bands (Silver→Diamond) | `lib/config/gamification.ts` (`rankBands`) |
| Adjust evaluation rubric weights / readiness bands | `lib/config/evaluation.ts` |
| Change hint count / panel defaults | `lib/config/practice.ts` |
| Change what a guest can reach (and go freemium) | `lib/config/access.ts` (`tierAccess`) |
| Give a specific question away to guests | Admin panel → **Questions** → the lock button |
| Add a college to the picker | `lib/config/colleges.ts` |
| Change avatar size / quality / limits | `lib/config/profile.ts` (`avatarLimits`) |
| Store avatars somewhere other than the DB | `AVATAR_STORE` + a file in `lib/storage/` |
| Change what the post-signup step asks | `components/onboarding/welcome-steps.tsx` |
| Change what a question may contain | `lib/question-schema.ts` (one contract for admin + import) |
| Swap the LLM provider | env vars (`LLM_PROVIDER`, `*_API_KEY`) |
| Develop against a free local model | `LLM_PROVIDER=ollama` + `OLLAMA_MODEL` (see above) |
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

---

## Profile, and what it's for

An account has a profile at `/profile`, reachable from the avatar in the header: photo, name,
phone, city, a short bio, background (profession, college, graduation year, experience),
goals, and a password change. Signing up lands on `/welcome`, a two-step version of the same
questions that is **skippable in one click** — nothing in the app is ever gated on having
answered. A dashboard nudge asks once more, and "Not now" is a real dismissal rather than a
banner that comes back tomorrow.

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

### College is a curated list, on purpose

`lib/config/colleges.ts` holds ~60 Indian institutions grouped into IIMs, IITs, business
schools and universities, and `User.collegeId` stores the id. Free text was the alternative
and it quietly destroys the thing the field is for: "IIM-B", "IIM Bangalore" and "iim blr" are
one school and three groups. Normalising on save only moves the problem — it collapses the
spellings you thought of and fragments on the ones you didn't.

So **"Other" is honest about its consequence**: it stores a null `collegeId` plus the
written-in name, is shown on the profile, and is grouped with nobody. Adding a school to the
list is a one-line change that promotes everyone who wrote it in. `collegeId` is indexed and
sits on `User` beside `skillRating`, which is what a cohort ranking would need — that feature
doesn't exist yet, and nothing in the UI claims it does.

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

---

## What a guest can reach

A visitor with no account gets **one of each format** — one guesstimate, one case and one
simulation — and the rest of the library is locked behind sign-up. Today those three are chai
in Bangalore, the food-delivery margin case, and the Kadak Coffee war room: the most inviting
of each kind rather than the first of each kind.

Access is a property of a **tier**, not of the user row:

| Tier | Who | Reaches |
|---|---|---|
| `guest` | no account (or a guest session) | questions flagged `freeTier` |
| `free` | a registered account | everything |
| `pro` | `plan = "pro"` | everything |

`lib/entitlements.ts` is the whole rule and is pure, so **the library card and the server gate
call the same function** — a card can never offer something `startAttempt` then refuses. The
card is a courtesy; `startAttempt` and `startSimulation` are the control, and a hand-rolled
Server Action call with a locked question id gets bounced to `/library?wall=locked` like any
other.

**Making it freemium is a change to `tierAccess` in `lib/config/access.ts`, not to any gate.**
Set `free` to `content: "free-tier-only"`, point its `upgrade` at checkout, and the gates,
the locked cards, the library banner and the dashboard recommendations all follow. That is
the reason the tier table exists rather than an `isGuest` check at each call site: the day a
paid plan lands, the checks you forget to update are the ones that give the product away.

Which questions are free is authored, not derived — `Question.freeTier`, seeded in
`prisma/seed-data.ts` and toggled per question from **Admin → Questions**. It is deliberately
*not* part of the authoring contract in `lib/question-schema.ts`: whether a question is good
and whether it is given away are different decisions, and folding the flag into
`toQuestionColumns` would mean every admin edit and every CSV re-import silently relocked the
shop window. It is also the only control that works on a simulation, whose catalogue row the
question form refuses to edit.

Guests may **replay** their three as often as they like. The old caps — three submitted
attempts, one simulation run — are gone: two walls with two different messages meant a guest
could be turned away from a question they had never opened, and the reason to sign up is the
other thirty items rather than a play counter.

---

## Decision simulations (the PM track)

A war room. The candidate reads an analytics dashboard, commits to a hypothesis *before* spending
anything, buys data pulls out of a budget of analyst-days, names a root cause, and splits a
quarter of engineering capacity and a rupee budget across candidate fixes. The next periods are
then projected forward and reported as **moved metrics — orders, retention, margin — rather than as
a mark**. A debrief reveals the true causal chain and compares the candidate's allocation to the
best available one.

Nine scenarios ship today, easiest first — which is the order the library shows them in:

| Scenario | Level | Teaches |
|---|---|---|
| **Kadak Coffee** — ROAS 4.0 and losing money | Easy | CPM, impressions, CTR, conversion, AOV, CAC, ROAS, ROI — and that a campaign only breaks even once ROAS clears 1 ÷ gross margin |
| **Rangoli** — the test says +6%, ship it Monday? | Easy | A/B tests, sample size, significance, novelty effect, confounded variants — and reading a test on the metric that pays the bills |
| **Padhai Plus** — growing subscribers, growing burn | Easy | Churn, lifetime, LTV, CAC, payback, and that a subscriber base settles at joiners ÷ churn |
| **Chaska** — share up five points, profit down a third | Easy | Net realisation, trade promotion, incrementality, cannibalisation — and why market share is a diagnostic rather than a target |
| **Suraksha Home** — match the competitor's price cut? | Medium | Contribution per unit, break-even volume on a price change, price elasticity, trade promotion |
| **Ujala Solar** — planned 10.8 lakh, sold 4.3 lakh | Medium | TAM / SAM / SOM, and channel economics on net rather than gross revenue |
| **Ghar Sewa** — both sides grew, both sides are angry | Medium | Match rate, liquidity, utilisation, GMV, take rate — and that a platform-level average hides the only markets that matter |
| **Lekha** — our best customer wants 18% off | Medium | ARR, cost to serve, seats vs usage pricing, NRR, and total cost of ownership from both sides of the table |
| **NukkadEats** — orders down 9%, nobody knows why | Medium | Metric-drop diagnosis with the model hidden — the original, and the hardest |

**Every scenario but one teaches the vocabulary first.** Each carries a `teaching` block: a concept
primer that opens before the run and reopens from the header, and a **metric map** derived from the
driver graph showing how every number is built from the ones under it, with live values. Showing
the map is opt-in per scenario, and that gate matters in both directions — on NukkadEats and Lekha
the *shape* of the model is part of what the candidate has to work out, so the map stays hidden
while the primer still ships.

`difficulty` is enforced rather than promised: `validateScenario` rejects an `Easy` scenario with
more than six drilldowns, more than six causes, a cause tree deeper than one level, a punishing
budget, or no primer.

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

**Help is priced.** Hints cost Confidence as they escalate. Teacher mode — the one AI mode whose
prompt actually works the problem — costs the equivalent of the whole hint ladder and is disclosed
in the report. A **guided** tree isn't scored on structure at all, since the app built it. Each is
derived from what was persisted rather than tracked separately, so none of it can drift out of
sync with the transcript.

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

- **Password reset doesn't send anything.** `/forgot-password` is UI only — no email provider is
  wired up, and there's no admin reset either, so a forgotten password means a new account.
  Someone who still knows their password can change it at `/profile`.
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
- **The Pro tier on the landing page is not purchasable.** No Stripe integration exists; the
  pricing card is illustrative. `plan = "pro"` is a real column and a real access tier, but
  nothing sets it — a registered free account already reaches everything.
- **Sessions don't expire server-side.** The signed cookie carries a timestamp that `verify()`
  ignores, so only the cookie's own `maxAge` bounds a session.
- **Guest rows accumulate.** Every visitor who starts practising gets a `User` row and nothing
  prunes them. They're kept out of the rank population, but they are never collected.
- **Signing in from a guest session migrates attempts only.** Bookmarks and achievements earned
  as a guest are dropped. Signing *up* from a guest session upgrades the row in place and keeps
  everything.
- **`recomputeRank` only updates the submitting user**, so everyone else's percentile is stale
  until they next submit. At real scale this belongs in a scheduled job.

---

## Testing

`pnpm test` runs Vitest unit tests covering the evaluation scorer (both modes), the diagnosis
matcher, the priced-help rules, the mock interviewer's **no-early-reveal** behaviour,
gamification/rank math and the rank population filter, the calculator engine, the question
authoring contract, the framework save payload, the LLM layer — Gemini message mapping, the
NDJSON stream protocol, the before/after-first-token fallback split, the spend guards, and the
Ollama adapter's SSE parsing and error classification — and the voice layer's transcript
assembly and error triage. Only the network boundary and the database are mocked, so the adapter
wiring and error classification are exercised for real.

The profile layer adds three suites, all pure. `tests/avatar.test.ts` is the one worth reading:
it pins that a payload declaring `image/jpeg` while carrying a shell script is refused, that an
SVG is refused, that the **sniffed** type wins over the declared one when the two disagree, and
that a re-upload mints a different URL — the property the immutable cache header depends on.
`tests/profile-schema.test.ts` covers the authoring contract, including that a blank graduation
year stays absent instead of becoming the year zero (the `z.coerce.number()` trap
`lib/question-schema.ts` documents), and that "Other" is stored as a null id plus a written-in
name. `tests/colleges.test.ts` pins the id contract and `prefillLevel`'s refusal to override a
URL the visitor chose.

`tests/entitlements.test.ts` covers the access tiers: that no session reads as a guest rather
than as an error, that a guest row carrying a paid plan is still a guest, that a tier which
locks content always has somewhere to send the person it blocked, and — against
`prisma/seed-data.ts` itself — that the shop window really is one guesstimate, one case and
one simulation, that the case has a `rootCause` so it can score Diagnosis, and that the
simulation is an Easy one.

Vitest runs in a `node` environment with no jsdom, so React components and hooks aren't covered.
The logic worth testing in `lib/speech` is kept pure and exported for exactly that reason.

The simulation engine adds its own suites: the driver DAG, the outcome model (including that an
allocation's *order* cannot change the result), drilldown pricing and locking, each scoring
dimension on its own, the payload guards, the redaction projection, the authoring invariants, and
the scenario's balance — which brute-forces every affordable combination of interventions to prove
the declared best allocation really is best.

`tests/sim-overlay.test.ts` covers admin driver overrides, and its through-line is that a stored
override can never make the app worse than not having one: malformed JSON, an edit that orphans a
driver an intervention moves, one that introduces a cycle, and one that turns a lever into a derived
driver all end at the authored scenario. It also proves the case structure alone cannot see — a
re-wiring that unhooks the best allocation's levers passes `validateScenario` and is caught only by
`checkBalance`.

Also useful: `pnpm typecheck` (strict, clean), `pnpm lint`, `pnpm build`.

---

## Deferred / future

Stripe payments, PostHog analytics, whiteboard, peer leaderboard, adaptive difficulty,
weekly report emails — each structured as an additive plug-in. The `case` value in
`QUESTION_TYPES` is reserved for the full-length interview format and has no runtime yet, so the
library filters it out and the admin panel doesn't offer it (see `PRACTISABLE_TYPES`).

More decision simulations are the cheapest next thing: the engine takes the scenario as a parameter
throughout and no scenario id appears in engine code, so another one is a file in
`lib/sim/scenarios/`, a line in the registry and a seed row. Prioritisation, supply-chain
service-level and freemium-activation scenarios all fit the existing phases without engine
changes.
