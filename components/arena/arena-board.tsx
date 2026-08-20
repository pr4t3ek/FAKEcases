"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot, Clock, Copy, LogOut, User as UserIcon } from "lucide-react";

import { beginMatch, commitQuarter, leaveMatch } from "@/app/actions/arena";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ArenaBoardData } from "@/lib/arena/payload";
import { money, ordersShort, percent, rupees } from "./format";

/**
 * The board.
 *
 * Three bands rather than the buyback's three columns: the market at the top
 * because it is what you are reading, your own position in the middle because it
 * is what you are reading it against, and the four controls at the bottom
 * because they are the last thing you do. Putting the decisions under the
 * evidence is the whole ergonomic argument — a board that leads with sliders
 * invites moving them before looking.
 *
 * Every control is described by the config. This component knows there are
 * decisions with bounds and a kind; it does not know one of them is a price.
 */
export function ArenaBoard({ data }: { data: ArenaBoardData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(data.decisions.map((d) => [d.key, d.value])),
  );

  const lobby = data.status === "lobby";
  const quarter = Math.min(data.round + 1, data.totalRounds);

  function commit() {
    startTransition(async () => {
      const result = await commitQuarter(data.matchId, values);
      if (!result.ok) return void toast.error(result.error ?? "Could not commit");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">
      <Header data={data} quarter={quarter} pending={pending} />

      {lobby ? (
        <Lobby data={data} pending={pending} />
      ) : (
        <>
          <MarketBand data={data} />
          {data.you && <YourBand you={data.you} />}
          <DecisionBand
            data={data}
            values={values}
            onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
            onCommit={commit}
            pending={pending}
          />
        </>
      )}
    </div>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────

function Header({
  data,
  quarter,
  pending,
}: {
  data: ArenaBoardData;
  quarter: number;
  pending: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // A multiplayer board has to notice the other seats without the player doing
  // anything. Counters only — the poll compares them and refreshes the page,
  // so this never becomes a second copy of the payload builder.
  useArenaPoll(data);

  return (
    <header className="flex flex-wrap items-center gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{data.gameLabel}</h1>
        <p className="text-sm text-muted-foreground">
          {data.status === "lobby"
            ? "Waiting to start"
            : `Quarter ${quarter} of ${data.totalRounds}`}
        </p>
      </div>

      {data.status !== "lobby" && (
        <div className="min-w-[8rem] flex-1">
          <Progress value={(data.round / data.totalRounds) * 100} />
        </div>
      )}

      {data.roundEndsAt !== null && data.status === "running" && (
        <Countdown endsAt={data.roundEndsAt} />
      )}

      {data.code && (
        <CodeChip code={data.code} />
      )}

      {data.seatIndex !== null && data.status === "running" && (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() =>
            startTransition(async () => {
              await leaveMatch(data.matchId);
              router.push("/arena");
            })
          }
          disabled={pending}
          title="Your seat is handed to the house and the match carries on."
        >
          <LogOut className="mr-1 h-3.5 w-3.5" aria-hidden />
          Leave
        </Button>
      )}
    </header>
  );
}

function CodeChip({ code }: { code: string }) {
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-sm tracking-widest hover:bg-accent"
      onClick={() => {
        void navigator.clipboard?.writeText(code);
        toast.success("Code copied");
      }}
      title="Copy the match code"
    >
      {code}
      <Copy className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
    </button>
  );
}

/**
 * The round clock.
 *
 * Rendered from a timestamp the server sent rather than counted up locally, so
 * a reloaded tab shows the same deadline and a slow clock cannot drift into
 * saying there is time left when there is not. It is a display only — the
 * server decides what expired, when somebody asks.
 */
function Countdown({ endsAt }: { endsAt: number }) {
  const [left, setLeft] = useState(() => Math.max(0, endsAt - Date.now()));

  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, endsAt - Date.now())), 500);
    return () => clearInterval(id);
  }, [endsAt]);

  const seconds = Math.ceil(left / 1000);
  return (
    <Badge variant={seconds <= 20 ? "warning" : "secondary"} className="tabular-nums">
      <Clock className="mr-1 h-3.5 w-3.5" aria-hidden />
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
    </Badge>
  );
}

/** Poll counters and refresh when one moves. Multiplayer only. */
function useArenaPoll(data: ArenaBoardData) {
  const router = useRouter();
  const seen = useRef(`${data.status}:${data.round}`);

  useEffect(() => {
    if (data.mode === "solo") return;

    const id = setInterval(async () => {
      try {
        const response = await fetch(`/api/arena/${data.matchId}/state`, { cache: "no-store" });
        if (!response.ok) return;
        const state = (await response.json()) as { status: string; round: number };
        const key = `${state.status}:${state.round}`;
        if (key !== seen.current) {
          seen.current = key;
          router.refresh();
        }
      } catch {
        // A dropped poll is not worth a toast; the next one is five seconds away.
      }
    }, 5_000);

    return () => clearInterval(id);
  }, [data.matchId, data.mode, router]);
}

// ─── Lobby ─────────────────────────────────────────────────────────────────

function Lobby({ data, pending }: { data: ArenaBoardData; pending: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const taken = data.seats.filter((s) => !s.isAi).length;

  return (
    <Card className="space-y-4 p-4">
      <div>
        <h2 className="font-medium">Waiting to start</h2>
        <p className="text-sm text-muted-foreground">
          {taken} of {data.seats.length} seats taken. Share the code above — any seat still empty
          when you start is played by the house, so you never have to wait for a full table.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {data.seats.map((seat) => (
          <div
            key={seat.seatIndex}
            className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
          >
            {seat.isAi ? (
              <Bot className="h-4 w-4 text-muted-foreground" aria-hidden />
            ) : (
              <UserIcon className="h-4 w-4" aria-hidden />
            )}
            <span className={cn(!seat.isAi && "font-medium")}>
              {seat.isAi ? "Open — the house will play it" : seat.displayName}
            </span>
            {seat.seatIndex === data.seatIndex && <Badge variant="outline">You</Badge>}
          </div>
        ))}
      </div>

      {data.isHost && (
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await beginMatch(data.matchId);
              if (!result.ok) return void toast.error(result.error ?? "Could not start");
              router.refresh();
            })
          }
        >
          Start the match
        </Button>
      )}
    </Card>
  );
}

// ─── The market ────────────────────────────────────────────────────────────

function MarketBand({ data }: { data: ArenaBoardData }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b p-3">
        <h2 className="text-sm font-medium">The city</h2>
        <span className="text-xs text-muted-foreground">
          Everyone can see prices and share. Nobody can see anyone else&rsquo;s capacity.
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Firm</th>
              <th className="p-3 text-right font-medium">Price</th>
              <th className="p-3 text-right font-medium">Orders</th>
              <th className="p-3 text-right font-medium">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.firms
              .slice()
              .sort((a, b) => b.share - a.share)
              .map((firm) => (
                <tr key={firm.seatIndex} className={cn(firm.isYou && "bg-accent/40")}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {firm.isAi ? (
                        <Bot className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      ) : (
                        <UserIcon className="h-3.5 w-3.5" aria-hidden />
                      )}
                      <span className={cn(firm.isYou && "font-medium")}>{firm.name}</span>
                      {firm.isYou && <Badge variant="outline">You</Badge>}
                    </div>
                  </td>
                  <td className="p-3 text-right tabular-nums">{rupees(firm.price)}</td>
                  <td className="p-3 text-right tabular-nums">{ordersShort(firm.served)}</td>
                  <td className="p-3 text-right tabular-nums">{percent(firm.share)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {data.chatter.length > 0 && (
        <div className="space-y-1 border-t bg-muted/30 p-3 text-sm text-muted-foreground">
          {data.chatter.map((c) => (
            <p key={c.seatIndex}>{c.line}</p>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Your position ─────────────────────────────────────────────────────────

function YourBand({ you }: { you: NonNullable<ArenaBoardData["you"]> }) {
  const tiles: { label: string; value: string; hint?: string; tone?: "warn" }[] = [
    { label: "Last quarter", value: money(you.profit), hint: "Revenue less every cost" },
    { label: "Cash", value: money(you.cash) },
    {
      label: "Utilisation",
      value: percent(you.utilisation),
      hint: `${ordersShort(you.served)} served on ${ordersShort(you.capacity)} of capacity`,
      // The queue is convex past about 85%, so this is the number that decides
      // whether the promise survives the quarter.
      tone: you.utilisation > 0.9 ? "warn" : undefined,
    },
    {
      label: "Delivery",
      value: `${Math.round(you.actualMins)} min`,
      hint: `${percent(you.reliability)} of promises kept`,
      tone: you.reliability < 0.9 ? "warn" : undefined,
    },
    {
      label: "Reputation",
      value: percent(you.reputation),
      hint: "Falls when you cannot serve demand or break a promise",
      tone: you.reputation < 0.8 ? "warn" : undefined,
    },
    { label: "Cost per order", value: rupees(you.unitCost), hint: "Rises when you are small or fast" },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => (
        <Card key={tile.label} className="p-3">
          <div className="text-xs text-muted-foreground">{tile.label}</div>
          <div
            className={cn(
              "mt-1 text-lg font-semibold tabular-nums",
              tile.tone === "warn" && "text-destructive",
            )}
          >
            {tile.value}
          </div>
          {tile.hint && (
            <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{tile.hint}</div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ─── The four decisions ────────────────────────────────────────────────────

function DecisionBand({
  data,
  values,
  onChange,
  onCommit,
  pending,
}: {
  data: ArenaBoardData;
  values: Record<string, number>;
  onChange: (key: string, value: number) => void;
  onCommit: () => void;
  pending: boolean;
}) {
  if (data.seatIndex === null) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        You are watching this match rather than playing it.
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium">Your quarter</h2>
        {data.committed && <Badge variant="success">Committed</Badge>}
        {data.waitingOn.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Waiting on {data.waitingOn.join(", ")} — the quarter runs anyway when the clock does.
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.decisions.map((decision) => (
          <div key={decision.key} className="space-y-1.5">
            <label htmlFor={`d-${decision.key}`} className="text-sm font-medium">
              {decision.label}
            </label>
            <Input
              id={`d-${decision.key}`}
              type="number"
              inputMode="numeric"
              min={decision.min}
              max={decision.max}
              step={decision.step}
              value={values[decision.key] ?? decision.value}
              disabled={pending || data.committed}
              onChange={(e) => onChange(decision.key, Number(e.target.value))}
              className="tabular-nums"
            />
            <p className="text-[11px] leading-snug text-muted-foreground">{decision.help}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onCommit} disabled={pending || data.committed}>
          {data.committed ? "Committed" : "Commit the quarter"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Your rivals have already chosen. They cannot see what you do here until it lands.
        </p>
      </div>
    </Card>
  );
}
