"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { joinRoom } from "@/app/actions/rooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The door.
 *
 * Three fields, all copied off the same whiteboard, which is why a failure names
 * all three rather than pointing at one — the server returns a single refusal
 * for a bad code, a closed room and a wrong password alike (see
 * `lib/rooms/access.ts`), and the form must not invent a distinction the server
 * deliberately refuses to draw.
 *
 * No account needed: `joinRoom` mints a guest row after the password verifies.
 */
export function JoinForm({ defaultCode = "" }: { defaultCode?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await joinRoom({
        code: String(formData.get("code") ?? ""),
        password: String(formData.get("password") ?? ""),
        name: String(formData.get("name") ?? ""),
      });
      if (!result.ok || !result.code) {
        setError(result.error ?? "That didn't work.");
        return;
      }
      router.push(`/room/${result.code}`);
    });
  }

  return (
    <form action={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="code">Room code</Label>
        <Input
          id="code"
          name="code"
          defaultValue={defaultCode}
          placeholder="A1B2C3"
          // Uppercase and wide-tracked to match how it is written on the board.
          // The server normalises anyway — lowercase, spaces, hyphens and the
          // O/0 and I/1 mix-ups all resolve — so this is presentation, not
          // validation.
          className="font-mono uppercase tracking-[0.2em]"
          autoComplete="off"
          autoCapitalize="characters"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="room-password">Room password</Label>
        <Input
          id="room-password"
          name="password"
          // Deliberately not `type="password"`: this is a shared classroom
          // string being copied off a projector, not a personal credential, and
          // dots make a typo impossible to spot.
          type="text"
          autoComplete="off"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          name="name"
          placeholder="What your professor will see"
          maxLength={40}
          autoComplete="name"
          required
        />
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Join the room
      </Button>
    </form>
  );
}
