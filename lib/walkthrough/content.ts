/**
 * The worked example every new student is shown.
 *
 * Authored by hand rather than drafted, because this one is the demo — the
 * first arithmetic anybody sees on the platform — and it is checked by
 * `tests/walkthrough-math.test.ts` against the question's own authored range on
 * every run. `scripts/draft-walkthrough.ts` produces the same shape for other
 * questions; those land as drafts for a human to approve.
 *
 * Chai in Bangalore is the demo for the same reason it is the guest tier's
 * guesstimate: it is the one everybody has already half-done in their head, so
 * the student's attention is on the METHOD rather than on the subject.
 *
 * Two things about the numbers are deliberate.
 *
 * The chain is short. Three steps is enough to show a population being sliced,
 * a rate being applied and a segment being added — and a beginner watching a
 * nine-step tree learns that guesstimates are long rather than that they are
 * structured.
 *
 * The floating population is a SECOND branch off the root rather than a
 * multiplier on the first. "Add 15% for offices and tourists" is how the sample
 * solution phrases it and it is how most candidates say it, but as a tree it
 * teaches the wrong reflex: the visitors are their own segment with their own
 * habit, and putting them beside the residents is what makes the sibling shares
 * legible.
 */

import type { WalkthroughContent } from "./types";

/** `Question.externalId` this example solves. */
export const DEMO_QUESTION_EXTERNAL_ID = "chai-bangalore-daily";

export const chaiWalkthrough: WalkthroughContent = {
  intro:
    "Here is one worked all the way through — a different question from yours, so nothing is " +
    "given away. Watch where the numbers go and, more importantly, where they come from.",
  steps: [
    {
      say: "Start with the pool you are slicing. For anything consumed in a city, that is its population.",
      node: {
        key: "pop",
        parentKey: null,
        label: "Bangalore population",
        value: "1.3cr",
        multiplier: "",
        combine: "sum",
      },
      because:
        "A round, defensible anchor. You are not expected to know the census — you are expected " +
        "to pick a number you can justify and say so out loud.",
    },
    {
      say: "Not everybody drinks chai. Cut the pool down to the people who actually do, and say how often.",
      node: {
        key: "drinkers",
        parentKey: "pop",
        label: "Residents who drink chai",
        value: "65%",
        multiplier: "1.5",
        combine: "sum",
      },
      because:
        "Roughly two in three, and about a cup and a half each on an ordinary day — one at home, " +
        "one somewhere else. The share goes in the first box, the rate in the ×.",
    },
    {
      say: "Now the people the population count misses. Offices, roadside trade and visitors are their own segment, not a rounding-up of the first.",
      node: {
        key: "floating",
        parentKey: "pop",
        label: "Floating population",
        value: "10%",
        multiplier: "1.5",
        combine: "sum",
      },
      because:
        "Commuters, students and tourists add about a tenth again on a working day, and they " +
        "drink at the same rate. Giving them their own branch is what stops it looking like a fudge.",
    },
  ],
  outro:
    "That is the whole method: anchor, slice, apply a rate, add what the slice missed. Your " +
    "question is a different subject and the same four moves — and every number you enter is " +
    "read as an assumption you are making, so say why as you go.",
};
