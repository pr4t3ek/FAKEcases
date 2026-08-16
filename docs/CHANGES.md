# Changes

A short changelog for the fixes landed on `claude/repo-review-pqactr`. For the system
design these sit inside, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

### 1. Teacher mode is priced

Teacher mode's prompt works the whole problem through — including a sample estimate —
and nothing in scoring knew it had happened. Exhausting the hints even routed you there,
under the label "Explain." An attempt that read the solution and one that didn't could
score the same, which made "never reveal the answer early" true only of the chat panel.

`solutionWasRevealed()` (`lib/evaluation.ts`) now reads the persisted transcript for a
`Message.mode === "teacher"` turn and charges it in Confidence — the same cost as
exhausting the full hint ladder — in both scorers (`evaluate`, `evaluateQualitative`).
The switch is confirmed before it happens (`components/practice/chat-panel.tsx`) and
disclosed on the evaluation report (`components/practice/evaluation-report.tsx`). No
schema change: the signal was already on the row.

### 2. `saveFramework` can no longer destroy a tree

The save ran as three separate statements — delete, recreate, link parents. A dangling
`parentId` (the realistic client-side bug) surfaced *after* the delete, so the candidate
lost their tree to a failed save.

`app/actions/practice.ts` now runs all three inside one `db.$transaction`. The payload is
validated against a new schema (`lib/framework-payload.ts`) that caps node count and
label length and rejects any `parentId` not present in the same save — so a malformed
save is a no-op instead of a deletion.

### 3. Cases are authorable through the admin panel and CSV import

Cases could previously only be added by hand-editing `prisma/seed-data.ts`. The admin
form and the importer both required an ideal range unconditionally, so editing an
existing case through the UI stamped a fabricated `0`–`0` range onto it (a blank number
field coerces to zero).

`lib/question-schema.ts` is now the one authoring contract both surfaces share: a case
can't carry an ideal range, a guesstimate can't carry a root cause, and a malformed
`rootCause` or `dataPack` is a save error rather than a case that silently can't score
Diagnosis. The admin form (`components/admin/question-manager.tsx`) gained a type
selector and case-only fields; the CSV template (`lib/csv.ts`) now includes a worked case
row.

### 4. Guests no longer skew the rank pool

Every visitor who clicks "Start practising" gets a real `User` row, and those rows were
counted in the percentile population — so a candidate's Silver→Diamond rank moved with
anonymous drive-by traffic. `recomputeRank()` (`lib/progress.ts`) now filters the
population to `isGuest: false`. Guests are still scored; they're just excluded from
everyone else's comparison.

### 5. The repo stopped claiming things it didn't do

- Removed `lib/config/flags.ts` (nothing read it, and two of its flags were wrong),
  two dev scratch files (`_smoke.mjs`, `_smoke2.mjs`), and an unreferenced 5.4 MB PDF.
- `pnpm lint` now actually runs — there was no ESLint config or dependency before
  (`eslint.config.mjs` added).
- `pnpm db:seed` / `db:reset` now use `prisma db seed` instead of bare `tsx`, which never
  loaded `.env` — the documented quick start failed at its last step on a clean clone.
- Fixed doc drift: `docs/ARCHITECTURE.md`'s rubric section and ERD were missing
  Diagnosis and `treeMode` and still called cases "Phase 2"; the question count was
  stale.
- The landing page's Pro tier and the forgot-password form now say plainly that they're
  not functional, instead of quietly behaving like they are. A "Known limitations"
  section was added to the README.

### 6. Tightened diagnosis matching

`labelMatches()` (`lib/evaluation.ts`) matched by substring in both directions, so a
one-character branch label (e.g. `"s"`) would match almost any root-cause step and let a
junk tree score as a correct diagnosis. It now requires a run of whole words to match,
either direction — enough to tolerate a candidate's shorter or longer phrasing of a
branch, not enough to match on a fragment.

### 7. Backspace no longer deletes a branch

Backspace on an empty label used to remove the row — including a branch just created,
since a fresh node has no children and satisfied the delete guard. Clearing a label to
rewrite it was one keystroke from losing the branch, with no undo.
`components/practice/framework-builder.tsx` no longer treats Backspace as structural; the
outline view's trash button was also switched from calling `remove()` directly to going
through the existing `requestRemove()` confirmation, matching every other delete control
in the app.

### 8. Subject icons on library cards

Every card in `/library` looked identical — three badges, a title, two lines of prompt —
so a grid of them could only be read, not scanned. Each card now leads with an icon for
what the question is actually about: a phone for the smartphone question, a train for the
Delhi Metro one, a syringe for insulin.

The icon is derived, not authored. `lib/question-icon.ts` matches the title and tags
against an ordered rule list (whole words only, narrowest rule first) and falls back to
`Category.icon` — a column that had been populated since the schema was written and read
by nothing until now. A question added through the admin panel or a CSV import therefore
gets an icon with no extra authoring. `components/library/question-icon.tsx` maps the name
to a statically imported `lucide-react` component, so only the icons actually used reach
the bundle (~6 kB for the set).

`tests/question-icon.test.ts` pins the expected icon for all 26 seeded questions by name,
plus the specificity orderings that matter ("credit card" before both "car" and "banking",
"food delivery" before "food", "hospital bed" before "hospital").

### 9. A Users dashboard in the admin panel

`/admin` managed content and showed nothing about the people using the app, though every
figure was already in the database. There's now a **Users** tab — read-only — with headline
counts, a 30-day signups chart, a rank distribution, and a searchable, sortable, filterable
user table.

The thing that shaped the design: **a fresh install has 42 users and 40 of them are fake.**
`prisma/seed.ts` mints 40 synthetic `benchmark_N@seed.estimateiq` accounts purely to give
the percentile rank a cold-start population. Reporting 42 users would be off by twenty
times. `lib/user-segment.ts` classifies every row as `registered` / `guest` / `benchmark`,
`lib/admin-stats.ts` excludes benchmark rows from every headline number, and the tab says
so in a line under the cards. They stay reachable behind a Benchmark filter so the rank
population is still auditable. The seed now imports the domain constant rather than
spelling it out, so the writer and the readers can't drift apart.

One label worth getting right: `User.lastActiveDate` is written on *submit*
(`lib/gamification.ts`), not on login, so the column is "Last practised" rather than "Last
active" — calling it activity would overstate engagement.

Chart styling (`CHART_TOOLTIP_STYLE`, `CHART_TICK`) was extracted from
`components/dashboard/charts.tsx` and shared rather than copied. Rows are capped at 500
rather than paginated, which is commented as the deliberate demo-scale choice it is.

### 10. A guest gets one of each format, and the rest is locked

A guest could reach the entire library and was stopped only by a running total — three
submitted attempts, one simulation run. That gives away all thirty-five items to anyone
patient enough to open them one at a time, and turns people away from questions they have
never seen.

Access is now a property of a **tier** (`guest` / `free` / `pro`) rather than an `isGuest`
check at each call site. `lib/config/access.ts` says what each tier reaches; `lib/entitlements.ts`
is the pure rule, called by both the server gates (`startAttempt`, `startSimulation`) and the
library card, so the two cannot disagree. A guest gets the questions flagged
`Question.freeTier` — seeded as chai in Bangalore, the food-delivery margin case and the Kadak
Coffee war room — and a locked card that links to sign-up rather than a dead button. The old
caps are gone; replaying the free three is unmetered.

The flag is deliberately outside the authoring contract in `lib/question-schema.ts`. Whether a
question is good and whether it is given away are different decisions, and folding it into
`toQuestionColumns` would have let every admin edit and every CSV re-import quietly relock the
shop window. It is written by the seed and by `setQuestionFreeTier`, which is also the only
control that works on a simulation, whose catalogue row the question form refuses to edit.

Two things this exposed. The guest wall banner in `app/library/page.tsx` had never once
rendered: the caps redirected to `/signup?wall=1`, and only the library reads that parameter —
so the soft wall was silently a hard bounce to a bare signup form. Refusals now land on
`/library?wall=locked`, where the banner explains what happened and the free items are still on
the page. And `recommendQuestions` now takes the tier as a required argument; the dashboard
turns guests away today, so it is inert, but it is the surface that would have started handing
out locked cards the moment `free` became restricted.

**Going freemium is a change to `tierAccess`, not to any gate**: set `free` to
`content: "free-tier-only"`, point its `upgrade` at checkout, and the gates, cards, banner and
recommendations all follow.

### 11. A profile, an account menu, and questions after signing up

The app had no profile, settings or account surface at all. Three things followed from that:
`User.name` was written at signup and never again, so anyone who skipped the optional name
field was permanently "Learner"; `User.image` had existed since the first schema with zero
reads and zero writes; and there was no way to change a password, which combined with the
disabled reset form meant a forgotten password was a new account.

There is now `/profile` — photo, name, phone, city, bio, background, goals and a password
change — reachable from an avatar menu in the header, which replaced a bare sign-out icon that
sat one unguarded click from ending the session. Signing up lands on `/welcome`, two skippable
steps of the same questions, and the dashboard asks once more.

**The data model splits by access pattern, not by how profile-shaped a field feels.**
`getSessionUser()` returns the whole `User` row on every page in the app, so a bio and a base64
photo living there would be serialised into every payload the app sends. `collegeId` stays on
`User` — indexed, beside the `skillRating` a cohort ranking would read — and everything
display-only moved to a `Profile` side table, the same shape and the same argument as
`Progress`.

**The avatar upload is the interesting part.** No new dependency: the browser centre-crops,
scales to 256px and JPEG-encodes before uploading, so ~30 KB crosses the wire instead of 4 MB
and there is no `sharp` to install. None of that is a control — a Server Action takes whatever
it is sent, so `validateAvatarDataUri` caps the size before decoding and reads the type out of
the leading magic bytes rather than trusting the data URI's declared mime, returning the
sniffed type as the one to store. That matters because the bytes are served back from our own
origin with the stored `Content-Type`; a shell script labelled `image/jpeg` would otherwise be
fetchable from a same-origin URL. SVG is refused outright as a document that can carry script.
The bytes sit behind an `AvatarStore` whose `put()` returns a **URL**, mirroring `lib/speech`,
so `User.image` holds a route path today and would hold a CDN address under an object store
with no call site changing.

**Goals are the only part that changes behaviour, and the copy says so.** Target roles reuse
`INTERVIEW_LEVELS`, so `recommendQuestions` can run preference passes against them and the
library can pre-apply one. Both are careful: the recommendation passes are skipped when no
goals are set, making the change a provable no-op for anyone without a profile, and the library
pre-applies only when there is **exactly one** target, because `?level=` holds a single value
and applying one of three would show someone a third of what they asked for while claiming to
have used their goals.

Two naming traps handled rather than documented around: `onboardedAt` already meant "has seen
the practice-screen tutorial", so the new flag is `profileCompletedAt`, named apart from it —
one column for both would have silently suppressed the tutorial for anyone who filled in their
profile. And "Other" for a college stores a null id plus the written-in name, so it is grouped
with nobody, which is the honest consequence of picking a curated list over free text.

Deliberately not built: leaderboards. The college field, its index and its stable grouping key
ship here, and **no copy anywhere promises the feature they're for** — the nudge sells what is
true the day it ships, which is that goals change what the library shows first.

### 12. Freemium: a paid tier that works, without a payment gateway

The tier table added in item 10 was built for this, and turning the paywall on was the one line
it was designed to be — `tierAccess.free` from `content: "all"` to `"free-tier-only"`. Every
gate, locked card, wall banner, library count and dashboard recommendation followed on its own,
because they were all written against that table rather than against an `isGuest` check.

What was actually missing was that **nobody could become Pro**. `User.plan` existed, was read
in exactly one place and written nowhere. It is replaced by `User.proUntil`, a single nullable
timestamp, and removed rather than kept alongside — two sources of truth for one question is
the trap the tier table exists to avoid.

**A pass is a deadline, not a subscription**, and that choice pays for itself. `tierFor()`
compares `proUntil` against now, so there is no renewal job, no cron, no cancel flow and no
stored label that can drift. An expired pass is not greater than now, and the account is free
again — proved by backdating one and watching the library re-lock, the profile flip and the
server gate start refusing, with nothing having run. `nextProUntil` extends rather than resets,
because granting a second pass that silently ate the remaining days of the first would be the
kind of bug nobody reports.

Passes are granted from **Admin → Users** (+30 / +90 / Revoke). Not a stopgap: support, comps
and refunds need it permanently, and it keeps the paid tier usable with no gateway configured —
the same posture as the mock interviewer with no LLM key. **It is also the seam a checkout
webhook will call**, which is why the entitlement half is complete and testable before any
money moves.

Two things the browser pass caught that the unit tests could not. The library's count line said
"32 unlocked by a free account" to someone who *had* a free account — the phrase now comes from
the tier table (`UpgradePath.unlocks`) so guest and free are told different, true things. And
the seed's `update: {}` on the demo user meant a re-seed never applied its pass, so the account
that exists to demonstrate Pro wasn't Pro; the pass is now re-asserted on update and the admin
account's is cleared, keeping both sides of the paywall reachable after a round of testing.

Deliberately not built: Razorpay, a pricing page, and anything purchasable. The landing page's
Pro card is untouched — still `planned: true`, still disabled, still saying it isn't available.

---

Items 1–9 were verified with `pnpm typecheck`, `pnpm lint`, `pnpm test` (257 tests) and
`pnpm build`. Item 10 the same, at 727 tests, plus a seeded SQLite database and a real browser:
the library renders 3 playable cards and 32 locked ones for a visitor with no cookie, the wall
banner renders, and a **forged Server Action** call to `startAttempt` carrying a locked
question id is refused with `303 → /library?wall=locked` — no `Attempt` and no `SimRun` exists
against locked content afterwards.

Item 11 the same, at 785 tests, and driven end to end in a real browser: sign up → `/welcome` →
answer → dashboard, `/welcome` refusing to replay once answered, the library pre-applying a
single target level and clearing for the session, the account menu, a real PNG uploaded and
served back as a 3.2 KB `image/jpeg` with an immutable cache header, a re-upload minting `?v=2`,
removal 404ing the old URL, a password change followed by signing back in with the new one, and
a guest bounced from both `/profile` and `/welcome` to `/signup`. The `/dashboard`, `/library`
and `/profile` payloads were checked to contain no base64 image data, which is the property the
URL indirection exists for.

Item 12 the same, at 803 tests, driven across all three tiers from a clean seed: a guest sees
3 of 35 with "32 more with a free account", a newly registered account sees the same 3 with
"32 more with Pro", the seeded demo account sees all 35, an admin grant unlocks a third account
live, a second grant reads 60 days rather than 30, and a pass backdated by an hour re-locks the
library, flips the profile to Free and gets a forged `startAttempt` refused with
`303 → /library?wall=locked` — with no scheduled job anywhere in the system.

### 13. A finance track: three simulations, one per financial statement

The nine shipped scenarios all taught product and marketing economics — ROAS, LTV:CAC,
channel margin, match rate. Nothing in the library taught a balance sheet, a profit and
loss statement or a cash flow statement, which is the vocabulary every other track
assumes.

Three new scenarios under `lib/sim/scenarios/`, filed under **Finance** at `Big4` level
and played as a financial analyst rather than a PM. They are a sequence, and sit
contiguously in `registry.ts` in that order:

- **`pnl-profit-squeeze`** (Easy) — Kirti Apparel, revenue up 22% and profit down 62%.
  The consolidated P&L is an average of 46 mature stores having a better year than last
  year and 14 opened in April carrying full cost at 38% of mature revenue. Teaches the
  statement top to bottom, and the habit of splitting it like-for-like before diagnosing
  anything. The trap is the advertising cut, authored to save ₹1.70 cr and give back
  ₹1.65 cr of gross profit — it improves the margin *percentage* and lowers the profit.
- **`cash-conversion-cycle`** (Easy) — Nirmal Pipes, a record ₹4.19 cr profit and ₹41 lakh
  in the bank. DSO 52 → 118 on infra milestone terms, DPO 62 → 34 for a 2% early-settlement
  discount that is borrowing at 26.6% a year. Teaches DSO/DIO/DPO, the cycle, and the
  single plank bridging EBITDA to cash. The correct answer *lowers reported profit* while
  nearly tripling the cash, and deliberately does not reach breakeven — it takes the hole
  from ₹27 cr to ₹10 cr, which is the difference between a facility a bank will write and
  one it will not.
- **`balance-sheet-leverage`** (Medium) — Deccan Ceramics, record EBITDA and a going-concern
  note in the same week. ROCE 14.8% → 8.1% on an EBIT margin that moved 0.8 points and a
  capital turnover that halved. Teaches liquidity, leverage, ROCE and the DuPont split. Its
  two best decoys — refinancing and a ₹40 cr rights issue — each fix the ratio they aim at
  and move ROCE by *zero*, which `tests/sim-scenario.test.ts` asserts to six decimal places.

Supporting changes, all additive:

- **A `statement` panel kind** (`lib/sim/types.ts`, `components/simulation/sim-dashboard.tsx`).
  No existing panel could render a statement: stat tiles lose the ordering that makes
  revenue → gross profit → EBITDA a derivation, and a segment chart of balance-sheet lines
  throws away the fact a balance sheet exists to assert. Sections, indented components,
  ruled subtotals, a comparative column and per-line notes. `assertNever` made the renderer
  arm a compile error until it was written. Two invariants added to `validateScenario`.
- **The debrief coach speaks as the scenario asks.** `SIM_COACH_RULES` became
  `simCoachRules(mentor)` with the product-leader wording as the default, so the nine
  existing scenarios produce a byte-identical prompt (`tests/sim-coach-prompt.test.ts`);
  the finance three declare a CFO. `lib/simulation-context.ts` also stopped hardcoding
  `"Product Management"` / `"PM"` and now reads them off the catalogue row.
- **Two subject-icon rules** for apparel and ceramics — the latter because "Deccan Ceramics:
  … the bank wants a word" was resolving to a bank icon on a question about a tile factory.

853 → 891 tests. The load-bearing one is unchanged: `checkBalance` brute-forces every
affordable combination of interventions per scenario and fails if anything beats the
authored `bestAllocation`, so a retune that makes a decoy win cannot ship quietly.

---

## The investment gate, and getting back into a war room

891 → 949 tests.

**You now spend against the cause you named.** `runOutcome` takes only the allocation and reads
`trueCauseIds` to decide whether a fix works — correct, and the reason the debrief can compare
your path, the do-nothing and the authored best on the same terms, but it let a run name the
wrong branch, fund the right fix, and score 100 on decision *and* outcome. Commit became two
steps: naming the cause locks it, and only then does the server ship the fixes that address it.
`lib/sim/gating.ts` is the single rule, called by both the redaction and the payload check.

The gate is in the redaction rather than the UI because the cause-to-fix mapping gives the answer
away on its own — the true cause usually has several fixes behind it where a decoy has one, so the
size of a slate is an oracle. Persisting the diagnosis before computing any list, and refusing to
rewrite it, is what stops that being read off. `commitDecision` no longer takes a diagnosis at all.

`SimCause.unactionable` marks a cause nothing can fix. There is no intervention that addresses a
monsoon, and writing a fake one to satisfy the gate is worse content than saying so; holding the
capacity becomes the answer and the quarter runs the do-nothing path. Four are annotated; eleven
leaves across seven scenarios still have nothing behind them and want authored interventions.

**"Somewhere in {area}" is gone**, and both schemas take leaves only. Naming an area was a hedge
worth 55% `ancestorCredit`, the commit picker rendered each area twice — once as its own heading
and again as a button beneath it — and the Observe picker had already decided areas were not
offerable. `scoreDiagnosisSim`'s ancestor branch stays, unreachable by design of the schema rather
than by accident, for the day a scenario authors a deeper tree.

**`checkBalance` prunes.** It walked all 2^n subsets and filtered afterwards, which capped a
scenario at twelve interventions — the binding constraint on giving every nameable cause something
to fund. Costs are non-negative, so a total past the budget prunes every superset with it: sixteen
interventions goes from 65,536 projections to a few thousand. The guard is now a cap on
combinations swept, and an unfinished sweep reports rather than passing quietly.

**Replaying and resuming are visible.** Both always worked — a committed run ends in
`phase: "debrief"` so `findResumableRun` returns null and a fresh run is minted — and neither was
mentioned anywhere. `completedSimQuestionIds` did almost exactly what a card needed and had zero
callers; `simStateFromRuns` replaces it, with an unfinished run outranking a finished one because
spent analyst-days are what a replay would strand. The unranked-replay bargain moved to *before*
the run starts.

**The primer's definitions follow the words.** `SimPrimerTerm.driver` joins each term to its
metric-map node and was read by nothing; `@radix-ui/react-tooltip` was a dependency and unused.
`lib/sim/glossary.ts` indexes by term, expansion and driver, matches exactly rather than on
substrings — a confident wrong definition is worse than none — and withholds formulas wherever the
metric map is withheld, since a formula names its inputs.

### 14. The war room: a wider board, one price per pull, and an answer in bullets

Seven changes to how a decision simulation is played and scored, applied to every
scenario rather than to new ones only — so nothing is authored against rules the
shipped content breaks.

**Money is typed, not dragged.** `MoneyDial` — a slider with a number box beside it —
is now `MoneyEntry`, a number box alone, and the buyback screen's order quantity
went the same way (`components/ui/slider.tsx` is deleted). The slider's argument was
that a saturating curve makes *where to stop* the interesting question and you cannot
see a knee in a text field. True, and outweighed: a track invites dragging until
something looks right, and every other commitment in a war room is a number the
candidate has to mean. The knee moved into words under the box, which is what the
tick and the track were carrying anyway.

**A wasted analyst-day costs something.** The par ratio was `par / spent` — flat, so
buying twice par cost about five points overall, on the dimension whose whole subject
is whether the search was worth conducting. It is now raised to `overspendExponent`,
which leaves a disciplined run untouched (`1^n` is 1) and bites only the overage, and
`overspendOverallPenalty` comes off the composite *after* weighting, because a
dimension weighted 1.2 of 6.0 can only ever express a fifth of an opinion about a run
that bought the whole board. The band reads the penalised number, and `buildFeedback`
names the points lost rather than deducting them quietly.

**Investigation credits both beliefs.** A pull now counts if it spoke to the true
cause, the hypothesis held **when it was bought**, *or* the one finally committed to.
Judging at purchase alone closed a hindsight cheat and, in closing it, punished the
candidate who bought the pull that changed their mind — which is the habit the phase
exists to teach. The cheat is held by the `foundEvidence` cap instead: retro-fitting a
hypothesis to your purchases still caps the score unless one of them bore on the real
cause.

**Eight to ten causes, parents included** (`CAUSE_BOARD`). Six is small enough to
clear by elimination — buy most of the pulls, rule out four, and the remainder is the
answer without a hypothesis ever being formed. Ten is the ceiling because past it a
student is scanning rather than weighing. `EASY_CAPS.causes` rises to 10 and stops
being a dial: Easy and Medium are now separated by pulls and interventions, which is
working memory, rather than by how much there is to read. `maxSuspects` stays at 3.

**One price per board.** Pulls cost 3, 2 and sometimes 1, so weighing two of them
meant weighing what each would rule out *and* what each cost — and only the first is
the exercise. Everything costs 2, which makes a budget a count of questions and makes
the overspend penalty legible as pulls over par. Three Medium budgets drop 7 → 6,
which under flat pricing buys exactly the three pulls they always bought; Suraksha and
Ujala gained a seventh pull so six days still cannot cover half the board.

**A board worth reading** (`DASHBOARD_FLOOR`). Minimum reported metrics and dashboard
panels, met by adding decoys everywhere: true, correctly derived, and off the causal
path. Deliberately not harder — no decoy introduces a concept — but denser, so
deciding what to ignore is part of the work. On Kirti and Deccan they do double duty,
because a healthy operating board sitting next to a broken return on capital *is* the
lesson.

**The answer comes back in bullets.** `SimDebriefCopy.strongAnswer` and
`SimCoachFact.answer` are `string[]`, one idea per bullet, in the everyday word where
there is one — "money left after costs" ahead of "contribution" — with a gloss the
first time a term has to be used. The debrief is read by someone who has just been
told they were wrong, which is the worst moment to hand over a paragraph of six
load-bearing clauses; and the structure is half the lesson, since an interview answer
has moves and a list makes them countable. `simCoachRules` used to instruct the model
"no bullet lists" and now asks for the opposite. `asBulletText` flattens the array for
the two surfaces that still need a string, so the offline mock reads as a list too.

Projections did not move: `pnpm tsx scripts/sim-golden.ts` reports no scenario changed,
and `checkBalance` still certifies every declared best allocation. The test fixture now
satisfies the same authoring rules as shipped content, so the suite cannot certify a
shape the app would refuse to load.

### 15. Three new war rooms, authored to the rules entry 14 laid down

The point of doing entry 14 first was so that new scenarios would be written against
the final rules rather than retrofitted a second time. These three are the payoff, and
each was built to `CAUSE_BOARD` (8–10 causes), uniform 2-day pulls, `DASHBOARD_FLOOR`
(6+ panels including decoys) and bulleted debriefs from the first line. All three are
`engine: "v2"` with a `spend` block, so money reaches the P&L and "how much?" has an
answer that is not "all of it". They are the three the README's "Deferred / future"
note named, and that note no longer names them.

**Vyapar Mitra** (Easy) — a billing app for kirana shops whose ₹1.4 crore install
campaign raised installs 38% and paying customers by almost nothing. Onboarding demands
a GST number and a photographed registration certificate before the first invoice can
be raised, so only 36% of installs submit anything — and a four-person verification team
approves 4,200 a month, which it has done for a year. Activation is therefore
`min(submissions, capacity)`, and this scenario needed the `min` driver kind: a funnel
of pure rates multiplies, so it cannot express "we bought 38% more and got none of it".
Finding a ceiling is a different skill from finding a leak, and nothing else in the
catalogue teaches it.

**Sehat Plus** (Medium) — a 240-store pharmacy chain promising 96% availability,
delivering 87.4%, and holding 24% more stock than it ever has. One national 14-day
safety-stock rule meets two kinds of demand: chronic refills at a coefficient of
variation of 0.14 sit at 98.2% on six standard deviations of cover, and acute lines at
0.71 sit at 71.2% on about one. Every aggregate a head office reads is healthy —
including 9.5 inventory turns — because the failure is entirely in a distribution.

**Setu** (Medium) — B2B logistics software that shipped its most-requested features for
three quarters at 91% on-time delivery and watched NRR fall from 103% to 94%. Request
count runs inversely to account size (2.4 requests per crore of ARR from the twelve
accounts that are 46% of it, against 985 from the long tail), because those twelve have
a named CSM instead of a support queue and the roadmap process was built on the ticket
system. Churn is modelled as a floor plus a roadmap-sensitive part, which is what makes
the misallocation expensive rather than merely unfair: the tail is within half a point
of a floor no feature moves, and the enterprise tier is at eight times its own.

**Every trap keeps its full effect.** The engine's off-target default saturates early
and low, on the reasoning that money aimed at the wrong cause stops working almost at
once — and that reasoning is wrong for a lever that is arithmetic rather than a bet on a
hypothesis. A price cut lifts conversion whatever else is broken; more safety stock is
more safety stock; a voting portal really does collect votes. So each of those carries a
`saturation` override and fails for an honest reason instead of quietly doing nothing.
Vyapar Mitra's price cut goes further and uses `linear`, because a price is a switch
rather than a dial: ₹299 becomes ₹199 or it does not, and a saturating curve would have
rendered the cut as −26% of ARPU at full funding, which is not a price anybody set.

Three of the traps are worth naming for what they do to the north star. Cutting Vyapar
Mitra's price wins customers (10,366 → 11,997) and loses revenue (₹31.0 L → ₹23.9 L).
Raising Sehat Plus's cover to 21 days lifts the blended fill rate everybody is measured
on and leaves contribution slightly *below* doing nothing once the stock is carried.
Setu's voting portal works exactly as designed and makes retention worse, because it
collects more of a biased signal and counts it the same way.

Every `bestAllocation` came from `pnpm tsx scripts/best-allocation.ts <slug>` and was
re-run to confirm nothing moved; all five v2 scenarios report `balance: OK`. The golden
fixture gained the three new slugs and **no existing projection changed**. The Pro pitch
and the plan card, which are prose and quote a count, moved 14 → 17.

### 16. An analytics track, and a category to put it in

Fifteen of the sixteen war rooms taught business or finance economics. Exactly one —
Rangoli — was statistical, and a candidate preparing for a data or analytics interview
had that one scenario and nothing after it. A grep across `lib/sim/scenarios/` for
`conjoint|PCA|regression|cluster|chi-square|t-test|anova` returned no content hits.

This is the first two rungs of a ladder that goes on to classification thresholds,
conjoint, PCA and causal inference. Both are `engine: "v2"` with a `spend` block, both
were authored to the entry 14 rules from the first line, and both are Easy — the point
of a track is that somebody can start at the bottom of it.

**The framing problem, and how it was solved.** A war room is "diagnose a metric that
moved, then spend one quarter's capacity on it". A statistical technique is not a metric
that moved, and forcing one into the format produces a quiz with a dashboard attached.
So each scenario is written as the **post-mortem of a decision the analysis already
drove** — the book was reallocated, the redesign shipped — and the war room is the
diagnosis plus the fix. That is what makes the format carry a technique at all, and it
is the constraint the remaining four scenarios in the ladder have to satisfy too.

**Sahyog Finance** (Easy) — an NBFC whose four collections agencies are ranked on
recovery rate. One agency tops the table at 41.4% against 33–35%, so 60% of the overdue
book moved to it and blended recovery fell 35.6% → 33.8%. Recovery is decided by ageing
bucket (60.9% at 0–30 days, 11.1% at 90+, a 49.8-point spread), and 42% of that agency's
book sat in the 0–30 bucket against 24–27% for the others. Rebuild each agency's blended
rate from the pooled bucket rates and its own mix and the league table reproduces exactly
with every agency performing identically. Held inside one bucket the four land within
1.6 points and do not rank consistently, while one agency's own month-to-month swing in
that bucket is 2.8 points — between-group spread smaller than within-group, which is the
comparison an ANOVA computes, taught without printing an F-statistic. `recoveryRate` is a
`product` of contact and settlement rather than one input, so the two fixes on the board
are visibly different levers instead of two ways to nudge the same number.

**Chalo Fitness** (Easy) — a class-booking subscription that shipped a home-screen
redesign on "+11.3% booking rate, p = 0.032" in one segment. The experiment is clean:
one change, randomised, correctly instrumented — everything Rangoli got wrong, this team
got right. The reading is not. Fourteen comparisons were run and the winner reported;
1 − 0.95¹⁴ = 51.2%, and a Bonferroni bar would be 0.0036. The test was stopped on day 9
against a written 21-day plan, the afternoon it first crossed, and was back above 0.05 by
day 12. A pre-registered replication returned +0.4%, CI −3.1% to +3.9%.

The half candidates miss is the mirror image. The primary metric came back −1.8% at
p = 0.19 and was filed as "no effect" when the design could only detect 3%; at 45 days it
clears. Type I error on fourteen questions nobody planned to ask, type II on the one they
did, same three weeks of data. Deliberately not a second Rangoli: `variant.novelty` and
`reading.power` both come back clean on the headline, so a candidate who pattern-matches
to "confounded" or "underpowered" is answering the previous scenario's question.

Both traps do what their readout argues for and end below doing nothing. Consolidating
Sahyog's book is −₹10.8 lakh, because the eight points were a book rather than a skill
and the volume outruns the officers. Building more of Chalo's streak widget is −₹11.9
lakh, and it is the sharper of the two: `sessionsPerSubscriber` sits on the **cost** side
of contribution — Chalo pays the studio ₹96 a class — so optimising the metric the
readout reported is arithmetically a loss. Each scenario also carries an honest decoy
that clears doing nothing (+₹2.9 lakh, +₹1.8 lakh) and loses comfortably, with a
`saturation` override for the reason entry 15 gives: more field officers and more evening
classes work whatever is wrong upstream.

**A `data-analytics` category**, mirroring the finance track's own. Rangoli moved into it,
so the track ships three deep rather than two. No application code was needed:
`listCategories(surface)` asks the database which categories hold something a surface can
render, so a simulation-only category appears on `/simulations` and is dropped from
`/library` on its own — the seam entry 13 built, used a second time without touching it.
The one edit that is easy to miss is `components/library/question-icon.tsx`, whose `ICONS`
allowlist gates `Category.icon`: an unknown name **silently** degrades to the default
rather than erroring, so a new category needs `Sigma` added there or it renders wrong and
nothing says so.

Two comments claiming "every war room is filed under `product-management`" are no longer
true and were corrected rather than left to mislead — one in `lib/questions.ts`, one in
`tests/sectors.test.ts`, whose guard still passes because eleven war rooms remain there.

Every `bestAllocation` came from `pnpm tsx scripts/best-allocation.ts <slug>` and was
re-run to confirm nothing moved; both report `balance: OK`. The golden fixture gained the
two new slugs and **no existing projection changed**. The Pro pitch and the plan card
moved 17 → 19; the seeded counts moved to 16 categories and 45 questions. The pitch deck
had said "25 guesstimates" against a real 24 for some time, and that is corrected here
too.
