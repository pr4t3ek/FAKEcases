import { redirect } from "next/navigation";
import Link from "next/link";

import { getSessionUser } from "@/lib/auth";
import { ARENA_WALL, canPlayArena } from "@/lib/arena/access";
import { getArenaGame, DEFAULT_GAME_SLUG } from "@/lib/arena/registry";
import { matchesFor } from "@/lib/arena";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArenaLobby } from "@/components/arena/arena-lobby";
import { AppHeader } from "@/components/app/app-header";

export const dynamic = "force-dynamic";

/**
 * The Arena's front door.
 *
 * Gated twice on purpose. The nav link is rendered off `canPlayArena` and so is
 * this page, but the page checks again rather than trusting that nobody typed
 * the URL — the link is a courtesy and the server is the control.
 */
export default async function ArenaPage() {
  const user = await getSessionUser();
  if (!canPlayArena(user)) redirect(ARENA_WALL);

  const game = getArenaGame(DEFAULT_GAME_SLUG);
  if (!game) redirect("/dashboard");

  const matches = await matchesFor(user!.id, 8);

  return (
    /*
     * `AppHeader` wraps this the way it wraps `/library` and `/simulations`,
     * rather than the Arena carrying a back link of its own. It was the one
     * surface in the app with no chrome at all, so there was no way out of it
     * except the browser's back button — and from a finished match, not even
     * that led anywhere useful.
     */
    <div className="min-h-screen">
      <AppHeader user={user} />
      <div className="mx-auto w-full max-w-5xl space-y-8 p-4 sm:p-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{game.label}</h1>
            <Badge variant="secondary">Arena</Badge>
          </div>
          <p className="max-w-3xl text-muted-foreground">{game.premise}</p>
          <p className="max-w-3xl text-sm text-muted-foreground">{game.situation}</p>
        </header>

        <ArenaLobby />

        {matches.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Your matches</h2>
            <div className="grid gap-2">
              {matches.map((m) => {
                const seat = m.seats.find((s) => s.userId === user!.id);
                return (
                  <Card key={m.id} className="flex flex-wrap items-center gap-3 p-3">
                    <Link href={`/arena/${m.id}`} className="font-medium hover:underline">
                      {m.mode === "solo" ? "Solo match" : `Match ${m.code ?? ""}`}
                    </Link>
                    <Badge variant={m.status === "finished" ? "secondary" : "success"}>
                      {m.status === "finished"
                        ? "Finished"
                        : m.status === "lobby"
                          ? "Lobby"
                          : `Quarter ${Math.min(m.round + 1, 8)}`}
                    </Badge>
                    {seat?.placing ? (
                      <span className="text-sm text-muted-foreground">
                        Finished {ordinal(seat.placing)} · {seat.overall}
                      </span>
                    ) : null}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </span>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}
