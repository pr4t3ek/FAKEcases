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
