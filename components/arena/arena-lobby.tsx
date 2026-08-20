"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Users } from "lucide-react";

import { createMatch, joinMatch, startSolo } from "@/app/actions/arena";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * Three ways in, and the order is the argument.
 *
 * Solo comes first and is the biggest button, because it is the one that always
 * works. A game whose front door is "wait for three other people" is a game
 * nobody plays on a Tuesday afternoon, and the whole design — AI seats that
 * backfill, a timer that resolves without you — exists so that the multiplayer
 * option is a nicety rather than a precondition.
 */
export function ArenaLobby() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");

  function solo() {
    startTransition(async () => {
      await startSolo();
    });
  }

  function host() {
    startTransition(async () => {
      await createMatch("multi");
    });
  }

  function join(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await joinMatch(code);
      if (!result.ok) return void toast.error(result.error ?? "Could not join");
      router.push(`/arena/${result.matchId}`);
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="flex flex-col gap-3 p-4 sm:col-span-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Play className="h-4 w-4" aria-hidden />
          Play now
        </div>
        <p className="flex-1 text-sm text-muted-foreground">
          You against three rival firms. Starts immediately, eight quarters, about fifteen minutes.
        </p>
        <Button onClick={solo} disabled={pending}>
          Start a solo match
        </Button>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4" aria-hidden />
          Play with people
        </div>
        <p className="flex-1 text-sm text-muted-foreground">
          Opens a match with a code to share. Any seat nobody takes is played by the house, so it
          starts whether one person joins or three.
        </p>
        <Button variant="secondary" onClick={host} disabled={pending}>
          Create a match
        </Button>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <div className="text-sm font-medium">Join a match</div>
        <form onSubmit={join} className="flex flex-1 flex-col gap-3">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Match code"
            maxLength={8}
            className="font-mono tracking-widest"
            aria-label="Match code"
          />
          <Button type="submit" variant="secondary" disabled={pending || code.length < 4}>
            Join
          </Button>
        </form>
      </Card>
    </div>
  );
}
