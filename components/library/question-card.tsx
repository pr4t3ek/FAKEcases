import { ArrowRight } from "lucide-react";
import { startAttempt } from "@/app/actions/attempts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { INTERVIEW_LEVEL_LABELS, type InterviewLevel } from "@/lib/types";

interface QuestionCardData {
  id: string;
  title: string;
  prompt: string;
  difficulty: string;
  interviewLevel: string;
  category: { name: string };
}

const diffVariant: Record<string, "success" | "warning" | "destructive"> = {
  Easy: "success",
  Medium: "warning",
  Hard: "destructive",
};

export function QuestionCard({ question }: { question: QuestionCardData }) {
  const start = startAttempt.bind(null, question.id);
  return (
    <Card className="flex flex-col p-5 transition-shadow hover:shadow-md">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{question.category.name}</Badge>
        <Badge variant={diffVariant[question.difficulty] ?? "muted"}>{question.difficulty}</Badge>
        <Badge variant="outline">
          {INTERVIEW_LEVEL_LABELS[question.interviewLevel as InterviewLevel] ?? question.interviewLevel}
        </Badge>
      </div>
      <h3 className="font-semibold leading-snug">{question.title}</h3>
      <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-muted-foreground">{question.prompt}</p>
      <form action={start} className="mt-4">
        <Button type="submit" className="w-full" variant="outline">
          Practise this <ArrowRight />
        </Button>
      </form>
    </Card>
  );
}
