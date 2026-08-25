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

import type { CaseWalkthroughContent, NumericWalkthroughContent } from "./types";

/** `Question.externalId` this example solves. */
export const DEMO_QUESTION_EXTERNAL_ID = "chai-bangalore-daily";

export const chaiWalkthrough: NumericWalkthroughContent = {
  kind: "numeric",
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

/**
 * The worked CASE, and the second thing a beginner can watch.
 *
 * Falling delivery margins is the demo for the same reason chai is the
 * guesstimate demo: it is the shape everybody expects — revenue against cost —
 * so attention stays on the METHOD rather than on the industry.
 *
 * Three things about the marks are deliberate.
 *
 * **The root is left unexamined.** A candidate does not deliver a verdict on
 * "contribution margin"; they deliver one on its branches. Marking the top would
 * teach the gesture backwards.
 *
 * **Revenue is cleared before cost is opened.** Eliminating a side is what makes
 * a trail a diagnosis rather than a lucky first guess, and `scoreDiagnosis`
 * rewards exactly that ordering. A student who watches this learns to close a
 * branch out loud.
 *
 * **Average order value is cleared even though it moved.** It slipped about 6%,
 * which is real and is not where the margin went — and saying so is the whole
 * judgement being taught. Marking it "problem" because a number changed is the
 * commonest way a candidate loses a case they had almost solved, so the
 * `because` names the 6% and then sets it against the 31%.
 *
 * The chain is short for the same reason the chai one is. Seven nodes is enough
 * to show a tree split, a side eliminated and a cause narrowed to a leaf; a
 * beginner watching a fifteen-node tree learns that cases are long rather than
 * that they are diagnosed.
 */

/** `Question.externalId` this example works. */
export const CASE_DEMO_QUESTION_EXTERNAL_ID = "qual-food-delivery-margin";

export const foodDeliveryCaseWalkthrough: CaseWalkthroughContent = {
  kind: "case",
  intro:
    "Here is a case worked all the way through — a different question from yours, so nothing is " +
    "given away. A case is not solved by building the prettiest tree. It is solved by closing " +
    "branches until only one is left standing. Watch what gets ruled OUT.",
  steps: [
    {
      say: "Margin per order fell while volume held. So the answer is inside one order, not inside the number of them. Split it the only way it splits.",
      node: {
        key: "margin",
        parentKey: null,
        label: "Contribution margin per order",
        status: "unknown",
      },
      because:
        "The top of the tree gets no verdict, ever. It is the thing being explained, not a " +
        "candidate explanation — you deliver judgements on its branches.",
    },
    {
      say: "Take the revenue side first, and be willing to close it.",
      node: {
        key: "revenue",
        parentKey: "margin",
        label: "Revenue per order",
        status: "healthy",
      },
      because:
        "Cleared, not skipped. Saying “the money is still coming in at roughly the same rate” " +
        "out loud is what earns the right to spend the rest of the case on cost.",
    },
    {
      say: "Check what the platform charges before assuming it charges less.",
      node: {
        key: "take",
        parentKey: "revenue",
        label: "Commission / take rate",
        status: "healthy",
      },
      because:
        "18% of order value, unchanged. A falling take rate would have been the tidy answer, " +
        "and it is worth thirty seconds to find out that it is not the answer here.",
    },
    {
      say: "Then the basket the commission is charged on. This one did move — and it is still not your answer.",
      node: {
        key: "aov",
        parentKey: "revenue",
        label: "Average order value",
        status: "healthy",
      },
      because:
        "Down about 6%, mostly tier-2. Real, and an order of magnitude too small to explain the " +
        "fall. Marking every number that moved as “the problem” is how a nearly-solved case is lost.",
    },
    {
      say: "Now the other side. This is where the margin went — but “cost” is a region, not a cause.",
      node: {
        key: "cost",
        parentKey: "margin",
        label: "Cost per order",
        status: "problem",
      },
      because:
        "“The problem is in here” is a narrowing claim, not an answer. Stopping at this node is " +
        "the single commonest way to finish a case having located nothing.",
    },
    {
      say: "Discounting is the usual suspect in Indian delivery, so rule it out explicitly rather than quietly.",
      node: {
        key: "discounts",
        parentKey: "cost",
        label: "Discounts",
        status: "healthy",
      },
      because:
        "Flat per order. The obvious culprit being innocent is worth saying — an interviewer is " +
        "listening for whether you checked or whether you guessed.",
    },
    {
      say: "One branch left, and it has nothing underneath it. That is what finishing looks like.",
      node: {
        key: "delivery",
        parentKey: "cost",
        label: "Delivery cost per order",
        status: "problem",
      },
      because:
        "Rider payouts up 31% year-on-year against revenue that barely moved. Everything else was " +
        "eliminated, so this is not a hypothesis any more — it is what is left.",
    },
  ],
  outro:
    "That is the method: split the tree, close the branches you can, and keep narrowing until the " +
    "last one has nothing under it. The answer here was never hard to guess — it was hard to EARN, " +
    "and the earning is the four branches you watched get closed on the way.",
};
