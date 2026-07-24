# EstimateIQ — Architecture & Documentation

EstimateIQ is a **local-first, zero-key** Next.js app that lets MBA / consulting / PM
candidates practise India-focused market-sizing guesstimates against an AI interviewer,
then get a scored evaluation and gamified progress (XP, levels, streaks, percentile rank).

This document is the visual companion to the root [`README.md`](../README.md): it covers
system architecture, the request/data flow, the data model, and the scoring & gamification
rules, each with a diagram.

---

## 1. System architecture

Next.js 15 App Router serves both the UI (React Server Components) and the backend
(Server Actions + a few Route Handlers) from one deployable unit. Prisma is the only way
any code touches the database.

```mermaid
flowchart TB
    subgraph Client["Browser"]
        UI["React 19 UI\nTailwind + shadcn-style components + Framer Motion"]
    end

    subgraph Next["Next.js 15 (App Router)"]
        Pages["Pages / RSC\napp/*/page.tsx"]
        Actions["Server Actions\napp/actions/*.ts"]
        Routes["Route Handlers\napp/api/chat, /hint, /feedback, /admin/import"]
    end

    subgraph Domain["Domain logic (lib/)"]
        Auth["auth.ts\ncookie session, guest, signup/login"]
        Eval["evaluation.ts\nrubric scorer"]
        Game["gamification.ts\nXP, levels, streak, rank"]
        Progress["progress.ts\nper-user rollups"]
        Calc["calc.ts\ncalculator engine"]
        Questions["questions.ts\ncontent access"]
        LLM["llm/index.ts\npluggable adapter + fallback"]
    end

    subgraph Providers["LLM providers"]
        Mock["mock.ts\ndeterministic offline interviewer"]
        Anthropic["anthropic.ts"]
        OpenAI["openai.ts"]
    end

    subgraph Data["Data layer"]
        Prisma["Prisma Client (db.ts)"]
        SQLite[("SQLite (dev)\nprisma/dev.db")]
        Postgres[("Postgres / Supabase (prod)")]
    end

    UI <--> Pages
    UI -- "form submit / fetch" --> Actions
    UI -- "streaming chat" --> Routes
    Pages --> Domain
    Actions --> Domain
    Routes --> Domain
    LLM --> Mock
    LLM --> Anthropic
    LLM --> OpenAI
    Anthropic -. "on error" .-> Mock
    OpenAI -. "on error" .-> Mock
    Domain --> Prisma
    Prisma --> SQLite
    Prisma -. "swap via DATABASE_URL" .-> Postgres

    style Mock fill:#2b6cb0,color:#fff
    style Anthropic fill:#6b46c1,color:#fff
    style OpenAI fill:#6b46c1,color:#fff
```

**Key principle:** every external dependency (LLM, database, auth provider) sits behind a
narrow interface in `lib/`, so the app runs fully offline by default and upgrades to real
services purely through environment variables (see root README, "Enabling a real LLM").

---

## 2. End-to-end user flow

A guest can complete the entire core loop — practice → evaluation — with zero signup.
Signing up "claims" the guest's history in place.

```mermaid
flowchart LR
    A["Landing page\n(app/page.tsx)"] -->|"Start practising"| B["Guest session created\n(getOrCreateGuest)"]
    B --> C["Question Library\n(/library)"]
    C -->|"pick a question"| D["Start/resume Attempt\n(app/actions/attempts.ts)"]
    D --> E1

    subgraph Practice["Practice screen (/practice/[attemptId])"]
        E1["Chat panel\n↔ AI interviewer"]
        E2["Framework builder"]
        E3["Assumptions list\n(rated live)"]
        E4["Calculator"]
        E5["Hints (escalating,\nnever the answer)"]
    end

    Practice -->|"Submit"| F["submitAttempt()\nlib/evaluation.evaluate()"]
    F --> G["Evaluation report\n8-category radar + readiness band"]
    F --> H["Rewards\nXP, streak, achievements, rank"]
    G --> I["Dashboard\n(/dashboard): stats, charts, rank card"]
    H --> I
    C -.->|"sign up to save"| J["Signup claims guest\n(same user row)"]
    J --> I
```

---

## 3. Data model (Prisma / SQLite → Postgres)

```mermaid
erDiagram
    User ||--o{ Attempt : makes
    User ||--o| Progress : has
    User ||--o{ Bookmark : saves
    User ||--o{ UserAchievement : unlocks
    User ||--o{ QuestionFeedback : reports

    Category ||--o{ Question : contains

    Question ||--o{ Attempt : "attempted via"
    Question ||--o{ Bookmark : "saved as"
    Question ||--o{ QuestionFeedback : "reported on"

    Attempt ||--o{ Message : contains
    Attempt ||--o{ Assumption : contains
    Attempt ||--o{ Calculation : contains
    Attempt ||--o{ FrameworkNode : contains
    Attempt ||--o| Evaluation : produces

    Achievement ||--o{ UserAchievement : "granted as"

    User {
        string role "user | admin"
        int xp
        int level
        int streak
        string rank "Silver..Diamond"
        float percentile
        float skillRating
    }
    Question {
        string difficulty "Easy | Medium | Hard"
        string interviewLevel "BCG | McKinsey | Bain..."
        string type "guesstimate | case (Phase 2)"
        float idealLow
        float idealHigh
    }
    Attempt {
        string status "in_progress | submitted | abandoned"
        int hintsUsed
        float finalEstimate
    }
    Evaluation {
        int overall
        string readiness
        int structuring
        int logic
        int segmentation
        int assumptions
        int calculation
        int communication
        int business
        int confidence
    }
```

---

## 4. LLM interviewer: pluggable adapter with safe fallback

```mermaid
sequenceDiagram
    participant UI as Practice screen
    participant Route as /api/chat or /api/hint
    participant Idx as lib/llm/index.ts
    participant Env as env.llm.provider
    participant Adapter as anthropic.ts / openai.ts
    participant Mock as mock.ts

    UI->>Route: user message / hint request
    Route->>Idx: interviewerReply(ctx) / interviewerHint(ctx, level)
    Idx->>Env: detect provider (env var → key sniffing → "mock")
    Idx->>Adapter: adapter.reply(ctx) [if anthropic/openai]
    alt success
        Adapter-->>Idx: content
        Idx-->>Route: { content, provider }
    else error (no key, rate limit, network)
        Adapter--xIdx: throws
        Idx->>Mock: mockAdapter.reply(ctx)
        Mock-->>Idx: deterministic content
        Idx-->>Route: { content, provider: "mock (fallback)" }
    end
    Route-->>UI: response
```

The mock adapter is deliberately **deterministic and rule-based** (never reveals the
answer early), so `pnpm test` can assert interviewer behavior without any network calls.

---

## 5. Evaluation rubric

Every submitted attempt is scored across 8 weighted categories (`lib/config/evaluation.ts`),
producing an overall score and a readiness band.

```mermaid
flowchart TD
    subgraph Inputs
        I1["Framework nodes"]
        I2["Assumptions + ratings"]
        I3["Calculations"]
        I4["Final estimate vs.\nideal range"]
        I5["Chat message quality"]
        I6["Hints used"]
    end

    Inputs --> Scorer["evaluate()\nlib/evaluation.ts"]

    Scorer --> S1["Structuring ×1.4"]
    Scorer --> S2["Logic ×1.2"]
    Scorer --> S3["Segmentation ×1.3"]
    Scorer --> S4["Assumptions ×1.2"]
    Scorer --> S5["Calculation ×1.2"]
    Scorer --> S6["Communication ×0.9"]
    Scorer --> S7["Business sense ×1.0"]
    Scorer --> S8["Confidence ×0.8"]

    S1 & S2 & S3 & S4 & S5 & S6 & S7 & S8 --> Overall["Weighted overall (0-100)"]

    Overall --> Band{"Readiness band"}
    Band -->|"≥ 85"| R1["Interview Ready"]
    Band -->|"≥ 70"| R2["Advanced"]
    Band -->|"≥ 50"| R3["Intermediate"]
    Band -->|"< 50"| R4["Beginner"]
```

---

## 6. Gamification & percentile rank

XP/levels reward *activity*; rank rewards *quality* — they are deliberately decoupled.

```mermaid
flowchart LR
    Submit["Attempt submitted"] --> XP["applyAttemptRewards()"]

    subgraph XP calc["XP sources (lib/config/gamification.ts)"]
        X1["+20 base completion"]
        X2["+ floor(overall × 0.8) score bonus"]
        X3["+15 few-hints bonus"]
        X4["+10 streak-day bonus"]
        X5["+25 first attempt of the day"]
    end
    XP --> X1 & X2 & X3 & X4 & X5
    X1 & X2 & X3 & X4 & X5 --> Level["level = f(cumulative XP)\nbase × level^1.35 curve"]

    Submit --> Skill["computeSkillRating()"]
    Skill --> SR["recency-weighted mean of\nlast evaluation scores\n+ consistency bonus"]
    SR --> Percentile["recomputeRank():\npercentile among all\nranked users' skillRating"]

    Percentile --> Rank{"rank band"}
    Rank -->|"≥ 90th pct"| Diamond["💎 Diamond"]
    Rank -->|"≥ 70th pct"| Platinum["💠 Platinum"]
    Rank -->|"≥ 40th pct"| Gold["🥇 Gold"]
    Rank -->|"≥ 0th pct"| Silver["🥈 Silver"]
    Rank -->|"< 5 graded attempts"| Unranked["Unranked (placement)"]
```

---

## 7. Directory guide

```
app/
├── actions/          Server Actions — the app's real "API" (auth, practice, submit, admin, user)
├── api/               Route Handlers for streaming/chat-style endpoints (chat, hint, feedback, admin import)
├── admin/             Admin panel (question/category CRUD, import, feedback queue)
├── dashboard/         Stats, charts, rank card, achievements
├── library/           Browse/filter questions
├── practice/[id]/     Core interviewer + calculator + framework + evaluation UI
└── (login|signup|forgot-password)/   Auth pages

components/
├── ui/                shadcn-style primitives (button, card, dialog, tabs, ...)
├── practice/           Chat panel, calculator, framework builder, tools panel, evaluation report
├── dashboard/          Charts (Recharts), stat cards, rank card, achievements
├── admin/              Question/category managers, CSV/JSON import, feedback queue
└── marketing/          Landing page sections

lib/
├── config/            Central typed config: env, flags, evaluation weights, gamification curve, practice defaults
├── llm/                Pluggable interviewer adapters (mock / anthropic / openai) + prompt builder
├── auth.ts             Signed cookie sessions, guest mode, claim-on-signup
├── evaluation.ts       Rubric scorer (pure, unit-tested)
├── gamification.ts     XP/level/streak/rank rules (pure, unit-tested)
├── calc.ts             Calculator expression engine (pure, unit-tested)
├── progress.ts         Per-user rollups (totals, accuracy, by-category/by-skill)
└── questions.ts / db.ts  Content access, Prisma client singleton

prisma/
├── schema.prisma       Data model (see ERD above)
└── seed-data.ts / seed.ts   14 categories, 24 India-only questions, achievements, demo users
```

---

## 8. Deployment topology

```mermaid
flowchart LR
    subgraph Local["Local dev (default, zero-key)"]
        L1["pnpm dev"]
        L2[("SQLite file")]
        L3["mock interviewer"]
        L4["cookie auth (dev secret)"]
    end

    subgraph Prod["Production (opt-in, all via env vars)"]
        P1["Vercel"]
        P2[("Postgres — Supabase / Neon")]
        P3["Anthropic or OpenAI"]
        P4["Supabase Auth-ready seam (lib/auth.ts)"]
    end

    Local -. "same codebase\nswap env vars only" .-> Prod
```

---

*Diagrams are [Mermaid](https://mermaid.js.org/) and render natively on GitHub. For deep
dives on any single subsystem (evaluation rubric weights, XP curve, rank bands), see the
config files under `lib/config/`, which are intentionally the single source of truth.*
