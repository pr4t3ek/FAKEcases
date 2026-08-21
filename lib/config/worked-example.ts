/**
 * One guesstimate, worked end to end.
 *
 * Everything else that greets a first-timer teaches the SCREEN.
 * `OnboardingOverlay` says where the chat and the tools are; `TutorialTour`
 * spotlights each panel and says what it is worth. Both are a tour of the
 * workspace, and someone can finish both still not knowing the actual method:
 * pick something you can count, turn it into a rate, extend it over time, then
 * check the answer against something you already know.
 *
 * So this is a worked answer rather than a tour, and it is deliberately NOT one
 * of the seeded questions — a tutorial that solves a catalogue question is an
 * answer key. A four-chair salon is small enough to hold in your head and far
 * enough from anything in the library to be safe.
 *
 * Authored here rather than in the component for the reason every other piece of
 * content in this app is: the figures are the teaching, and they should be
 * editable by someone who is not reading JSX. `tests/worked-example.test.ts`
 * checks that they still multiply out, so retuning one without redoing the total
 * fails loudly instead of shipping a lesson that teaches an error.
 */

export interface WorkedStep {
  /** The step's name, as it would read on a tree card. */
  label: string;
  /** The figure that goes in the box. */
  value: string;
  /** Why this figure, in one plain sentence. */
  why: string;
  /**
   * The number this contributes to the product.
   *
   * Kept beside the display value rather than parsed back out of it, because
   * the display string is prose ("about 2") and the arithmetic must not depend
   * on how it happens to be worded.
   */
  factor: number;
}

export const workedExample = {
  question: "How many haircuts does a neighbourhood salon do in a month?",

  /** Why this question, and what the reader is about to watch. */
  intro:
    "Nobody knows this number, and that is the point. A guesstimate is not a fact you " +
    "remember — it is a chain of small guesses, each one defensible, multiplied together. " +
    "Here is the whole method on a problem small enough to check.",

  steps: [
    {
      label: "Chairs in the salon",
      value: "4",
      why:
        "Start from something you could count if you walked in. Not customers — you cannot " +
        "see those. Chairs are the thing that physically limits how many people can be served.",
      factor: 4,
    },
    {
      label: "Haircuts per chair per hour",
      value: "2",
      why:
        "A cut takes about half an hour including the wait and the tidy-up, so one chair " +
        "turns over twice an hour. This is the step that converts a count into a rate.",
      factor: 2,
    },
    {
      label: "Hours open per day",
      value: "10",
      why: "Roughly 10am to 8pm. Round to a number you can multiply in your head.",
      factor: 10,
    },
    {
      label: "Days open per month",
      value: "26",
      why: "Closed on Mondays, so about six days a week, four and a bit weeks a month.",
      factor: 26,
    },
  ] satisfies WorkedStep[] as WorkedStep[],

  /** 4 × 2 × 10 × 26. Stated rather than computed so the test can disagree with it. */
  total: 2080,
  totalLabel: "about 2,000 haircuts a month",

  /**
   * The habit worth teaching hardest.
   *
   * A candidate cannot check their answer against the real number — they do not
   * have it, and neither does the interviewer in the room. What they CAN do is
   * convert the answer into a different currency they have intuition about. That
   * is the only self-check available, and it is what separates an estimate from
   * a guess.
   */
  sanityCheck: {
    pricePerCut: 150,
    /** total × pricePerCut, in rupees. Checked by the test. */
    monthlyRevenue: 312_000,
    text:
      "At about ₹150 a cut that is roughly ₹3.1 lakh a month. For a four-chair " +
      "neighbourhood salon paying rent, four stylists and the electricity, that sounds " +
      "about right. If it had come out at ₹30 lakh, one of the steps above is wrong — and " +
      "you would go back and find it without ever knowing the true answer.",
  },

  /** What to carry into the real question. */
  habits: [
    "Say each assumption out loud as you make it. An interviewer is grading the reasoning, and a number with no stated basis cannot be argued with — or credited.",
    "Round hard. 26 days, not 26.4. You are aiming for the right order of magnitude, and awkward numbers cost time without buying accuracy.",
    "Finish on a number, then give it a range. \"About 2,000, call it 1,800 to 2,400\" shows you know which of your steps was the shakiest.",
  ],
} as const;
