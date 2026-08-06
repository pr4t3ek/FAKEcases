"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createQuestion,
  updateQuestion,
  deleteQuestion,
  setQuestionFreeTier,
} from "@/app/actions/admin";
import {
  AUTHORABLE_TYPES,
  DIFFICULTIES,
  INTERVIEW_LEVELS,
  INTERVIEW_LEVEL_LABELS,
  answerModeFor,
  isSimulation,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface AdminQuestion {
  id: string;
  title: string;
  prompt: string;
  categoryId: string;
  difficulty: string;
  interviewLevel: string;
  type: string;
  idealLow: number | null;
  idealHigh: number | null;
  unit: string | null;
  /** Case-only columns; JSON is stored as text (see prisma/schema.prisma). */
  framework: string | null;
  expectedBuckets: string | null;
  dataPack: string | null;
  rootCause: string | null;
  betterApproach: string;
  sampleSolution: string;
  tags: string | null;
  /** Open to guests. Toggled from the list, not from the form — see below. */
  freeTier: boolean;
  source: string;
  category: { name: string };
}

/** Only the types this form can write — see AUTHORABLE_TYPES. */
const QUESTION_TYPE_LABELS: Record<string, string> = {
  guesstimate: "Guesstimate (ends in a number)",
  qualitative: "Case (ends in a recommendation)",
};

/** `["Revenue","Cost"]` on the way in, `Revenue|Cost` in the field. */
function bucketsToField(raw: string | null): string {
  if (!raw?.trim()) return "";
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.join(" | ") : raw;
  } catch {
    return raw;
  }
}

interface Category {
  id: string;
  name: string;
}

const empty = {
  title: "",
  prompt: "",
  categoryId: "",
  difficulty: "Medium",
  interviewLevel: "McKinsey",
  type: "guesstimate",
  idealLow: "",
  idealHigh: "",
  unit: "",
  framework: "",
  expectedBuckets: "",
  rootCause: "",
  dataPack: "",
  betterApproach: "",
  sampleSolution: "",
  tags: "",
};

function QuestionForm({
  categories,
  initial,
  questionId,
  onDone,
}: {
  categories: Category[];
  initial?: AdminQuestion;
  questionId?: string;
  onDone: () => void;
}) {
  const [form, setForm] = useState(
    initial
      ? {
          title: initial.title,
          prompt: initial.prompt,
          categoryId: initial.categoryId,
          difficulty: initial.difficulty,
          interviewLevel: initial.interviewLevel,
          type: initial.type || "guesstimate",
          idealLow: String(initial.idealLow ?? ""),
          idealHigh: String(initial.idealHigh ?? ""),
          unit: initial.unit ?? "",
          framework: initial.framework ?? "",
          expectedBuckets: bucketsToField(initial.expectedBuckets),
          rootCause: initial.rootCause ?? "",
          dataPack: initial.dataPack ?? "",
          betterApproach: initial.betterApproach,
          sampleSolution: initial.sampleSolution,
          tags: initial.tags ?? "",
        }
      : { ...empty, categoryId: categories[0]?.id ?? "" },
  );
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const isNumeric = answerModeFor(form.type) === "numeric";

  async function save() {
    setSaving(true);
    try {
      // Send only the side that applies. Switching type leaves the other side's
      // values in local state, and posting them would trip the cross-field rule
      // that stops a case carrying a fabricated ideal range.
      const payload = isNumeric
        ? { ...form, framework: "", expectedBuckets: "", rootCause: "", dataPack: "" }
        : { ...form, idealLow: "", idealHigh: "", unit: "" };
      const result = questionId
        ? await updateQuestion(questionId, payload)
        : await createQuestion(payload);

      // The schema names the field and the reason ("rootCause: must be valid
      // JSON"), which beats a generic failure the author has to guess at.
      if (!result.ok) {
        toast.error(result.error ?? "Save failed — check the required fields.");
        return;
      }
      toast.success(questionId ? "Question updated" : "Question created");
      onDone();
    } catch {
      toast.error("Save failed — you may have been signed out.");
    } finally {
      setSaving(false);
    }
  }

  const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
      <Input placeholder="Title" value={form.title} onChange={(e) => set("title", e.target.value)} />
      <Textarea placeholder="Prompt (India-only)" value={form.prompt} onChange={(e) => set("prompt", e.target.value)} />
      <div className="grid grid-cols-3 gap-2">
        <select className={selectClass} value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className={selectClass} value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className={selectClass} value={form.interviewLevel} onChange={(e) => set("interviewLevel", e.target.value)}>
          {INTERVIEW_LEVELS.map((l) => <option key={l} value={l}>{INTERVIEW_LEVEL_LABELS[l]}</option>)}
        </select>
      </div>
      <select className={selectClass} value={form.type} onChange={(e) => set("type", e.target.value)}>
        {AUTHORABLE_TYPES.map((t) => (
          <option key={t} value={t}>{QUESTION_TYPE_LABELS[t] ?? t}</option>
        ))}
      </select>

      {/* The two types are graded by different scorers and need different
          authoring. Showing both sets at once invites a case with an ideal
          range, which is the shape the server now refuses. */}
      {isNumeric ? (
        <div className="grid grid-cols-3 gap-2">
          <Input type="number" placeholder="Ideal low" value={form.idealLow} onChange={(e) => set("idealLow", e.target.value)} />
          <Input type="number" placeholder="Ideal high" value={form.idealHigh} onChange={(e) => set("idealHigh", e.target.value)} />
          <Input placeholder="Unit" value={form.unit} onChange={(e) => set("unit", e.target.value)} />
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-dashed p-3">
          <p className="text-xs text-muted-foreground">
            Case fields. Without a <code>rootCause</code> the case still works, but there is
            nothing to score Diagnosis against.
          </p>
          <Input
            placeholder="Framework slug (profitability, market-entry, …)"
            value={form.framework}
            onChange={(e) => set("framework", e.target.value)}
          />
          <Input
            placeholder="Expected buckets — Revenue | Cost | Competition"
            value={form.expectedBuckets}
            onChange={(e) => set("expectedBuckets", e.target.value)}
          />
          <Textarea
            placeholder={'Root cause JSON — {"path":["Cost","Delivery cost"],"note":"…"}'}
            value={form.rootCause}
            onChange={(e) => set("rootCause", e.target.value)}
          />
          <Textarea
            placeholder={'Data pack JSON — [{"topic":["cost"],"fact":"…"}]'}
            value={form.dataPack}
            onChange={(e) => set("dataPack", e.target.value)}
          />
        </div>
      )}
      <Textarea placeholder="Better approach" value={form.betterApproach} onChange={(e) => set("betterApproach", e.target.value)} />
      <Textarea placeholder="Sample solution (hidden until submit)" value={form.sampleSolution} onChange={(e) => set("sampleSolution", e.target.value)} />
      <Input placeholder="Tags (comma-separated)" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
      <Button className="w-full" onClick={save} disabled={saving}>
        {questionId ? "Save changes" : "Create question"}
      </Button>
    </div>
  );
}

/**
 * The guest-tier toggle.
 *
 * Deliberately in the list rather than in the form. It is a merchandising
 * decision, not authoring — it is not part of the question contract, it must
 * survive a CSV re-import, and it has to work on a simulation, whose row the
 * form refuses to edit at all.
 */
function FreeTierToggle({ question }: { question: AdminQuestion }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const free = question.freeTier;

  return (
    <Button
      size="icon"
      variant="ghost"
      disabled={pending}
      title={
        free
          ? "Open to guests — click to lock behind sign-up"
          : "Locked behind sign-up — click to open to guests"
      }
      onClick={() =>
        startTransition(async () => {
          const result = await setQuestionFreeTier(question.id, !free);
          if (!result.ok) {
            toast.error(result.error ?? "Could not change guest access");
            return;
          }
          toast.success(free ? "Locked behind sign-up" : "Open to guests");
          router.refresh();
        })
      }
    >
      {free ? <LockOpen className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4" />}
    </Button>
  );
}

export function QuestionManager({
  questions,
  categories,
}: {
  questions: AdminQuestion[];
  categories: Category[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminQuestion | null>(null);
  const freeCount = questions.filter((q) => q.freeTier).length;

  function refresh() {
    setOpen(false);
    setEditing(null);
    router.refresh();
  }

  async function remove(id: string) {
    try {
      await deleteQuestion(id);
      toast.success("Deleted");
      router.refresh();
    } catch {
      toast.error("Delete failed");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {questions.length} questions · {freeCount} open to guests
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" /> New question</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New question</DialogTitle></DialogHeader>
            <QuestionForm categories={categories} onDone={refresh} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="divide-y">
        {questions.map((q) => (
          <div key={q.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{q.title}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">{q.category.name}</Badge>
                <Badge variant="outline">{q.difficulty}</Badge>
                <Badge variant="muted">{q.source}</Badge>
                {isSimulation(q.type) && <Badge variant="outline">Simulation</Badge>}
                {q.freeTier && <Badge variant="success">Free for guests</Badge>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <FreeTierToggle question={q} />
              {/* A simulation is a catalogue row whose exercise lives in code, so
                  this form has nothing to edit. Opening it used to show a blank
                  type dropdown and saving quietly rewrote the row as a
                  guesstimate — orphaning the scenario and leaving a question
                  nobody could answer. Read-only is the honest state. */}
              {isSimulation(q.type) ? (
                <Button
                  size="icon"
                  variant="ghost"
                  disabled
                  title="Simulation content is authored in lib/sim/scenarios, not here"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              ) : (
                <Dialog
                  open={editing?.id === q.id}
                  onOpenChange={(o) => setEditing(o ? q : null)}
                >
                  <DialogTrigger asChild>
                    <Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Edit question</DialogTitle></DialogHeader>
                    <QuestionForm categories={categories} initial={q} questionId={q.id} onDone={refresh} />
                  </DialogContent>
                </Dialog>
              )}
              <Button size="icon" variant="ghost" onClick={() => remove(q.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
