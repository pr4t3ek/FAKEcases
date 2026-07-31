# EstimateIQ

**Duolingo for consulting guesstimates.** An interactive web app where MBA / consulting / PM
candidates practise **India-focused** market-sizing and demand guesstimates while an AI interviewer
guides them with Socratic questions, escalating hints (never the answer early) and a detailed
evaluation.

It is built **local-first / zero-key**: it runs and is fully usable with **no external services** —
a local SQLite database, dev auth, and a deterministic offline "mock" interviewer. Real
Supabase / OpenAI / Anthropic / Stripe swap in purely through environment variables, with no code
changes.

---

📊 **[Architecture & visual documentation](docs/ARCHITECTURE.md)** — system diagram, user flow,
data model (ERD), LLM adapter sequence, evaluation rubric, and gamification/rank flow.

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

---

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind + shadcn-style UI ·
Framer Motion · Prisma (SQLite dev → Postgres/Supabase prod) · Recharts · Vitest.

---

## Where to change common things

| I want to… | Edit |
|---|---|
| Add / edit questions | Admin panel (`/admin`) or `prisma/seed-data.ts` |
| Change the interviewer's behaviour / wording | `lib/llm/prompts.ts` |
| Tune XP, levels, streak rules | `lib/config/gamification.ts` |
| Change rank percentile bands (Silver→Diamond) | `lib/config/gamification.ts` (`rankBands`) |
| Adjust evaluation rubric weights / readiness bands | `lib/config/evaluation.ts` |
| Change hint count / guest cap / panel defaults | `lib/config/practice.ts` |
| Turn features on/off | `lib/config/flags.ts` |
| Swap the LLM provider | env vars (`LLM_PROVIDER`, `*_API_KEY`) |
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

## Deploying to production

1. **Host** on Vercel (push the repo, import it).
2. **Database:** provision Postgres (Supabase/Neon), set `DATABASE_URL`, change the Prisma
   `datasource` provider to `postgresql`, run `prisma migrate deploy` + seed.
3. **Auth:** the dev cookie session is Supabase-Auth-ready (`lib/auth.ts` is the seam).
4. Set env vars in the host dashboard (DB, `AUTH_SECRET`, optional LLM key). Redeploy.

The same codebase runs free/offline locally and as a public web app once these are set.

---

## Testing

`pnpm test` runs Vitest unit tests covering the evaluation scorer, the mock interviewer's
**no-early-reveal** behaviour, gamification/rank math, the calculator engine, the import
validator, and the LLM layer — Gemini message mapping, the NDJSON stream protocol, the
before/after-first-token fallback split, and the spend guards. Only the network boundary is
mocked, so the adapter wiring and error classification are exercised for real.

---

## Deferred / future (config-stub or Phase 2)

Stripe payments, PostHog analytics, voice/STT, whiteboard, peer leaderboard, adaptive difficulty,
weekly report emails — each structured as an additive plug-in. **Phase 2:** qualitative case
interviews (the `Question.type` discriminator is already in the schema).
