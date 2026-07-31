import { ArrowRight } from "lucide-react";
import { startAttempt } from "@/app/actions/attempts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { INTERVIEW_LEVEL_LABELS, answerModeFor, type InterviewLevel } from "@/lib/types";

interface QuestionCardData {
  id: string;
  title: string;
  prompt: string;
  difficulty: string;
  interviewLevel: string;
  type: string;
  category: { name: string };
}

const diffVariant: Record<string, "success" | "warning" | "destructive"> = {
  Easy: "success",
  Medium: "warning",
  Hard: "destructive",
};

export function QuestionCard({ question }: { question: QuestionCardData }) {
  const qualitative = answerModeFor(question.type) === "qualitative";
  // Both arguments bound, so each form action takes no parameters — a bound
  // action with a trailing optional arg would be typed as taking the FormData.
  const startSolo = startAttempt.bind(null, question.id, "solo");
  const startGuided = startAttempt.bind(null, question.id, "guided");
  const start = startAttempt.bind(null, question.id, undefined);

  return (
    <Card className="flex flex-col p-5 transition-shadow hover:shadow-md">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{question.category.name}</Badge>
        <Badge variant={diffVariant[question.difficulty] ?? "muted"}>{question.difficulty}</Badge>
        <Badge variant="outline">
          {INTERVIEW_LEVEL_LABELS[question.interviewLevel as InterviewLevel] ?? question.interviewLevel}
        </Badge>
        {qualitative && <Badge variant="outline">Issue tree</Badge>}
      </div>
      <h3 className="font-semibold leading-snug">{question.title}</h3>
      <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-muted-foreground">{question.prompt}</p>

      {qualitative ? (
        // Chosen here and fixed for the attempt. Offering it mid-attempt would
        // make "solo" meaningless — switch to guided, take the structure, switch
        // back — so the choice is made before the timer starts.
        <div className="mt-4 space-y-2">
          <form action={startSolo}>
            <Button type="submit" className="w-full" variant="outline">
              Practise this <ArrowRight />
            </Button>
          </form>
          <form action={startGuided} className="text-center">
            <button
              type="submit"
              className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
              title="Branches are suggested as you name each parent. You're scored on the diagnosis, not on the structure."
            >
              or try it guided — structure suggested, and not scored
            </button>
          </form>
        </div>
      ) : (
        <form action={start} className="mt-4">
          <Button type="submit" className="w-full" variant="outline">
            Practise this <ArrowRight />
          </Button>
        </form>
      )}
    </Card>
  );
}
