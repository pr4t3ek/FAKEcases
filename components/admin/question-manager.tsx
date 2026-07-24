"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createQuestion, updateQuestion, deleteQuestion } from "@/app/actions/admin";
import { DIFFICULTIES, INTERVIEW_LEVELS, INTERVIEW_LEVEL_LABELS } from "@/lib/types";
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
  idealLow: number | null;
  idealHigh: number | null;
  unit: string | null;
  betterApproach: string;
  sampleSolution: string;
  tags: string | null;
  source: string;
  category: { name: string };
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
  idealLow: "",
  idealHigh: "",
  unit: "",
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
          idealLow: String(initial.idealLow ?? ""),
          idealHigh: String(initial.idealHigh ?? ""),
          unit: initial.unit ?? "",
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

  async function save() {
    setSaving(true);
    try {
      const payload = { ...form };
      if (questionId) await updateQuestion(questionId, payload);
      else await createQuestion(payload);
      toast.success(questionId ? "Question updated" : "Question created");
      onDone();
    } catch {
      toast.error("Save failed — check required fields (India-only content).");
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
      <div className="grid grid-cols-3 gap-2">
        <Input type="number" placeholder="Ideal low" value={form.idealLow} onChange={(e) => set("idealLow", e.target.value)} />
        <Input type="number" placeholder="Ideal high" value={form.idealHigh} onChange={(e) => set("idealHigh", e.target.value)} />
        <Input placeholder="Unit" value={form.unit} onChange={(e) => set("unit", e.target.value)} />
      </div>
      <Textarea placeholder="Better approach" value={form.betterApproach} onChange={(e) => set("betterApproach", e.target.value)} />
      <Textarea placeholder="Sample solution (hidden until submit)" value={form.sampleSolution} onChange={(e) => set("sampleSolution", e.target.value)} />
      <Input placeholder="Tags (comma-separated)" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
      <Button className="w-full" onClick={save} disabled={saving}>
        {questionId ? "Save changes" : "Create question"}
      </Button>
    </div>
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
        <p className="text-sm text-muted-foreground">{questions.length} questions</p>
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
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
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
