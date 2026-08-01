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

---

All items verified with `pnpm typecheck`, `pnpm lint`, `pnpm test` (257 tests), and
`pnpm build`.
