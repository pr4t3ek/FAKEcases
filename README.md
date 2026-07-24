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
pnpm install
pnpm db:push        # create the SQLite database from prisma/schema.prisma
pnpm db:seed        # seed 14 categories, 24 India-only questions, achievements, demo users
pnpm dev            # http://localhost:3000
```

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

1. `cp .env.example .env.local`
2. Add **one** line, e.g. `ANTHROPIC_API_KEY=sk-...` (or `OPENAI_API_KEY=...`).
   Optionally set `LLM_PROVIDER` and `LLM_MODEL`.
3. Restart the dev server.

The adapter (`lib/llm/index.ts`) auto-detects the provider from the key and **falls back to the
mock** on any error (missing key, rate limit, quota). Keys stay **server-side** only.

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
**no-early-reveal** behaviour, gamification/rank math, the calculator engine, and the import
validator.

---

## Deferred / future (config-stub or Phase 2)

Stripe payments, PostHog analytics, voice/STT, whiteboard, peer leaderboard, adaptive difficulty,
weekly report emails — each structured as an additive plug-in. **Phase 2:** qualitative case
interviews (the `Question.type` discriminator is already in the schema).
