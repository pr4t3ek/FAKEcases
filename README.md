# EstimateIQ

**Duolingo for consulting guesstimates.** An interactive web app where MBA / consulting / PM
candidates practise **India-focused** market-sizing guesstimates and business cases while an AI
interviewer guides them with Socratic questions, escalating hints (never the answer early) and a
detailed evaluation.

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
pnpm db:seed           # 14 categories, 26 questions (24 guesstimates + 2 cases), achievements, demo users
pnpm dev               # http://localhost:3000
```

The `.env` step is easy to skip and confusing when you do: the app itself defaults
`DATABASE_URL` (`lib/config/env.ts`), but `prisma/schema.prisma` does not, so it is the
`db:*` commands that fail rather than the site.

**The database is not in the repo** — `prisma/dev.db` is gitignored, as a binary build
artifact should be. All the content lives in `prisma/seed-data.ts`, so an empty question
library means the seed hasn't been run, not that the questions are missing.

**Pulling a branch that changed the schema?** Run `pnpm db:reset` rather than `db:seed`.
Seeding alone won't add new columns, and Prisma will error on the missing fields. Reset drops
and rebuilds, so local attempts and sign-ups are discarded.

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
ollama serve                       # in its own terminal
ollama pull qwen2.5:7b
echo 'LLM_PROVIDER=ollama' >> .env.local
pnpm dev
```

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
| Change the interviewer's behaviour / wording | `lib/llm/prompts.ts` |
| Tune XP, levels, streak rules | `lib/config/gamification.ts` |
| Change rank percentile bands (Silver→Diamond) | `lib/config/gamification.ts` (`rankBands`) |
| Adjust evaluation rubric weights / readiness bands | `lib/config/evaluation.ts` |
| Change hint count / guest cap / panel defaults | `lib/config/practice.ts` |
| Change what a question may contain | `lib/question-schema.ts` (one contract for admin + import) |
| Swap the LLM provider | env vars (`LLM_PROVIDER`, `*_API_KEY`) |
| Develop against a free local model | `LLM_PROVIDER=ollama` + `OLLAMA_MODEL` (see above) |
| Tune LLM rate/spend limits | `lib/config/practice.ts` (`llmBudget`) |
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

## Two question types

A **guesstimate** ends in a number and is scored against an ideal range. A **case** ends in a
recommendation and is scored on whether the candidate's issue tree localised the declared root
cause. `answerModeFor(type)` in `lib/types.ts` is the fork; everything downstream branches on
that rather than on `type`, so adding a type that behaves like an issue tree costs one line.

Both are authored through the same contract (`lib/question-schema.ts`), used by the admin panel
and the CSV/JSON importer alike — download the CSV template from the import panel for a worked
example of each. A case can't be saved with an ideal range, and a guesstimate can't be saved with
a root cause; a malformed `rootCause` is a save error rather than a case that silently can't
score Diagnosis.

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
- **The Pro tier on the landing page is not purchasable.** No Stripe integration exists; the
  pricing card is illustrative.
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
authoring contract, the framework save payload, and the LLM layer — Gemini message mapping, the
NDJSON stream protocol, the before/after-first-token fallback split, the spend guards, and the
Ollama adapter's SSE parsing and error classification. Only the network boundary and the
database are mocked, so the adapter wiring and error classification are exercised for real.

Also useful: `pnpm typecheck` (strict, clean), `pnpm lint`, `pnpm build`.

---

## Deferred / future

Stripe payments, PostHog analytics, voice/STT, whiteboard, peer leaderboard, adaptive difficulty,
weekly report emails — each structured as an additive plug-in. The `case` value in
`QUESTION_TYPES` is reserved for the full-length interview format and has no runtime yet, so the
library filters it out and the admin panel doesn't offer it (see `PRACTISABLE_TYPES`).
