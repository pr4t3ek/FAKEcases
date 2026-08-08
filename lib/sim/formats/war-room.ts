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
