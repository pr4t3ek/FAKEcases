# EstimateIQ — Architecture & Documentation

EstimateIQ is a **local-first, zero-key** Next.js app that lets MBA / consulting / PM
candidates practise India-focused market-sizing guesstimates and business cases against
an AI interviewer, then get a scored evaluation and gamified progress (XP, levels,
streaks, percentile rank).

This document is the visual companion to the root [`README.md`](../README.md): it covers
system architecture, the request/data flow, the data model, and the scoring & gamification
rules, each with a diagram.

For what the gamification in section 6 does *not* yet do — and the retention loop planned
around it — see [`RETENTION.md`](./RETENTION.md).

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
        Ollama["ollama.ts\nstreaming, local, unmetered"]
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
    LLM --> Ollama
    LLM --> Anthropic
    LLM --> OpenAI
    Gemini -. "on error, pre-first-token" .-> Mock
    Ollama -. "on error, pre-first-token" .-> Mock
    Anthropic -. "on error" .-> Mock
    OpenAI -. "on error" .-> Mock
    Domain --> Prisma
    Prisma --> SQLite
    Prisma -. "swap via DATABASE_URL" .-> Postgres

    style Mock fill:#2b6cb0,color:#fff
    style Gemini fill:#2f855a,color:#fff
    style Ollama fill:#2b6cb0,color:#fff
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

    C -->|"pick a simulation"| S0["Start/resume SimRun\n(app/actions/simulations.ts)"]
    S0 --> Sim

    subgraph Sim["Decision simulation (/simulate/[runId])"]
        S1["Observe — dashboard,\nlock a hypothesis"]
        S2["Investigate — buy pulls\nout of an analyst-day budget"]
        S3["Commit — name a cause,\nsplit sprints + ₹"]
        S1 --> S2 --> S3
    end

    Sim -->|"Commit"| SK["runOutcome() + scoreSimulation()\ndeterministic causal model"]
    SK --> SR["Debrief — moved metrics,\ncausal chain, allocation vs best"]
    SK --> H
    SR --> I
```

The two loops share a user, XP and a streak, and nothing else. A simulation writes no `Attempt`
and no `Evaluation`, so `updateProgress` and `recomputeRank` cannot see it — that is what keeps
interview readiness and percentile rank measuring only interview work.

---

## 3. Data model (Prisma / SQLite → Postgres)

```mermaid
erDiagram
    User ||--o{ Attempt : makes
    User ||--o| Progress : has
    User ||--o| Profile : describes
    User ||--o{ Bookmark : saves
    User ||--o{ UserAchievement : unlocks
    User ||--o{ QuestionFeedback : reports
    User ||--o{ SimRun : plays
    Question ||--o{ SimRun : catalogues
    SimRun ||--o{ SimPurchase : buys
    SimRun ||--o| SimResult : scores
    SimRun ||--o{ SimMessage : debriefs

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
        string image "avatar URL — never bytes"
        string collegeId "indexed; null for Other"
        int xp
        int level
        int streak
        string rank "Silver..Diamond"
        float percentile
        float skillRating
    }
    Profile {
        string phone
        string city
        string bio
        string profession
        string collegeOther "written-in; grouped with nobody"
        int gradYear
        string targetLevels "JSON INTERVIEW_LEVELS[]"
        string avatarData "base64 — db store only"
        int avatarVersion "cache-busts the served URL"
    }
    Question {
        string difficulty "Easy | Medium | Hard"
        string interviewLevel "BCG | McKinsey | Bain..."
        string type "guesstimate | qualitative | case"
        boolean freeTier "reachable without an account"
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

### The simulation tables

```mermaid
erDiagram
    SimRun {
        string id PK
        string userId FK
        string questionId FK "the catalogue Question"
        string scenarioSlug "key into lib/sim/registry"
        string phase "observe|investigate|commit|debrief"
        int daysSpent "analyst-days, cached from purchases"
        string hypothesis "JSON causeId[] — locked once Investigate opens"
        string diagnosis "JSON causeId[]"
        string allocation "JSON SimAllocationLine[]"
    }
    SimPurchase {
        string id PK
        string runId FK
        string drilldownId
        int cost "pinned at purchase — retuning content can't move a past score"
        int seq "1-based, so 'cheaply AND early' is answerable"
    }
    SimResult {
        string id PK
        string runId FK "unique"
        int overall
        string band "own vocabulary, never readinessBands"
        int hypothesis "the five simRubric keys, all non-null"
        int investigation
        int diagnosis
        int decision
        int outcome
        string outcomeJson "pinned quarterly paths — never recomputed on read"
    }
    SimMessage {
        string id PK
        string runId FK
        string role
        string content
        string provider "badges a degraded answer across a reload"
    }
```

**Why these are not `Attempt` and `Evaluation`.** `updateProgress` and `recomputeRank`
(`lib/progress.ts`) query `Attempt` + `Evaluation` directly, as does `lib/admin-stats.ts`. Had a
simulation written an `Evaluation`, keeping interview readiness honest would depend on remembering
an exclusion filter at four-plus query sites, forever. Separate tables mean there is no filter to
forget — `lib/progress.ts` did not change when simulations were added. The nine `Evaluation`
columns are also named for interview behaviours (`segmentation`, `calculation`) and would have
poisoned `Progress.bySkill` and the dashboard radar.

`SimPurchase` carries a unique constraint on `(runId, drilldownId)`: a double-click must not be
charged twice for the same cut.

### Admin driver overrides

`SimScenarioOverride` is the one simulation table that holds *content* rather than a run. It stores
a JSON `SimDriver[]` keyed by scenario slug — an override of the graph authored in code, never a
replacement for the scenario.

```
lib/sim/registry.ts     authored scenarios, pure, sync    ← the default
        │
lib/sim/overlay.ts      parse → merge → re-validate       ← pure, falls back on failure
        │
lib/scenario-store.ts   + SimScenarioOverride             ← server-only, what pages call
```

The ordering is the design. Code is the default, so an empty table is a working app, `db:reset` is
harmless, and the test suite still exercises the real authored numbers. Only `drivers` is
overridable: causes, drilldowns and interventions reference driver ids, and letting both sides move
at once turns one bad save into a scenario that no longer agrees with itself.

**Where each guarantee is enforced.** Authored scenarios were checked once by CI before they could
ship. Runtime editing has no such gate, so `saveScenarioDrivers` runs the same three checks against
the merged scenario before writing: a Zod parse (shape), `validateScenario` (cross-references), and
`checkBalance` (that `bestAllocation` is still the best affordable play). The third is the one worth
naming — it is the ceiling `scoreOutcome` normalises against, so an edit that dethrones it leaves a
scenario that renders and scores normally while grading against a ceiling that is not the top.
`checkBalance` moved out of `tests/sim-scenario.test.ts` into `lib/sim/balance.ts` for exactly this
reason: one implementation, called by both the suite and the save path.

Loading re-runs the shape and structure checks and falls back to the authored scenario if either
fails, because a *code* change can invalidate a stored override that was valid when saved. Balance
is not re-run per load — 2^n outcome projections is a save-time cost, not a render-time one — so the
admin editor surfaces a rejected override with its reason and offers an on-demand re-check.

### The teaching layer

Almost every scenario carries a `teaching` block — an authored **concept primer** and an opt-in
**metric map**. The two are gated separately and deliberately: the primer is vocabulary, which is a
barrier rather than a clue, so it ships on all but the oldest scenario. The map is structure, which
on a hard scenario is most of the answer, so `toClientScenario` ships it only when the scenario
opts in. The map is derived from the driver graph by `lib/sim/metric-map.ts` rather than drawn, so
it cannot disagree with the arithmetic it explains, and drift and intervention effects stay
server-side either way — it shows how metrics relate and never which lever fixes them.

`validateScenario` enforces what `difficulty: "Easy"` promises — at most six drilldowns, six
causes one level deep, five interventions, a budget covering about half the board, and a primer.
Otherwise "simpler" decays one scenario at a time.

---

## 3a. Access tiers (and the road to freemium)

A guest reaches one guesstimate, one case and one simulation. Everything else needs an
account. The rule is a property of a *tier* rather than of a user row, which is what keeps a
future paid plan from becoming a scavenger hunt through every call site.

```mermaid
flowchart TB
    U["User row<br/>(or no session at all)"] --> T["tierFor()<br/>lib/entitlements.ts"]
    T -->|"isGuest, or no session"| G["guest"]
    T -->|"proUntil null or past"| F["free"]
    T -->|"proUntil > now"| P["pro"]

    G & F & P --> TA["tierAccess<br/>lib/config/access.ts"]
    TA --> C{"content"}
    C -->|"free-tier-only<br/>(guest AND free)"| Q1["only Question.freeTier"]
    C -->|"all (pro)"| Q2["the whole library"]

    Q1 & Q2 --> CO["canOpen(tier, question)"]

    CO --> Gate["SERVER GATE — the control<br/>startAttempt · startSimulation<br/>refuse → /library?wall=locked"]
    CO --> UI["UI — a courtesy<br/>locked card · wall banner<br/>dashboard recommendations"]

    style Gate fill:#9b2c2c,color:#fff
    style TA fill:#2b6cb0,color:#fff
```

**One function, both callers.** The card and the gate call the same `canOpen`. Anything else
and the two drift: either the app offers what the server refuses, or it hides what the server
would have allowed. The card is decoration — a forged Server Action call with a locked
question id is bounced by `startAttempt` exactly like a click would have been.

**The freemium switch was one line.** `tierAccess` is the only place that says what a tier
reaches, so turning the paywall on meant setting `free` to `content: "free-tier-only"` and
giving it an `upgrade`. No gate, card, banner or recommendation changed — they were all
written against the table. `recommendQuestions` takes the tier as a *required* argument for
the same reason: recommending something the user cannot open is a worse failure than not
recommending, so the safe case must not be the one you have to remember to ask for.

**Pro is a deadline, not a subscription.** `User.proUntil` is one nullable timestamp and
`tierFor()` compares it against `now`, which is why there is no cron, no renewal job and no
stored tier label to fall out of sync — an expired pass is simply not greater than now.
`nextProUntil` (`lib/billing.ts`) extends rather than resets, so a second grant adds to what
is left instead of confiscating it. Nothing is purchasable yet: `grantPro` in
`app/actions/admin.ts` is the sole entry point, and it is the seam a payment webhook will call
once one exists.

**Both gates resume before they refuse.** An attempt or a run already under way stays openable
even if its question is un-flagged underneath it. Stranding a half-built tree, or a war room
with analyst-days already spent, to enforce a merchandising decision is not a trade worth
making.

**`freeTier` is not part of the authoring contract** (`lib/question-schema.ts`). Whether a
question is good and whether it is given away are different decisions, and putting the flag in
`toQuestionColumns` would let every admin edit and every CSV re-import reset it. It is written
by the seed and by one dedicated action, `setQuestionFreeTier` — which is also the only
control that works on a simulation, whose catalogue row the question form deliberately refuses
to edit.

---

## 3b. Profile, and the avatar seam

`Profile` is a 1:1 side table for the same reason `Progress` is one, and the reason is a single
fact: **`getSessionUser()` returns the whole `User` row on every page in the app.** A bio, a
phone number and a base64 photo living there would be serialised into every payload the app
sends, to render a header that needs none of them.

So the split is by *access pattern*, not by how profile-shaped a field feels. Anything queried,
grouped or ranked by stays on `User` — `collegeId`, indexed, sitting beside the `skillRating` a
cohort ranking would read. Anything shown only when someone opens their own profile lives on
`Profile`.

```mermaid
flowchart LR
    Pick["Browser<br/>crop → 256px → JPEG q0.8"] -->|"~30 KB data URI"| Act["uploadAvatar()<br/>server action"]
    Act --> Val["lib/avatar.ts<br/>validateAvatarDataUri"]
    Val -->|"sniffs the BYTES,<br/>not the declared mime"| Store["AvatarStore.put()<br/>lib/storage"]
    Store --> DB["db provider<br/>Profile.avatarData"]
    Store -.->|"later, no call-site change"| S3["s3 provider<br/>CDN"]
    DB --> URL["returns /api/avatar/id?v=n"]
    S3 -.-> URL2["returns https://cdn/…"]
    URL & URL2 --> Img["User.image"]
    Img --> Header["&lt;img src&gt; in AppHeader"]

    style Val fill:#9b2c2c,color:#fff
    style Store fill:#2b6cb0,color:#fff
```

**`put()` returns a URL, and that is the whole seam.** The built-in provider hands back a route
path and serves the row; an object store would hand back a CDN address. `User.image` stores
whichever, every render is an `<img src>`, and nothing downstream can tell which answered.

**The browser resize is a convenience; the server check is the control.** A Server Action
accepts whatever it is sent, so `validateAvatarDataUri` reads the type out of the leading magic
bytes and returns *that* as the mime to store — the declared `data:image/jpeg` is a claim by
the caller. It matters specifically because the bytes are served back from our own origin with
the stored `Content-Type`. SVG is refused outright: a document that can carry script is not an
image. The size is capped against the base64 string *before* anything is decoded.

`avatarVersion` rides in the served URL's query string, which is what makes
`Cache-Control: immutable` truthful — a replaced photo is a new URL, so a cached copy is never
the wrong one.

**Goals are the only part of a profile that changes behaviour**, and they reuse
`INTERVIEW_LEVELS` rather than a parallel vocabulary, so a stated goal is directly expressible
as a library filter. `recommendQuestions` runs preference passes that are skipped entirely when
no goals are set — a provable no-op for anyone without a profile, which is what makes turning
personalisation on safe.

One naming trap worth recording: `User.onboardedAt` means *"has seen the practice-screen
tutorial"* and nothing else. The profile step is `profileCompletedAt`, deliberately named apart
from it, because one column for both would silently suppress the tutorial for anyone who filled
in their profile first.

---

## 4. LLM interviewer: streaming adapter with safe fallback

```mermaid
sequenceDiagram
    participant UI as Practice screen
    participant Route as /api/chat or /api/hint
    participant Budget as llm/budget.ts
    participant Idx as lib/llm/index.ts
    participant Adapter as gemini.ts (or ollama/anthropic/openai)
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
- **The spend guards apply only to metered providers** (`isMeteredLlm` in `lib/config/env.ts`).
  `ollama.ts` runs a local model that bills nothing, so blocking its turns would substitute the
  mock for the very thing under development while looking like a normal session.

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
├── admin/             Admin panel (question/category CRUD, import, feedback queue,
│                       simulation driver overrides)
├── dashboard/         Stats, charts, rank card, achievements
├── library/           Browse/filter questions
├── practice/[id]/     Core interviewer + calculator + framework + evaluation UI
├── simulate/[runId]/  Decision simulation: dashboard, drilldown market, commit, debrief
└── (login|signup|forgot-password)/   Auth pages

components/
├── ui/                shadcn-style primitives (button, card, dialog, tabs, ...)
├── practice/           Chat panel, calculator, framework builder, tools panel, evaluation report
├── simulation/         Sim dashboard panels, metric map, concept primer, drilldown market,
│                       commit panel, debrief report, coach
├── dashboard/          Charts (Recharts), stat cards, rank card, achievements
├── admin/              Question/category managers, CSV/JSON import, feedback queue,
│                       scenario driver editor
└── marketing/          Landing page sections

lib/
├── config/            Central typed config: env, access tiers, evaluation weights, gamification curve,
│                       practice defaults, profile vocabularies, the curated college list
├── storage/            Avatar bytes behind an AvatarStore interface (db today; S3 is a file + a case)
├── entitlements.ts     What a tier may open — pure, shared by the server gates and the UI
├── avatar.ts           Upload validation (magic-byte sniffing), URL building, initials — pure
├── profile-schema.ts   The profile authoring contract, shared by /profile and /welcome
├── profile.ts          Profile reads, and the rule for pre-applying goals to the library
├── llm/                Streaming interviewer adapters (mock / gemini / ollama / anthropic / openai),
│                       prompt builder, NDJSON protocol (stream.ts), spend guards (budget.ts)
├── sim/                Simulation engine — all pure, no DB: types, scenarios/, registry,
│                       drivers (metric DAG incl. quotient/constant), outcome (causal model),
│                       investigate (pricing), score, debrief, metric-map (derived teaching
│                       view), redact (client projection), payload, validate,
│                       balance (best-allocation invariants), overlay (admin driver overrides)
├── auth.ts             Signed cookie sessions, guest mode, claim-on-signup
├── evaluation.ts       Rubric scorer (pure, unit-tested)
├── gamification.ts     XP/level/streak/rank rules (pure, unit-tested)
├── calc.ts             Calculator expression engine (pure, unit-tested)
├── progress.ts         Per-user rollups (totals, accuracy, by-category/by-skill)
├── simulations.ts      Simulation data access (runs, purchases, results) — the only file
│                       that touches Prisma for a sim, so lib/sim stays pure
├── scenario-store.ts   Scenario loading with admin overrides applied, always falling back
│                       to the authored scenario in lib/sim/registry
└── questions.ts / db.ts  Content access, Prisma client singleton

prisma/
├── schema.prisma       Data model (see ERD above)
└── seed-data.ts / seed.ts   15 categories, 38 India-only questions (24 guesstimates
                             + 2 cases + 12 simulation catalogue rows), 12 achievements,
                             demo users, benchmark cohort
```

---

## 8. Deployment topology

```mermaid
flowchart LR
    subgraph Local["Local dev (default, zero-key)"]
        L1["pnpm dev"]
        L2[("SQLite file")]
        L3["mock interviewer\n(or local Ollama, opt-in)"]
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
