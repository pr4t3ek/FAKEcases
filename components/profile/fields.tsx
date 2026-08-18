"use client";

import { COLLEGE_OTHER, collegesByKind } from "@/lib/config/colleges";
import { BATCHES, batchOptionLabel } from "@/lib/config/batches";
import {
  EXPERIENCE_BANDS,
  EXPERIENCE_LABELS,
  PROFESSIONS,
  PROFESSION_LABELS,
  gradYearRange,
  profileLimits,
} from "@/lib/config";
import { INTERVIEW_LEVELS, INTERVIEW_LEVEL_LABELS, type InterviewLevel } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The inputs shared by the profile page and the post-signup step.
 *
 * They live together because both surfaces write the same columns through the
 * same schema, and a college select that behaves one way at `/welcome` and
 * another at `/profile` is the drift `lib/profile-schema.ts` exists to prevent.
 *
 * Native `<select>` throughout, matching `filter-bar.tsx` and
 * `question-manager.tsx`. `@radix-ui/react-select` is in package.json and
 * unused, and that isn't a mandate: these are short lists, and a native control
 * is the better one on a phone.
 */

export const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ProfessionSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label="What are you doing right now?" htmlFor="profession">
      <select
        id="profession"
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Prefer not to say</option>
        {PROFESSIONS.map((p) => (
          <option key={p} value={p}>
            {PROFESSION_LABELS[p]}
          </option>
        ))}
      </select>
    </Field>
  );
}

/**
 * Which PGP batch — the one field on either surface that has no "prefer not to
 * say".
 *
 * The empty option is a placeholder rather than an answer: it carries no value,
 * so submitting on it fails `profileCoreSchema` with "Choose your batch" instead
 * of quietly storing nothing. Every other select here offers an opt-out because
 * every other field is genuinely optional; this one appears on every board row,
 * and a blank there is a row that cannot be read.
 */
export function BatchSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field
      label="Your batch"
      htmlFor="batch"
      hint="Shown next to your college on the leaderboard."
    >
      <select
        id="batch"
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      >
        <option value="">Select your batch</option>
        {BATCHES.map((b) => (
          <option key={b.id} value={b.id}>
            {batchOptionLabel(b)}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CollegeSelect({
  collegeId,
  collegeOther,
  onCollegeId,
  onCollegeOther,
}: {
  collegeId: string;
  collegeOther: string;
  onCollegeId: (v: string) => void;
  onCollegeOther: (v: string) => void;
}) {
  const groups = collegesByKind();
  return (
    <div className="space-y-2">
      <Field
        label="College or university"
        htmlFor="collegeId"
        hint={
          collegeId === COLLEGE_OTHER
            ? "Written-in colleges aren't grouped with anyone else's — pick from the list when yours appears."
            : undefined
        }
      >
        <select
          id="collegeId"
          className={selectClass}
          value={collegeId}
          onChange={(e) => onCollegeId(e.target.value)}
        >
          <option value="">Prefer not to say</option>
          {groups.map((g) => (
            <optgroup key={g.kind} label={g.label}>
              {g.colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
          <option value={COLLEGE_OTHER}>Other — not on this list</option>
        </select>
      </Field>

      {collegeId === COLLEGE_OTHER && (
        <Input
          aria-label="Your college"
          placeholder="Type your college's name"
          maxLength={profileLimits.collegeOther}
          value={collegeOther}
          onChange={(e) => onCollegeOther(e.target.value)}
        />
      )}
    </div>
  );
}

export function GradYearSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { min, max } = gradYearRange;
  // Newest first: far more people are graduating soon than graduated in 1978.
  const years = Array.from({ length: max - min + 1 }, (_, i) => max - i);
  return (
    <Field label="Graduation year" htmlFor="gradYear">
      <select
        id="gradYear"
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Prefer not to say</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function ExperienceSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label="Work experience" htmlFor="experience">
      <select
        id="experience"
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Prefer not to say</option>
        {EXPERIENCE_BANDS.map((b) => (
          <option key={b} value={b}>
            {EXPERIENCE_LABELS[b]}
          </option>
        ))}
      </select>
    </Field>
  );
}

/**
 * Target roles, as toggle chips.
 *
 * There is no checkbox primitive in `components/ui`, and this reads better than
 * one anyway — the levels are the same vocabulary the library filters on, so
 * they should look like the filters they become.
 */
export function TargetLevels({
  value,
  onChange,
}: {
  value: InterviewLevel[];
  onChange: (v: InterviewLevel[]) => void;
}) {
  function toggle(level: InterviewLevel) {
    if (value.includes(level)) {
      onChange(value.filter((l) => l !== level));
      return;
    }
    if (value.length >= profileLimits.targetLevels) return;
    onChange([...value, level]);
  }

  const full = value.length >= profileLimits.targetLevels;

  return (
    <Field
      label="What are you preparing for?"
      hint={`Pick up to ${profileLimits.targetLevels}. This changes what the library shows you first and what the dashboard recommends.`}
    >
      <div className="flex flex-wrap gap-2">
        {INTERVIEW_LEVELS.map((level) => {
          const on = value.includes(level);
          return (
            <button
              key={level}
              type="button"
              onClick={() => toggle(level)}
              aria-pressed={on}
              disabled={!on && full}
              className={
                on
                  ? "rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                  : "rounded-full border border-input px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              }
            >
              {INTERVIEW_LEVEL_LABELS[level]}
            </button>
          );
        })}
      </div>
    </Field>
  );
}
