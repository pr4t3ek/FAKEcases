# EstimateIQ — Architecture & Documentation

EstimateIQ is a **local-first, zero-key** Next.js app that lets MBA / consulting / PM
candidates practise India-focused market-sizing guesstimates and business cases against
an AI interviewer, then get a scored evaluation and gamified progress (XP, levels,
streaks, percentile rank).

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
        Budget["llm/budget.ts\nper-user + daily spend guards"]
    end

    subgraph Providers["LLM providers"]
        Mock["mock.ts\ndeterministic offline interviewer"]
        Gemini["gemini.ts\nstreaming, free tier"]
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
    UI -- "streaming chat (NDJSON)" --> Routes
    Pages --> Domain
    Actions --> Domain
    Routes --> Domain
    Routes --> Budget
    Budget -. "over quota → serve mock" .-> LLM
    LLM --> Mock
    LLM --> Gemini
    LLM --> Anthropic
    LLM --> OpenAI
    Gemini -. "on error, pre-first-token" .-> Mock
    Anthropic -. "on error" .-> Mock
    OpenAI -. "on error" .-> Mock
    Domain --> Prisma
    Prisma --> SQLite
    Prisma -. "swap via DATABASE_URL" .-> Postgres

    style Mock fill:#2b6cb0,color:#fff
    style Gemini fill:#2f855a,color:#fff
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
        E2["Framework builder\n(tree canvas; issue tree on a case)"]
        E3["Assumptions, derived from\nthe tree + the transcript"]
        E4["Calculator (draggable popup)"]
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
        string type "guesstimate | qualitative | case"
        float idealLow "guesstimate only"
        float idealHigh "guesstimate only"
        string rootCause "case only — JSON"
        string expectedBuckets "case only — JSON"
        string dataPack "case only — JSON"
    }
    Attempt {
        string status "in_progress | submitted | abandoned"
        string treeMode "solo | guided — null on a guesstimate"
        int hintsUsed
        float finalEstimate
        string finalAnswer "the recommendation, on a case"
    }
    Evaluation {
        int overall
        string readiness
        int structuring "null when guided"
        int logic
        int segmentation "null when guided"
        int assumptions
        int calculation "null on a case"
        int diagnosis "null without a root cause"
        int communication
        int business
        int confidence
    }
```

**Two question types, one pipeline.** `answerModeFor(type)` (`lib/types.ts`) maps a
question to `numeric` or `qualitative`, and everything downstream — the builder, the
scorer, the prompts — branches on that rather than on `type` itself. A nullable score
means "this category never applied to this attempt", which is a different claim from
zero and is preserved as one all the way into the database.

---

## 4. LLM interviewer: streaming adapter with safe fallback

```mermaid
sequenceDiagram
    participant UI as Practice screen
    participant Route as /api/chat or /api/hint
    participant Budget as llm/budget.ts
    participant Idx as lib/llm/index.ts
    participant Adapter as gemini.ts (or anthropic/openai)
    participant Mock as mock.ts

    UI->>Route: user message / hint request
    Route->>Budget: checkBudget(userId)
    Budget-->>Route: ok | user_limit | daily_limit
    Route->>Idx: interviewerReplyStream(ctx, { budgetBlocked })
    Idx->>Adapter: adapter.reply(ctx) [provider from env]

    alt success
        loop each chunk
            Adapter-->>Idx: delta
            Idx-->>Route: delta
            Route-->>UI: {"t":"delta","v":"…"}
        end
    else fails before the first token (bad key, quota, network)
        Adapter--xIdx: throws
        Note over Idx: one retry only if transient (per-minute limit)
        Idx->>Mock: mockAdapter.reply(ctx)
        Mock-->>Idx: deterministic content
        Note over Route,UI: provider = "mock (fallback)" → badged in the chat
    else fails mid-stream
        Adapter--xIdx: throws after partial text
        Note over Idx: the mock is NOT spliced on — switching engines<br/>mid-paragraph reads worse than an obvious truncation
        Route-->>UI: {"t":"error","code":"…"}
    end

    Route->>Route: persist assistant message (+ provider, model)<br/>before closing the stream
    Route-->>UI: {"t":"done","provider":"…","model":"…"}
```

Two design points worth keeping:

- **The failure split is deliberate.** Before any text has streamed, the user has seen nothing, so
  serving the mock produces a complete, coherent answer. Once real text is on screen, splicing mock
  output onto the end would change voice and reasoning mid-paragraph — worse than a visibly
  truncated reply. `tests/llm-stream.test.ts` pins both halves.
- **Degradation is always visible.** Any mock-produced turn is persisted with its `provider` and
  badged "offline interviewer" in the chat, so a downgraded answer is never mistaken for the model's.

The mock adapter is deliberately **deterministic and rule-based** (never reveals the
answer early), so `pnpm test` can assert interviewer behavior without any network calls.

---

## 5. Evaluation rubric

There are 9 categories in `lib/config/evaluation.ts`, and no attempt is scored on all of
them. Each carries two weights — one for a guesstimate, one for a case — and a weight of
0 takes it out of that mode entirely. The weighted mean renormalises over whatever
applied, so a case scored on 7 categories and an estimate scored on 8 land on the same
0–100 scale, and XP, rank and the readiness bands need no per-mode arithmetic.

```mermaid
flowchart TD
    subgraph Inputs
        I1["Framework / issue tree"]
        I2["Assumptions, derived from
            the tree + the transcript"]
        I3["Calculations"]
        I4["Final estimate vs. ideal range
            — or the recommendation"]
        I5["Chat message quality"]
        I6["Hints used · solution revealed"]
    end

    Inputs --> Mode{"answerModeFor(type)"}
    Mode -->|numeric| Scorer["evaluate()"]
    Mode -->|qualitative| ScorerQ["evaluateQualitative()"]

    Scorer --> W["Weighted mean over the
                  categories that applied"]
    ScorerQ --> W

    W --> Overall["Overall (0-100)"]
    Overall --> Band{"Readiness band"}
    Band -->|"≥ 85"| R1["Interview Ready"]
    Band -->|"≥ 70"| R2["Advanced"]
    Band -->|"≥ 50"| R3["Intermediate"]
    Band -->|"< 50"| R4["Beginner"]
```

| Category | Guesstimate | Case | Not scored when |
|---|---|---|---|
| Problem Structuring | ×1.4 | ×1.0 | guided attempt |
| Logical Thinking | ×1.2 | ×1.2 | — |
| Segmentation / MECE Coverage | ×1.3 | ×1.0 | guided attempt |
| Assumption / Rationale Quality | ×1.2 | ×1.2 | — |
| Calculation Accuracy | ×1.2 | — | case (no arithmetic) |
| Diagnosis | — | ×1.6 | no declared root cause |
| Communication | ×0.9 | ×1.0 | — |
| Business Sense | ×1.0 | ×1.2 | — |
| Confidence | ×0.8 | ×0.8 | — |

Structure is worth less on a case — the frameworks recur, so reproducing one isn't the
skill — and Diagnosis carries that weight instead, because localising the problem inside
a known tree is the hard part.

**Help is priced, not free.** Hints cost Confidence as they escalate, and Teacher mode —
the one AI mode whose prompt actually works the problem — costs the equivalent of the
whole hint ladder. A guided tree isn't scored on structure at all, because the app built
it. Each is derived from what was persisted (`Message.mode`, `Attempt.treeMode`) rather
than tracked separately, and each is disclosed in the report.

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
    SR --> Percentile["recomputeRank():\npercentile among registered\nranked users (guests excluded)"]

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
├── llm/                Streaming interviewer adapters (mock / gemini / anthropic / openai),
│                       prompt builder, NDJSON protocol (stream.ts), spend guards (budget.ts)
├── auth.ts             Signed cookie sessions, guest mode, claim-on-signup
├── evaluation.ts       Rubric scorer (pure, unit-tested)
├── gamification.ts     XP/level/streak/rank rules (pure, unit-tested)
├── calc.ts             Calculator expression engine (pure, unit-tested)
├── progress.ts         Per-user rollups (totals, accuracy, by-category/by-skill)
└── questions.ts / db.ts  Content access, Prisma client singleton

prisma/
├── schema.prisma       Data model (see ERD above)
└── seed-data.ts / seed.ts   14 categories, 26 India-only questions (24 guesstimates
                             + 2 cases), 8 achievements, demo users, benchmark cohort
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
        P3["Gemini (free tier)\nor Anthropic / OpenAI (paid)"]
        P4["Supabase Auth-ready seam (lib/auth.ts)"]
    end

    Local -. "same codebase\nswap env vars only" .-> Prod
```

---

*Diagrams are [Mermaid](https://mermaid.js.org/) and render natively on GitHub. For deep
dives on any single subsystem (evaluation rubric weights, XP curve, rank bands), see the
config files under `lib/config/`, which are intentionally the single source of truth.*
