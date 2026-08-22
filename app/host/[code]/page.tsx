import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Siren } from "lucide-react";
import { requireHost } from "@/lib/auth";
import { requirePasswordChange } from "@/lib/password-gate";
import { loadRoom, loadRoster } from "@/lib/rooms";
import { roomIsOpen } from "@/lib/rooms/access";
import { getScenario } from "@/lib/sim/registry";
import { AppHeader } from "@/components/app/app-header";
import { Badge } from "@/components/ui/badge";
import { RoomCode } from "@/components/rooms/room-code";
import { RoomControls } from "@/components/rooms/room-controls";
import { RosterBoard } from "@/components/rooms/roster-board";

export const dynamic = "force-dynamic";

/**
 * Build the link a professor pastes into a class chat.
 *
 * Derived from the request rather than an env var so it is correct on localhost,
 * on a preview deployment and in production without anything being configured —
 * the professor is going to read this off a projector, and a wrong hostname is a
 * class that cannot join.
 */
async function joinUrlFor(code: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/join/${code}`;
}

export default async function HostConsolePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const host = await requireHost();
  requirePasswordChange(host);

  const room = await loadRoom(code);
  // Ownership re-derived here as well as in every action. An admin passes, for
  // the same reason `ownedRoom` lets them: support without impersonation.
  if (!room || (room.hostId !== host.id && host.role !== "admin")) notFound();

  const [roster, joinUrl] = await Promise.all([loadRoster(room.id), joinUrlFor(room.code)]);
  const open = roomIsOpen(room);

  /*
   * The board this room is played on, resolved once here rather than shipped in
   * every poll: the labels are static for the life of a room, and the console
   * asks for a roster every five seconds.
   *
   * `getScenario` returns undefined for a slug that has left the catalogue —
   * see its own note — so the class view is told rather than left to render a
   * chart of ids. The true causes are the professor's to see: this screen is
   * behind a host check, and the debrief reveals them to the students anyway.
   */
  const scenario = room.question.externalId ? getScenario(room.question.externalId) : undefined;

  return (
    <div className="min-h-screen">
      <AppHeader user={host} />
      <main className="container py-8">
        <Link
          href="/host"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All rooms
        </Link>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{room.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
              <Siren className="h-4 w-4 text-primary" />
              {room.question.title}
              <Badge variant={open ? "success" : "muted"}>{open ? "Open" : "Closed"}</Badge>
            </p>
          </div>
          <RoomControls roomId={room.id} isOpen={open} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
          <div className="space-y-4">
            <RoomCode code={room.code} joinUrl={joinUrl} />
            {!open && (
              // Says what closing did and — as importantly — what it did not do.
              // A professor who closes a room mid-class needs to know they have
              // not just ejected everyone.
              <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                Closed to new joiners. Students already playing keep their run and can still
                finish it — closing a room never strands analyst-days someone has spent.
              </p>
            )}
          </div>

          {/* Server-rendered once and handed to the poller, so the first paint is
              correct and the console still works if the poll never succeeds. */}
          <RosterBoard
            code={room.code}
            initial={roster}
            roomOpen={open}
            causes={(scenario?.causes ?? []).map((c) => ({ id: c.id, label: c.label }))}
            trueCauseIds={[...(scenario?.trueCauseIds ?? [])]}
            scenarioKnown={!!scenario}
          />
        </div>
      </main>
    </div>
  );
}
