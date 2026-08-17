# Retention

Why people would come back to EstimateIQ on day 8, and what has to be built for that to be
true. For the system these changes sit inside, see [`ARCHITECTURE.md`](./ARCHITECTURE.md);
for what has already landed, [`CHANGES.md`](./CHANGES.md).

This is a strategy document, not a changelog. Nothing in it is built yet.

---

## 1. The problem is not that there are 46 questions

The library holds 24 guesstimates, 3 cases and 19 simulations. A candidate practising through
placement season exhausts that in under a fortnight, and the instinct is to author more. More
content is worth having, but it cannot be the answer, because the rate a motivated user
consumes content will always beat the rate one person authors it.

The real problem is subtler and entirely self-inflicted: **the app measures progress as
content consumed.** Every surface that tells a user how they're doing counts items finished.
So running out of content and running out of product are the same event, and the app is
built to announce it.

Six mechanics do this, and each one is a few lines:

| Mechanic | Where | What it does to a returning user |
|---|---|---|
| Recommendations hard-filter out every attempted question — `id: { notIn: attemptedIds }` | `recommendQuestions`, `lib/questions.ts` | The dashboard's recommendation strip empties permanently at ~35 attempts. The app literally runs out of things to suggest. |
| Library cards carry no attempt state — `QuestionCardData` has no score, no attempt count | `components/library/question-card.tsx` | The grid looks identical on visit 1 and visit 40. Nothing the user has achieved is visible in the place they spend the most time. |
| 12 achievements, all one-shot, longest horizon `streak-7` | `prisma/seed-data.ts:690-703` | By day 8 there is nothing left to earn. |
| Coins are minted and never spent — no reader anywhere in `app/` or `components/` | `lib/gamification.ts:111` | A currency with no sink, not even rendered. It quietly teaches users that the numbers don't mean anything. |
| A missed day resets the streak to 1 — no freeze, no repair, no reminder | `applyRewardCore`, `lib/gamification.ts` | The day-7/8 cliff, entirely unmitigated. One busy Tuesday erases a week and removes the reason to open the app on Wednesday. |
| Nothing in the product is dated | — | There is no reason to practise **today** rather than eventually. |

And one absence: there is no social layer at all, even though `User.collegeId` is indexed
beside `skillRating` for the express purpose of a single-scan college leaderboard. That was
deliberately deferred (`CHANGES.md:210`) — correctly at the time, since the profile shipped
without promising it.

Two things already work in our favour and should be reused rather than rebuilt. A committed
`SimRun` ends in `phase: "debrief"`, so `findResumableRun` returns null and **simulations are
already replayable today** — nothing surfaces that as progress, which is a presentation gap
rather than an engine one. And because no copy anywhere ever promised leaderboards, shipping
one breaks no promise to anyone.

### The reframe

The tagline is "Duolingo for consulting and PM interviews", and it is worth taking the
comparison seriously. **Duolingo has finite content too.** A determined learner finishes a
language tree. Its retention does not come from out-authoring its users; it comes from four
things, none of which is content volume:

1. **Spaced repetition**, which makes *old* content the product rather than exhausted stock.
2. **A dated daily loop** — something that is true today and gone tomorrow.
3. **Loss aversion** — a streak you can lose, and can protect.
4. **Leagues** — a weekly, resetting, social comparison.

EstimateIQ has the raw material for all four and uses none of it.

There is also a driver specific to this audience that a language app doesn't have. These are
placement-season candidates, and the question they actually care about is *"am I interview-
ready?"* That question never stays answered. A readiness measure that decays — because you
haven't practised structuring in three weeks, not because we deleted anything — is both
honest and the strongest reason to return that this product will ever have.

---

## 2. Lever 0 — instrumentation, before anything else

EstimateIQ is pre-launch. That means every lever below is a **guess**, and the point of
instrumenting first is not dashboards, it is making the guesses falsifiable before they
calcify into features nobody measures.

The scaffolding is already there. PostHog keys sit commented in `.env.example:61-62`, and
`lib/admin-stats.ts` already computes recency rollups from `lastActiveDate` (set on submit,
not on login — so it already means "last practised", which is the more useful signal).

Build it as an adapter, matching `lib/llm`, `lib/storage` and `lib/speech`: a **no-op
provider by default**, a real one behind an env var. That keeps the local-first / zero-key
promise exactly intact — the app must still run and be fully usable with no external
services, and an analytics dependency is the easiest way to break that quietly.

Four metrics are enough to start, and the doc commits to these rather than to a wall of
events:

- **D1 / D7 / D30 return rate** — the headline. Everything below is judged against it.
- **Sessions per active week** — distinguishes a daily habit from a weekend cram.
- **Attempts before last session** — *where* people stop. If the mode clusters near the
  library size, content exhaustion is the cause and Lever 1 is urgent. If it clusters at 1–3,
  the problem is activation, not retention, and this whole document is premature.
- **Content-exhaustion rate** — share of active users past 60% of their *reachable* library.
  Reachable, not total: a free account and a Pro account exhaust at very different points
  (`tierAccess`, `lib/config/access.ts`), and averaging them hides which one is churning.

That third metric is the one that could invalidate the rest of this plan, which is why it is
worth having before launch rather than after.

---

## 3. Lever 1 — mastery instead of a checklist

The highest-leverage change in this document, and it needs **no new content**. It converts
38 items into months of practice by changing what "progress" means.

### Track mastery per question

A `QuestionMastery` rollup keyed `[userId, questionId]`: best score, attempt count, last
attempted, and a decayed due-date. Written where `updateProgress` is already called, and
designed the same way — the repo's existing two-layer pattern, where raw `Attempt` and
`Evaluation` rows stay the source of truth and the rollup exists so reads are cheap.
`lib/progress.ts` is the model to copy, including its habit of skipping non-applicable
categories rather than counting them as zero.

### Invert the recommender

This is the single change that stops the app declaring itself finished, and it is roughly
thirty lines in `lib/questions.ts`.

Today `recommendQuestions` treats "not yet attempted" as a **hard filter**, so the candidate
pool shrinks monotonically to zero. It should become one ranking term among several, ordered
behind *weakest* and *most overdue*. The existing preference-pass structure already supports
this — passes top each other up and stop once there are enough — so the change is to the
`notIn` clause and the pass ordering, not to the shape of the function.

Worth noting what this fixes beyond the empty strip: today a candidate who scored 41 on
structuring will never be shown that question again, while being shown an easier one they
haven't touched. The current recommender actively steers people away from their weaknesses.

### Make replay visible

Progress that isn't rendered isn't progress. Mastery needs to appear where the user already
looks — a mastery ring or best-score badge on library cards (`QuestionCardData` gains the
fields), and a "Due for review" strip on the dashboard beside "Continue practice", which
already exists and already works.

### The scoring trap, stated plainly

A warm retry is easier. The candidate remembers roughly where the ideal range was, so a
second score is not comparable to a first, and this is exactly the kind of thing that gets
discovered eighteen months later when the rank ladder has quietly inflated.

Two pieces of the answer already exist: `computeSkillRating` weights recent attempts more
heavily, and the evaluation report already tells candidates to "retry it cold for an
untouched score" (`components/practice/evaluation-report.tsx:215`), the same posture that
prices Teacher mode into Confidence.

The rule this document sets: **mastery may count replays; percentile rank must not.** Rank
stays evidence about skill, mastery becomes evidence about practice, and grinding a
remembered question moves the second without moving the first. Keeping them separate is the
same reasoning that kept `SimRun` out of the `Attempt` table.

---

## 4. Lever 2 — a dated daily loop

Also content-free, and mostly a matter of putting existing pieces to work.

**A daily challenge.** One question a day, chosen deterministically from a date seed so
**everyone gets the same one**. Determinism is not an implementation convenience here, it is
the entire point — a shared daily question is comparable, discussable and shareable in a
placement-prep WhatsApp group, and a randomly assigned one is none of those things. It reuses
the library as it stands.

**A daily goal and a weekly cycle**, not just a streak integer. A streak says whether you
showed up; a goal says whether you did enough, and a weekly cycle gives a Sunday-evening
reason to catch up.

**Give coins a sink.** They already accumulate at `xpGained / 4` and are spent on nothing.
Streak freezes are the obvious first sink, because they directly address the churn cliff
below; hint credits and cosmetics follow. Any sink is better than none — an unspendable
currency is worse than no currency, because it trains users to ignore every number the app
shows them.

**Streak repair, and longer horizons.** A freeze bought in advance, plus a one-off repair for
the day already missed — the miss is precisely the moment someone decides whether to come
back. And the achievement ladder needs rungs past day 7: `streak-30`, mastery-based ones
("bring five questions to 85+"), breadth-based ones ("a question in every category").

**The honest constraint.** There is no email and no push channel in this app. A daily loop
without a re-engagement channel only reaches people who return unprompted, which is the
population that was never going to churn. Weekly report emails are already on the deferred
list in the README, and they are the multiplier that makes this lever worth more than it
costs — but they need an email provider, and that is a real dependency rather than a config
line. Better to say so than to ship the loop and wonder why it underperforms.

---

## 5. Lever 3 — social, gated on liquidity

The strongest lever for this audience, and the one the schema is already laid for.

`User.collegeId` sits on `User` rather than `Profile` — indexed, next to `skillRating` —
precisely so a college leaderboard is a single indexed scan with no join, and
`lib/config/colleges.ts` exists to keep the grouping key stable ("IIM-B", "IIMB" and "iim
blr" are one school, not three leaderboards). The work is a page and a query, not a
migration.

**Make it a weekly resetting league, not an all-time table.** An all-time leaderboard rewards
whoever started earliest, is unreachable for anyone who joins in month three, and creates no
reason to practise *this* week. A weekly cohort resets the stakes every Monday, which is the
mechanic that actually drives return visits.

**The constraint to state honestly:** leaderboards need liquidity. A fresh install has 40
synthetic benchmark rows against 2 real users (`prisma/seed.ts`, `lib/user-segment.ts`), and
those benchmark rows exist to cold-start the percentile — they are not people, and must never
appear on a board. A leaderboard shipped at launch is an empty room, which is worse than no
leaderboard because it advertises that nobody else is here.

So: gate the board behind a minimum of real users per college, and until that threshold is
met, keep showing the percentile rank against the benchmark cohort — which already works
today, and is the reason the cohort was seeded in the first place.

---

## 6. Lever 4 — multiply content cheaply

More content is still worth having. This is the order to buy it in, cheapest first.

**Simulation variants are the cheapest real content in the repo.** The engine takes the
scenario as a parameter throughout and no scenario id appears in engine code; the outcome
model is deterministic. So a variant with a *different true cause* and re-tuned drivers is
genuinely new play from an already-authored file — the candidate cannot replay from memory,
because what they'd be remembering is now wrong. `SimScenarioOverride` and `lib/sim/overlay.ts`
already prove the pattern works: a driver graph can be swapped at runtime, re-validated, and
fall back to the authored code when the merged scenario doesn't hold. Twelve war rooms at ~3
plausible true causes each is ~36 of them. Any variant must pass `checkBalance`, which brute-forces every
affordable combination to prove the declared best allocation really is best — a variant that
can't clear that bar is a broken scenario, not a new one.

**Parameterised guesstimate variants.** Same structure, different city, segment or year. The
ideal range must be **authored, never generated**: `accuracyHit` feeds `Progress` and the
rank ladder, so a plausible-looking wrong range is worse than no question at all — it teaches
a candidate that a correct answer is wrong, and quietly corrupts everyone's percentile.

**LLM-drafted questions into the admin review queue — never straight to users.**
`Question.source` already reserves the value `"llm"`, and `importQuestions` already validates
every row against `questionImportSchema` with a dry-run mode. The rule: the model proposes, a
human approves, and `freeTier` stays a separate decision — the schema comment on that column
already insists that "is this good" and "is this given away" are different questions, and
generated content is exactly where conflating them would hurt.

**Deprioritise the full-length `case` format.** It has no runtime, it is the most expensive
item on this list, and it should not jump the queue ahead of four levers that need no
authoring at all.

---

## 7. Sequencing

| When | What | Why then |
|---|---|---|
| **Before launch** | Lever 0 (instrumentation) | Every guess below becomes falsifiable. Cheapest thing here, and worthless if added later. |
| **Before launch** | Lever 1 (mastery) | It changes what the product *is*. Shipping the checklist version first means the first cohort experiences the exhaustion this document exists to prevent. |
| **Immediately after** | Lever 2 (daily loop) | Needs real users to tune the goal against, but nothing about it should wait long. |
| **On liquidity** | Lever 3 (leagues) | Blocked on having enough real users per college, not on engineering. |
| **Continuously** | Lever 4 (content) | Simulation variants first; the `case` runtime last. |

### The caveat this deserves

Retention design without users is partly speculative, and it would be dishonest to present
this as anything else. Two things make it worth doing now anyway.

Lever 0 is what converts the rest from conviction into a hypothesis with a result attached.
And Lever 1 is worth building whether or not any of the reasoning above holds, because a
recommender that steers candidates toward their weakest work is a better product for the
first twenty users — not only for the two-thousandth.

The failure mode to watch for: if the instrumented "attempts before last session" clusters at
1–3 rather than near the library size, the problem is **activation, not retention**, and
everything in this document is the wrong work. That measurement should be taken before Lever
2 begins.
