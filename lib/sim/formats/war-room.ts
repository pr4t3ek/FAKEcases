/**
 * The metric war room — the format every scenario played before there was more
 * than one.
 *
 * Nothing here is new. The phases are `SIM_PHASES` and the rubric is
 * `simRubric`, imported rather than copied, so this module *names* the format
 * that already existed instead of forking it. If the two ever disagree it will
 * be because someone edited one of them, and there is exactly one of each.
 */

import { SIM_PHASES } from "@/lib/types";
import { simRubric } from "@/lib/config/simulation";
import type { SimFormat } from "./types";

const PHASE_HELP: Record<(typeof SIM_PHASES)[number], { label: string; help: string }> = {
  observe: { label: "Observe", help: "Read the board and commit to a suspect." },
  investigate: { label: "Investigate", help: "Spend analyst-days on the data that settles it." },
  commit: { label: "Decide", help: "Name the cause and put capacity behind a fix." },
  debrief: { label: "Debrief", help: "What your decision did to the business." },
};

export const warRoomFormat: SimFormat = {
  slug: "war-room",
  label: "War room",
  tagline: "Diagnose a metric that moved, then spend one quarter's capacity on it.",
  phases: SIM_PHASES.map((id) => ({ id, ...PHASE_HELP[id] })),
  rubric: simRubric,
};

/**
 * The same format, played over several periods.
 *
 * A separate format rather than a flag on the one above, because the thing that
 * differs is the **rubric**, and a rubric is what a format is for. A run that
 * commits three times has something to be graded on that a single commit does
 * not: whether the capacity went in early, and whether a bet that the first
 * quarter's results had already discredited was made again anyway.
 *
 * Adding Adaptation to `simRubric` itself was the obvious move and is wrong.
 * Every existing war room would gain a sixth dimension it cannot express,
 * scoring a neutral 50 on it — which would quietly drag twelve scenarios'
 * overall scores toward the middle, and change the meaning of every result
 * already stored. The rubric a run was graded on has to be the rubric its
 * format declares.
 *
 * `SimResult.scoresJson` already carries dimensions the five typed columns
 * cannot name, so this needs no migration — the same seam the turnaround uses.
 *
 * **Currently reached by no authored scenario.** `formatFor` returns this only
 * when a scenario sets `decisionPeriods > 1`, and no war room does — periods
 * without an amendable diagnosis punish a wrong call with no recourse. The full
 * account, and the two things that have to land before one may set it again,
 * are on `SimScenario.decisionPeriods` in ../types.ts. Kept rather than deleted
 * because the work is done and correct; the missing piece is elsewhere.
 */
export const periodicWarRoomFormat: SimFormat = {
  ...warRoomFormat,
  slug: "war-room-periodic",
  tagline: "Diagnose a metric that moved, then spend a budget across three quarters.",
  rubric: [
    ...simRubric,
    {
      key: "adaptation",
      label: "Adaptation",
      hint: "Did you commit when it counted, and stop backing a bet the data had already answered?",
      weight: 1.0,
    },
  ],
};
