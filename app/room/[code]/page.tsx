import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Siren } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { canOpen, tierFor } from "@/lib/entitlements";
import { normaliseRoomCode } from "@/lib/rooms/code";
import { roomIsOpen } from "@/lib/rooms/access";
import { roomGrantFor, seatFor } from "@/lib/rooms";
import { findResumableRun } from "@/lib/simulations";
import { AppHeader } from "@/components/app/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EnterRoomButton } from "@/components/rooms/enter-room-button";

export const dynamic = "force-dynamic";

/**
 * The student's room: a brief, and one way in.
 *
 * Does NOT poll. One poller per console is the budget for this feature, and a
 * student has nothing to watch — their own run is the page they are about to
 * open.
 */
export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalised = normaliseRoomCode(code);

  const user = await getSessionUser();
  if (!user) redirect(`/join/${normalised}`);

  const seated = await seatFor(user.id, normalised);
  if (!seated) redirect(`/join/${normalised}`);
  const { room } = seated;

  const open = roomIsOpen(room);

  // The same two reads `startRoomRun` makes, in the same order and with the same
  // derivation — which is the whole reason `roomGrantFor` is one exported
  // function. A button rendered from a grant the action re-derives differently
  // is precisely the drift `lib/entitlements.ts` exists to prevent.
  const [resumable, grant] = await Promise.all([
    findResumableRun(user.id, room.questionId, room.id),
    roomGrantFor(user.id),
  ]);
  const allowed = canOpen(tierFor(user), room.question, grant);

  return (
    <div className="min-h-screen">
      <AppHeader user={user} />
      <main className="container max-w-3xl py-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {room.name} · <span className="font-mono">{room.code}</span>
          </p>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
            <Siren className="h-6 w-6 text-primary" /> {room.question.title}
            {!open && <Badge variant="muted">Room closed</Badge>}
          </h1>
        </div>

        <Card className="p-6">
          <p className="text-muted-foreground">{room.question.prompt}</p>

          <div className="mt-6 space-y-3">
            {resumable ? (
              // A link, not the action — one fewer round-trip, and the same
              // reasoning `QuestionCard` gives for its resume branch. It works
              // whether or not the room is still open, which is the point:
              // closing a room never strands analyst-days already spent.
              <Button asChild className="w-full">
                <Link href={`/simulate/${resumable}`}>
                  Resume your war room <ArrowRight />
                </Link>
              </Button>
            ) : allowed ? (
              <EnterRoomButton code={room.code} />
            ) : (
              <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                This room has closed, so there&apos;s nothing new to start here. If you played it
                while it was open, your debrief is still on your dashboard.
              </p>
            )}
          </div>

          {/* Said before the run starts rather than after, in the spirit of
              telling someone what a thing costs before they spend it. */}
          <p className="mt-4 text-xs text-muted-foreground">
            You&apos;ll play your own run at your own pace — your professor sees your progress
            and your final score, not your screen. Your first finished run of a scenario is the
            one that counts on the leaderboard.
          </p>

          {user.isGuest && (
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
              You&apos;re playing as a guest on this device.{" "}
              <Link
                href="/signup"
                className="font-medium text-primary underline underline-offset-4"
              >
                Create a free account
              </Link>{" "}
              to keep this run, your score and your streak — it takes a moment and you won&apos;t
              lose your place. Switching to another device means joining again.
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
