import Link from "next/link";
import { Presentation, Siren } from "lucide-react";
import { requireHost } from "@/lib/auth";
import { requirePasswordChange } from "@/lib/password-gate";
import { listRoomsForHost } from "@/lib/rooms";
import { AppHeader } from "@/components/app/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * The professor's rooms.
 *
 * Deliberately has no "new room" form of its own. A room is opened from the war
 * room it will run — the catalogue is where the choice is actually made — so
 * this page's empty state points at `/simulations` rather than growing a second
 * copy of that grid behind a different heading.
 */
export default async function HostPage() {
  const host = await requireHost();
  requirePasswordChange(host);
  const rooms = await listRoomsForHost(host.id);

  return (
    <div className="min-h-screen">
      <AppHeader user={host} />
      <main className="container py-8">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Presentation className="h-6 w-6 text-primary" /> Classroom rooms
          </h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            Open a room on any war room you can play, read out the code and the password, and
            watch the roster fill in. Students join without an account and play their own run at
            their own pace.
          </p>
        </div>

        {rooms.length === 0 ? (
          <Card className="p-12 text-center">
            <Siren className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-4 font-medium">No rooms yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Pick the war room you want to run, then choose{" "}
              <span className="font-medium">host this in class</span> on its card.
            </p>
            <Button asChild className="mt-6">
              <Link href="/simulations">Browse war rooms</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <Card key={room.id} className="flex flex-col p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant={room.status === "open" ? "success" : "muted"}>
                    {room.status === "open" ? "Open" : "Closed"}
                  </Badge>
                  <Badge variant="secondary">{room.question.difficulty}</Badge>
                </div>
                <h2 className="font-semibold leading-snug">{room.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {room.question.title}
                </p>
                <p className="mt-3 font-mono text-lg tracking-[0.2em]">{room.code}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {room._count.members} joined · {room._count.runs} run
                  {room._count.runs === 1 ? "" : "s"}
                </p>
                <Button asChild className="mt-4 w-full" variant="secondary">
                  <Link href={`/host/${room.code}`}>Open the console</Link>
                </Button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
