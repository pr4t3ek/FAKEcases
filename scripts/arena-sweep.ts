/**
 * Does any fixed strategy win this game?
 *
 * The arena's counterpart to `checkBalance` (`lib/sim/balance.ts`), and it
 * exists for the same reason: a claim about a game's balance that nobody
 * measured is a hope. A war room's claim is "the declared best allocation
 * really is the best", proved by brute force. This game's claim is the opposite
 * shape — **no fixed line of play should reliably win** — and it is proved by
 * playing a library of them across many matches and looking at how often each
 * one comes first.
 *
 * That is the seventh of the seven anti-memorisation devices listed at the top
 * of `lib/sim/configs/mandi.ts`, and the only one that can fail silently. The
 * other six are properties of the model; this is the one that says the model's
 * numbers actually produce a game.
 *
 * Run it:
 *
 *   npx tsx scripts/arena-sweep.ts            # 200 matches per strategy
 *   npx tsx scripts/arena-sweep.ts 500        # more, for a tuning pass
 *
 * `tests/arena-sweep.test.ts` runs a smaller version of the same thing and
 * fails the build if any strategy clears the ceiling.
 */

import { runSweep, STRATEGIES, WIN_RATE_CEILING } from "@/lib/arena/sweep";

const matches = Number(process.argv[2] ?? 200);
const rows = runSweep({ matches });

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const pad = (s: string, n: number) => s.padEnd(n);
const padStart = (s: string, n: number) => s.padStart(n);

console.log(`\nMandi — ${matches} matches per strategy, seat 0 against three drawn rivals\n`);
console.log(
  pad("strategy", 16) +
    padStart("wins", 8) +
    padStart("2nd", 8) +
    padStart("mean NPV", 12) +
    padStart("mean rank", 11),
);
console.log("─".repeat(55));

for (const row of rows) {
  console.log(
    pad(row.id, 16) +
      padStart(pct(row.winRate), 8) +
      padStart(pct(row.secondRate), 8) +
      padStart(row.meanNpv.toFixed(0), 12) +
      padStart(row.meanPlacing.toFixed(2), 11),
  );
}

const worst = rows[0];
const floor = 1 / 4;
console.log("─".repeat(55));
console.log(
  `\nChance alone would win ${pct(floor)}. Ceiling for a fixed strategy is ${pct(WIN_RATE_CEILING)}.`,
);

if (worst.winRate > WIN_RATE_CEILING) {
  console.log(
    `\n✗ "${worst.id}" wins ${pct(worst.winRate)} of matches — that is a line a player can learn.\n`,
  );
  process.exit(1);
}

console.log(`\n✓ Best fixed strategy is "${worst.id}" at ${pct(worst.winRate)}.\n`);
console.log(`Strategies swept: ${STRATEGIES.map((s) => s.id).join(", ")}\n`);
