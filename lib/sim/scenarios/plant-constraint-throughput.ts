/**
 * "Every machine is busy and one dispatch in five is late."
 *
 * The operations war room: a plant whose every local number is good and whose
 * only global number — did the customer get the gears on the promised day — is
 * bad. The lesson is the oldest one in operations and the one candidates most
 * reliably get wrong in an interview: **a plant's output is its constraint's
 * output, and an hour lost at the constraint is lost by the whole factory,
 * while an hour saved anywhere else is not saved at all.**
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * Heat treatment is the constraint and nothing else is close. The furnace has
 * 5,760 hours a year and spends 3,917 of them actually treating parts: 1,010
 * hours go to changeovers and ramp, 448 to waiting for material that the
 * machining cells were too busy hitting their own efficiency targets to stage,
 * and 385 to maintenance. Every other work centre is measured on utilisation,
 * so every other work centre is busy — which is precisely why 19 of an order's
 * 34 days are spent in the queue in front of the furnace.
 *
 * The two levers that work both act on the constraint. Quick changeover buys
 * back furnace hours directly. Releasing material at the furnace's pace rather
 * than at the machining cells' pace collapses the queue, which is what actually
 * moves on-time delivery — because with 19 days of WIP in front of it, no
 * amount of expediting can make a promise date mean anything.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * `iv-second-hobber` is the classic mistake and must stay a loser: a machine at a
 * non-constraint adds parts to the queue, depreciation to the fixed cost, and
 * nothing to throughput. `iv-third-shift` is the honest trap — it is the only
 * decoy that genuinely adds constraint hours, and it has to stay *slightly*
 * positive and clearly worse than fixing the hours already owned. If a retune
 * makes it competitive, the scenario starts teaching "buy capacity" instead of
 * "stop wasting the capacity you have".
 *
 * `unitsSold` is a `min` of throughput and the order book on purpose. It is
 * what stops a candidate spending their way past the market: fund every lever
 * on the board at once and the furnace runs into the 3.80 lakh order book,
 * where the next hour earns nothing at all. That is a lesson the arithmetic
 * should deliver rather than the debrief.
 *
 * `tests/sim-scenario.test.ts` pins the constraint arithmetic, the second-hobber
 * trap and the demand ceiling; `checkBalance` is what will tell you if a retune
 * lets a decoy win.
 */

import type { SimScenario } from "../types";

const CRORE = 10_000_000;

export const plantConstraintThroughput: SimScenario = {
  slug: "plant-constraint-throughput",
  title: "Trishul Gears: every machine is busy and one dispatch in five is late",
  company: "Trishul Gears",
  premise:
    "A gear plant reports 92% equipment effectiveness and delivers 79% of its orders on time. Work out which of those two numbers describes the factory.",
  situation:
    "You are the operations lead at Trishul Gears, a Pune transmission-gear plant supplying three commercial-vehicle OEMs and the aftermarket. The plant made 3.06 lakh gears last year against an order book of 3.80 lakh. " +
    "The monthly review reports 92% overall equipment effectiveness and 89% machine utilisation. On-time-in-full delivery is 79% and falling, ₹1.67 crore went out in late penalties and premium freight, and the largest customer has put the plant on a quality-and-delivery watch. " +
    "The works manager wants a second CNC hobber. The production head wants a third shift. Sales wants a customer-service cell to chase orders. " +
    "You have 6 analyst-days to find out what is actually limiting the plant, then 4 people-weeks and ₹5 crore to act on it.",
  difficulty: "Medium",

  mentor: {
    persona: "a plant director debriefing a graduate industrial engineer",
    audience: "engineer",
  },

  teaching: {
    /**
     * Withheld deliberately. The shape of this model — output is the
     * constraint's hours times its rate, capped by the order book — is the
     * answer to the scenario, not context for it. A candidate who is shown that
     * graph has been handed the diagnosis before they buy a single pull.
     */
    showMetricMap: false,
    primer: {
      intro:
        "A factory is a chain of steps, and like any chain it can only pass work at the rate of its weakest link. Almost every number a plant reports is measured link by link, which is why a plant can be full of good numbers and still not deliver. These are the words you need to tell the two kinds of number apart.",
      terms: [
        {
          term: "Throughput",
          plain: "The rate at which the plant turns material into gears somebody has paid for — not what it produces, what it sells.",
          formula: "units dispatched × contribution per unit",
          matters:
            "It is the only output number that cannot be improved by making something nobody ordered. A plant that raises production and not dispatches has raised its inventory.",
          driver: "grossContribution",
        },
        {
          term: "The constraint",
          full: "The bottleneck",
          plain: "The one step whose capacity is smaller than the demand placed on it. Everything else has slack, whether or not it looks busy.",
          matters:
            "An hour lost at the constraint is an hour lost by the whole plant and can never be recovered. An hour saved anywhere else buys nothing, because that step was never the reason the gears were late.",
          driver: "furnaceRunHours",
        },
        {
          term: "Utilisation",
          plain: "The share of a machine's available time it spends running.",
          formula: "running hours ÷ available hours",
          matters:
            "The most quietly destructive metric in a factory. Measure every cell on it and every cell will make parts to keep itself busy — which piles up in front of the constraint, where it becomes queue rather than output.",
        },
        {
          term: "OEE",
          full: "Overall equipment effectiveness",
          plain: "Availability × performance × quality for one machine — how much good output a machine gave you against the theoretical maximum.",
          matters:
            "A per-machine number, so a plant average of 92% tells you nothing about the plant. Averaging a constraint with five non-constraints hides the only one that mattered.",
        },
        {
          term: "WIP",
          full: "Work in progress",
          plain: "Everything that has been started and not finished — the trolleys of half-made gears standing between machines.",
          matters:
            "It is the queue, and the queue is where the lead time goes. Three days of work sitting in front of the furnace is three days added to every promise you make.",
          driver: "wipDays",
        },
        {
          term: "Little's law",
          plain: "How long a job takes to get through equals how much work is in the plant divided by how fast the plant finishes work.",
          formula: "lead time = WIP ÷ throughput",
          matters:
            "It says the only two ways to shorten lead time are less WIP or more throughput — and since throughput is fixed by the constraint, releasing less material is usually the faster half.",
        },
        {
          term: "Changeover",
          full: "Setup time",
          plain: "The time between the last good part of one job and the first good part of the next — fixtures, programs, the furnace coming back to temperature.",
          matters:
            "At a non-constraint it is free, because that machine has spare time anyway. At the constraint it is output the factory will never get back, which is what makes where you schedule your setups a business decision.",
          driver: "furnaceRunShare",
        },
        {
          term: "OTIF",
          full: "On time in full",
          plain: "The share of orders delivered complete on the day promised.",
          matters:
            "The only number here the customer can feel. It is a consequence of queue length rather than of effort, which is why chasing orders harder moves it so little.",
          driver: "onTimeShare",
        },
        {
          term: "Drum-buffer-rope",
          plain: "Scheduling the whole plant to the constraint: the constraint sets the beat, a small buffer protects it, and material is released only as fast as it consumes it.",
          matters:
            "It is the operational form of the whole lesson. Nothing upstream is allowed to start work the constraint cannot take, so the queue stops growing and the promise dates start meaning something.",
        },
      ],
      worked: [
        "The furnace is available 5,760 hours a year — two shifts, sixteen hours, 360 days.",
        "It spends 3,917 of them treating gears: 68% of its own time.",
        "At 78 gears an hour that is 3.06 lakh gears, and the order book is 3.80 lakh.",
        "So the plant is 74,500 gears short of its order book, and 1,843 furnace hours are spent on something other than treating.",
        "Every other work centre in the plant has spare capacity against that same order book. Only this one does not.",
      ],
    },
  },

  northStar: "netContribution",
  reported: [
    "unitsSold",
    "onTimeShare",
    "furnaceRunShare",
    "wipDays",
    "latePenalty",
    "netContribution",
  ],

  drivers: [
    // ── The constraint, and everything that falls out of it. ───────────────
    { id: "furnaceHours", kind: "input", label: "Furnace hours available a year", unit: "count", goodDirection: "up", baseline: 5_760 },
    { id: "furnaceRunShare", kind: "input", label: "Share of furnace hours spent treating", unit: "ratio", goodDirection: "up", baseline: 0.68 },
    { id: "furnaceRunHours", kind: "product", label: "Furnace hours treating parts", unit: "count", goodDirection: "up", of: ["furnaceHours", "furnaceRunShare"] },
    { id: "furnaceRatePerHour", kind: "input", label: "Gears treated per furnace hour", unit: "count", goodDirection: "up", baseline: 78 },
    { id: "throughputUnits", kind: "product", label: "Gears the plant can finish", unit: "count", goodDirection: "up", of: ["furnaceRunHours", "furnaceRatePerHour"] },
    { id: "demandUnits", kind: "input", label: "Order book", unit: "count", goodDirection: "up", baseline: 380_000 },
    /**
     * The binding constraint, modelled rather than asserted. You cannot sell
     * what you cannot make, and you cannot sell what nobody ordered — so the
     * scenario can teach both halves, including the one where a candidate buys
     * furnace hours past the point the market can absorb them.
     */
    { id: "unitsSold", kind: "min", label: "Gears dispatched", unit: "count", goodDirection: "up", of: ["throughputUnits", "demandUnits"] },

    { id: "contributionPerUnit", kind: "input", label: "Contribution per gear", unit: "inr", goodDirection: "up", baseline: 640 },
    { id: "grossContribution", kind: "product", label: "Contribution earned", unit: "inr", goodDirection: "up", of: ["unitsSold", "contributionPerUnit"] },

    // ── Service, and what failing at it costs. ─────────────────────────────
    { id: "onTimeShareRaw", kind: "input", label: "On-time delivery, before the ceiling", unit: "ratio", goodDirection: "up", baseline: 0.79 },
    /**
     * Nobody delivers 100% on time, and a model that lets a candidate buy their
     * way past 1.0 would start paying negative penalties — a bonus for lateness.
     * The cap is a constant precisely so `validateScenario` refuses an
     * intervention aimed at it.
     */
    { id: "onTimeCeiling", kind: "constant", label: "Best on-time delivery achievable", unit: "ratio", goodDirection: "up", value: 0.98 },
    { id: "onTimeShare", kind: "min", label: "Delivered on time and in full", unit: "ratio", goodDirection: "up", of: ["onTimeShareRaw", "onTimeCeiling"] },
    { id: "onTimeUnits", kind: "product", label: "Gears delivered on time", unit: "count", goodDirection: "up", of: ["unitsSold", "onTimeShare"] },
    { id: "lateUnits", kind: "difference", label: "Gears delivered late", unit: "count", goodDirection: "down", minuend: "unitsSold", subtrahend: "onTimeUnits" },
    { id: "penaltyPerLateUnit", kind: "input", label: "Penalty and premium freight per late gear", unit: "inr", goodDirection: "down", baseline: 260 },
    { id: "latePenalty", kind: "product", label: "Late penalties and premium freight", unit: "inr", goodDirection: "down", of: ["lateUnits", "penaltyPerLateUnit"] },

    { id: "overtimeCost", kind: "input", label: "Overtime and contract labour", unit: "inr", goodDirection: "down", baseline: 1.1 * CRORE },
    { id: "fixedPlantCost", kind: "input", label: "Plant fixed cost", unit: "inr", goodDirection: "down", baseline: 9.4 * CRORE },
    { id: "totalCost", kind: "sum", label: "Cost of running the plant", unit: "inr", goodDirection: "down", of: ["latePenalty", "overtimeCost", "fixedPlantCost"] },
    { id: "netContribution", kind: "difference", label: "Net contribution", unit: "inr", goodDirection: "up", minuend: "grossContribution", subtrahend: "totalCost" },

    // Reported rather than costed: the queue is the symptom a candidate should
    // learn to read, and Little's law connects it to the lead time the customer
    // actually experiences.
    { id: "wipDays", kind: "input", label: "Days a gear spends in the plant", unit: "days", goodDirection: "down", baseline: 34 },
  ],

  dashboard: [
    {
      id: "p-tg-scorecard",
      kind: "stat",
      title: "The monthly plant review",
      caption: "FY26, as reported to the management committee.",
      tiles: [
        { label: "Overall equipment effectiveness", value: 0.92, unit: "ratio", goodDirection: "up" },
        { label: "Machine utilisation", value: 0.89, unit: "ratio", goodDirection: "up" },
        { label: "On time in full", value: 0.79, unit: "ratio", deltaPct: -0.061, goodDirection: "up" },
        { label: "Gears dispatched", value: 305_510, unit: "count", deltaPct: 0.012, goodDirection: "up" },
        { label: "Order book", value: 380_000, unit: "count", deltaPct: 0.084, goodDirection: "up" },
        { label: "Days in the plant", value: 34, unit: "days", deltaPct: 0.214, goodDirection: "down" },
      ],
    },
    {
      id: "p-tg-otif",
      kind: "timeseries",
      title: "Dispatches and on-time delivery",
      caption: "By quarter. Volume held; the promise did not.",
      series: [
        {
          label: "Gears dispatched",
          unit: "count",
          points: [
            { period: "Q1", value: 77_400 },
            { period: "Q2", value: 76_100 },
            { period: "Q3", value: 75_800 },
            { period: "Q4", value: 76_210 },
          ],
        },
        {
          label: "On time in full",
          unit: "ratio",
          points: [
            { period: "Q1", value: 0.84 },
            { period: "Q2", value: 0.81 },
            { period: "Q3", value: 0.78 },
            { period: "Q4", value: 0.74 },
          ],
        },
      ],
    },
    {
      /**
       * The answer is on the opening board, in plain sight, in a column
       * everybody reads as "which cells are working hard". Nobody reads a low
       * utilisation as a problem unless they already know which cell is the
       * constraint.
       */
      id: "p-tg-utilisation",
      kind: "segments",
      title: "Utilisation by work centre",
      caption: "Share of available hours running, FY26.",
      dimension: "Work centre",
      rows: [
        { label: "Turning", value: 0.91, unit: "ratio" },
        { label: "Hobbing", value: 0.88, unit: "ratio" },
        { label: "Shaving", value: 0.86, unit: "ratio" },
        { label: "Heat treatment", value: 0.68, unit: "ratio" },
        { label: "Grinding", value: 0.87, unit: "ratio" },
        { label: "Inspection and pack", value: 0.79, unit: "ratio" },
      ],
    },
    {
      id: "p-tg-costs",
      kind: "stat",
      title: "What last year cost",
      caption: "₹ crore unless stated.",
      tiles: [
        { label: "Late penalties and premium freight", value: 1.67 * CRORE, unit: "inr", deltaPct: 0.38, goodDirection: "down" },
        { label: "Overtime and contract labour", value: 1.1 * CRORE, unit: "inr", deltaPct: 0.22, goodDirection: "down" },
        { label: "Plant fixed cost", value: 9.4 * CRORE, unit: "inr", deltaPct: 0.04, goodDirection: "down" },
        { label: "Contribution per gear", value: 640, unit: "inr", deltaPct: -0.015, goodDirection: "up" },
      ],
    },
    {
      id: "p-tg-late-customers",
      kind: "segments",
      title: "Late lines by customer",
      caption: "Share of that customer's order lines delivered late, FY26.",
      dimension: "Customer",
      rows: [
        { label: "OEM A — transmission assembly", value: 0.24, unit: "ratio", deltaPct: 0.41 },
        { label: "OEM B — tractor gearbox", value: 0.19, unit: "ratio", deltaPct: 0.28 },
        { label: "OEM C — export programme", value: 0.22, unit: "ratio", deltaPct: 0.35 },
        { label: "Aftermarket distributors", value: 0.17, unit: "ratio", deltaPct: 0.19 },
      ],
    },
    {
      id: "p-tg-wip",
      kind: "timeseries",
      title: "Work in progress and lead time",
      caption: "Trolleys on the floor, and the days an order takes end to end.",
      series: [
        {
          label: "Work in progress, gears",
          unit: "count",
          points: [
            { period: "Q1", value: 21_400 },
            { period: "Q2", value: 24_800 },
            { period: "Q3", value: 27_900 },
            { period: "Q4", value: 29_600 },
          ],
        },
        {
          label: "Order lead time, days",
          unit: "days",
          points: [
            { period: "Q1", value: 28 },
            { period: "Q2", value: 31 },
            { period: "Q3", value: 33 },
            { period: "Q4", value: 34 },
          ],
        },
      ],
    },
    {
      id: "p-tg-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "Works manager: hobbing runs at 88% and we are turning work away. One more CNC hobber at ₹3.2 crore and we can put another 40,000 gears through the plant.\n" +
        "Production head: we run two shifts. Every plant our size runs three. Give me the third shift and the order book stops being a problem.\n" +
        "Sales director: the gears exist, they are somewhere in the plant, and nobody can tell a customer which day they will arrive. I want a service cell that chases the top 200 lines and pays for premium freight where it has to.\n" +
        "Nobody has compared each work centre's capacity against the hours the order book actually needs from it.",
    },
  ],

  budget: { analystDays: 6, sprints: 4, rupees: 5 * CRORE },

  drilldowns: [
    {
      id: "dd-constraint-map",
      label: "Capacity of every work centre against the order book",
      question: "Which steps genuinely cannot do what this year's orders need?",
      cost: 2,
      evidenceFor: ["flow.bottleneck", "capacity.machining"],
      readsAs:
        "Only heat treatment is short. The order book needs 4,872 furnace hours and the furnace treats for 3,917. Every other work centre has between 16% and 33% of spare capacity against the same book — including the hobbing cell the works manager wants to double.",
      reveals: [
        {
          id: "p-tg-capacity",
          kind: "segments",
          title: "Hours the order book needs, against hours the work centre has",
          caption: "Load factor: hours the order book needs ÷ hours the step actually gives. Above 1.00 the step cannot do it.",
          dimension: "Work centre",
          rows: [
            { label: "Turning", value: 0.84, unit: "multiple" },
            { label: "Hobbing", value: 0.81, unit: "multiple" },
            { label: "Shaving", value: 0.79, unit: "multiple" },
            { label: "Heat treatment", value: 1.24, unit: "multiple" },
            { label: "Grinding", value: 0.8, unit: "multiple" },
            { label: "Inspection and pack", value: 0.67, unit: "multiple" },
          ],
        },
        {
          id: "p-tg-capacity-note",
          kind: "note",
          title: "The same numbers, in gears",
          body:
            "The furnace treats 78 gears an hour and is available 5,760 hours a year. Treating every gear in the order book would take 4,872 hours; it currently treats for 3,917.\n\n" +
            "So the plant's ceiling is 3.06 lakh gears against an order book of 3.80 lakh, and it is set by one machine. The utilisation column on the monthly review reports heat treatment at 68% — the lowest number on the board — because 1,843 of its hours are spent on something other than treating.",
        },
      ],
    },
    {
      id: "dd-furnace-log",
      label: "What the furnace did with its 5,760 hours",
      question: "Where does a third of the constraint's year actually go?",
      cost: 2,
      evidenceFor: ["flow.bottleneck"],
      readsAs:
        "1,010 hours of changeover and ramp across 168 batches, 448 hours idle waiting for material the cells had not staged, and 385 hours of maintenance. The changeovers and the starvation together are 1,458 hours — 1.14 lakh gears the plant never made.",
      reveals: [
        {
          id: "p-tg-furnace",
          kind: "segments",
          title: "The furnace year, 5,760 hours",
          caption: "Hours, from the furnace controller log.",
          dimension: "Hours spent",
          rows: [
            { label: "Treating parts", value: 3_917, unit: "count" },
            { label: "Changeover, load and temperature ramp", value: 1_010, unit: "count" },
            { label: "Idle — no parts staged", value: 448, unit: "count" },
            { label: "Planned maintenance and calibration", value: 385, unit: "count" },
          ],
        },
        {
          id: "p-tg-furnace-note",
          kind: "note",
          title: "Why the changeovers are where they are",
          body:
            "The furnace ran 168 batches last year, averaging six hours of changeover and ramp each. Batch sizes are set by the machining cells' own schedules — each cell releases what suits its setup, and the furnace takes whatever arrives in the order it arrives.\n\n" +
            "Two thirds of the changeovers are between case-depth recipes that could be campaigned into runs of the same specification. A supplier's application engineer has quoted ₹1.7 crore for pre-heat staging and a second load table, which would take a changeover from six hours to two and a half.\n\n" +
            "The 448 idle hours are the other half of the same story: the cells are measured on their own utilisation, so they make what is quickest for them, not what the furnace needs next.",
        },
      ],
    },
    {
      id: "dd-order-flow",
      label: "Where an order's 34 days go",
      question: "Is the lead time work, or is it waiting?",
      cost: 2,
      evidenceFor: ["flow.bottleneck", "service.expediting"],
      readsAs:
        "3.1 days of the 34 are a machine touching the gear. 19.4 days are the queue in front of the furnace. A promise date is a guess about a queue, which is why chasing an order moves it up the queue and moves everything else down.",
      reveals: [
        {
          id: "p-tg-flow",
          kind: "segments",
          title: "An order's 34 days, sampled across 240 order lines",
          caption: "Days, average across the sample.",
          dimension: "Where the time went",
          rows: [
            { label: "Actually being machined, treated or ground", value: 3.1, unit: "days" },
            { label: "Queue in front of heat treatment", value: 19.4, unit: "days" },
            { label: "Queue elsewhere on the floor", value: 8.1, unit: "days" },
            { label: "Inspection, packing and dispatch", value: 3.4, unit: "days" },
          ],
        },
        {
          id: "p-tg-flow-note",
          kind: "note",
          title: "The arithmetic of the queue",
          body:
            "There are 29,600 gears on the floor and the plant finishes about 1,270 a working day. Little's law puts the lead time at 23 working days — 34 calendar days — and it is right.\n\n" +
            "Nothing about that number can be improved by chasing. Expediting one order moves it to the front of the furnace queue, which pushes every other order back by the same amount; the plant's own data shows expedited lines improved by 9 days last year and non-expedited lines got worse by 6.",
        },
      ],
    },
    {
      id: "dd-machining-queue",
      label: "The machining cells and what happens to their output",
      question: "Would a second hobber put more gears out of the door?",
      cost: 2,
      evidenceFor: ["capacity.machining"],
      readsAs:
        "The hobbing cell runs at 88% and its output goes straight into the 19-day queue at the furnace. A second machine adds about 41,000 machined gears a year to a queue that is already 29,600 long, and not one of them can be treated.",
      reveals: [
        {
          id: "p-tg-machining",
          kind: "stat",
          title: "The hobbing cell",
          caption: "FY26.",
          tiles: [
            { label: "Utilisation", value: 0.88, unit: "ratio", goodDirection: "up" },
            { label: "Gears machined a year", value: 341_000, unit: "count", goodDirection: "up" },
            { label: "Waiting at heat treatment", value: 0.62, unit: "ratio", goodDirection: "down" },
            { label: "Second machine, capital cost", value: 3.2 * CRORE, unit: "inr", goodDirection: "down" },
          ],
        },
        {
          id: "p-tg-machining-note",
          kind: "note",
          title: "What the last capacity purchase did",
          body:
            "The plant bought a third grinding machine in FY24 on the same argument: grinding was running at 90% and orders were late. Grinding utilisation fell to 71%, work in progress rose 18%, and on-time delivery moved from 86% to 84%.\n\n" +
            "The gears that machine makes still have to be heat treated.",
        },
      ],
    },
    {
      id: "dd-third-shift",
      label: "What a third shift would cost and produce",
      question: "If the furnace is short of hours, should we simply run more of them?",
      cost: 2,
      evidenceFor: ["capacity.shifts"],
      readsAs:
        "A third shift adds about 10% to furnace hours after the manning and skill constraints, at ₹1.43 crore of labour, and it runs the same 68% pattern — a third of the new hours go to changeover and starvation too. It buys hours at four times the price of fixing the ones already owned.",
      reveals: [
        {
          id: "p-tg-shift",
          kind: "segments",
          title: "A third shift on heat treatment",
          caption: "Annualised, as costed by HR and the works accountant.",
          dimension: "Line",
          rows: [
            { label: "Additional furnace hours available", value: 576, unit: "count" },
            { label: "Of which treating, at the current 68% pattern", value: 392, unit: "count" },
            { label: "Additional gears a year", value: 30_550, unit: "count" },
            { label: "Additional labour and shift allowance, ₹ crore", value: 1.43, unit: "inr_crore" },
          ],
        },
        {
          id: "p-tg-shift-note",
          kind: "note",
          title: "The skilled-manning problem",
          body:
            "The furnace needs a qualified heat-treatment operator on every shift and the local market has four. Two of them are on the plant's own payroll. A third shift therefore runs on a trainee under supervision for the first two quarters, which is why the costing assumes 10% more hours rather than the 50% a full shift implies.\n\n" +
            "Quick changeover, by contrast, is 1,010 hours the plant has already paid for.",
        },
      ],
    },
    {
      id: "dd-vendor-leadtime",
      label: "The forging vendor's delivery performance",
      question: "Are we late because our supplier is?",
      cost: 2,
      evidenceFor: ["supply.forgings"],
      readsAs:
        "Forging lead time went from 21 days to 34 and the vendor's on-time rate is 88%. Real, annoying, and not the constraint: the plant holds 26 days of forging stock and has never stopped a machine for want of one.",
      reveals: [
        {
          id: "p-tg-vendor",
          kind: "stat",
          title: "Forgings, FY26",
          tiles: [
            { label: "Vendor lead time, days", value: 34, unit: "days", deltaPct: 0.62, goodDirection: "down" },
            { label: "Vendor on-time delivery", value: 0.88, unit: "ratio", goodDirection: "up" },
            { label: "Forging stock held, days", value: 26, unit: "days", goodDirection: "down" },
            { label: "Machine hours lost to forging shortage", value: 0, unit: "count", goodDirection: "down" },
          ],
        },
      ],
    },
    {
      id: "dd-late-orders",
      label: "The late order book, line by line",
      question: "Is there a pattern in what goes late — a customer, a variant, a cause?",
      cost: 2,
      evidenceFor: ["service.expediting"],
      readsAs:
        "Lateness is spread evenly across customers, variants and months, and 91% of late lines had been through machining on time. Nothing about the order book explains it; everything about the queue does.",
      reveals: [
        {
          id: "p-tg-late-cause",
          kind: "segments",
          title: "Late lines by where the time was lost",
          caption: "12,800 late order lines, FY26.",
          dimension: "Cause recorded",
          rows: [
            { label: "Waiting for heat treatment", value: 0.74, unit: "ratio" },
            { label: "Rework after final inspection", value: 0.09, unit: "ratio" },
            { label: "Material or forging shortage", value: 0.05, unit: "ratio" },
            { label: "Customer changed the schedule", value: 0.07, unit: "ratio" },
            { label: "Despatch and transport", value: 0.05, unit: "ratio" },
          ],
        },
        {
          id: "p-tg-late-note",
          kind: "note",
          title: "What the expediting cell would be doing",
          body:
            "Sales already expedites about 40 lines a month informally. Those lines improved by 9 days last year. Everything behind them in the queue got 6 days worse, and the plant paid ₹42 lakh in premium freight to move parts that were finished late rather than early.\n\n" +
            "A formal cell would do more of both.",
        },
      ],
    },
  ],

  causes: [
    { id: "flow", parentId: null, label: "How work moves through the plant", verdict: "The branch the monthly review has no column for, and the one holding the answer." },
    {
      id: "flow.bottleneck",
      parentId: "flow",
      label: "Heat treatment is the only constrained step, and a third of its hours are not treating anything",
      verdict:
        "This was it. The furnace is available 5,760 hours and treats for 3,917 — 1,010 hours of changeover across 168 batches, 448 idle for want of staged material, 385 of maintenance. Every other work centre has 16% to 33% of slack against the same order book. And because the cells are measured on their own utilisation, they keep releasing work into a queue that is already 19.4 days long, which is where on-time delivery went.",
    },
    {
      id: "flow.layout",
      parentId: "flow",
      label: "The material handling distance between cells is too long",
      verdict:
        "The floor is laid out by process rather than by flow and a trolley does travel about 400 metres more than it needs to. That is minutes against a lead time of 34 days. Fixing it is a good project for a year when the plant is not missing a fifth of its dispatches.",
    },
    { id: "capacity", parentId: null, label: "We do not have enough machines or hours", verdict: "Half true in exactly one place, and false everywhere the room is pointing." },
    {
      id: "capacity.machining",
      parentId: "capacity",
      label: "The machining cells cannot keep up with the order book",
      verdict:
        "No. Hobbing runs at 88% of its hours and machines 3.41 lakh gears against a plant that dispatches 3.06 lakh — it is already ahead of what can be treated, and 62% of its output is sitting in the furnace queue. The plant ran this experiment in FY24 with a third grinder: utilisation fell, work in progress rose 18%, and on-time delivery got worse.",
    },
    {
      id: "capacity.shifts",
      parentId: "capacity",
      label: "Two shifts are not enough — we need a third",
      verdict:
        "The one decoy that genuinely adds constraint hours, which is what makes it expensive rather than wrong. Manning limits it to about 10% more furnace hours for ₹1.43 crore a year of labour, and those hours run the same 68% pattern, so a third of them are lost to changeover and starvation too. It buys capacity at roughly four times the cost of the 1,010 hours the plant has already paid for and is throwing away.",
    },
    { id: "supply", parentId: null, label: "What comes in from outside", verdict: "Worse than last year and never the reason a gear was late." },
    {
      id: "supply.forgings",
      parentId: "supply",
      label: "The forging vendor's lead time has gone from 21 days to 34",
      verdict:
        "True, and it has cost the plant nothing yet: 26 days of forging stock is held and not one machine hour has been lost to a shortage. It is a risk to manage, not a cause of this year's numbers.",
    },
    { id: "service", parentId: null, label: "How we manage the promise to the customer", verdict: "A symptom being treated as a cause." },
    {
      id: "service.expediting",
      parentId: "service",
      label: "Nobody owns the order once it is in the plant, so nothing gets chased",
      verdict:
        "Chasing is already happening — about 40 lines a month informally. Those lines gained 9 days and everything behind them lost 6, because expediting reorders a queue rather than shortening it. A formal cell makes the plant better at choosing who is disappointed. Nor is there a pattern to find: lateness is spread evenly across customers, variants and months, and 91% of late lines cleared machining on time.",
    },
  ],
  trueCauseIds: ["flow.bottleneck"],

  interventions: [
    {
      id: "iv-furnace-changeover",
      label: "Quick changeover and campaigning on the furnace",
      pitch:
        "Pre-heat staging, a second load table, and a schedule that campaigns the case-depth recipes instead of taking batches in the order they turn up. 168 changes at six hours becomes 96 at two and a half, on the one machine where an hour lost is an hour the factory never gets back.",
      addresses: "flow.bottleneck",
      cost: { sprints: 2, rupees: 1.9 * CRORE },
      minSprints: 2,
      effects: {
        // 1,010 changeover hours to 240 — 96 campaigned changes at two and a
        // half hours each — which is 770 hours back, or 20% more treating time.
        whenRootCause: [{ driver: "furnaceRunShare", deltaPct: 0.2, rampQuarters: 2 }],
        otherwise: [{ driver: "furnaceRunShare", deltaPct: 0.06, rampQuarters: 2 }],
      },
      debrief:
        "The throughput half of the answer, and the cheapest capacity in the plant: 770 furnace hours a year that were already paid for, bought back for ₹1.9 crore of staging equipment once rather than ₹1.43 crore a year of shift labour for ever.",
    },
    {
      id: "iv-pull-release",
      label: "Release material at the furnace's pace",
      pitch:
        "Drum-buffer-rope: the furnace sets the beat, a two-day buffer protects it, and no cell may start a job the furnace cannot take. Stop measuring the cells on their own utilisation and measure them on whether the furnace was ever starved.",
      addresses: "flow.bottleneck",
      cost: { sprints: 2, rupees: 1.5 * CRORE },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "onTimeShareRaw", deltaPct: 0.19, rampQuarters: 2 },
          { driver: "wipDays", deltaPct: -0.45, rampQuarters: 2 },
          // The 448 idle hours were material that never arrived. Scheduling to
          // the constraint is what stages it.
          { driver: "furnaceRunShare", deltaPct: 0.04, rampQuarters: 2 },
        ],
        otherwise: [
          { driver: "onTimeShareRaw", deltaPct: 0.05, rampQuarters: 2 },
          { driver: "wipDays", deltaPct: -0.15, rampQuarters: 2 },
        ],
      },
      debrief:
        "The service half, and the one that surprises people: on-time delivery is a property of the queue, not of effort. Cutting the work in front of the furnace from 19.4 days to about 10 is what makes a promise date something the plant can keep, and it costs a scheduling rule rather than a machine.",
    },
    {
      id: "iv-second-hobber",
      label: "Buy a second CNC hobber",
      pitch:
        "The works manager's proposal. Hobbing runs at 88%, the cell is the busiest on the floor, and ₹3.2 crore buys 41,000 more machined gears a year.",
      addresses: "capacity.machining",
      cost: { sprints: 2, rupees: 3.2 * CRORE },
      effects: {
        // If machining really had been the constraint, the furnace would have
        // been starving for want of parts and this would have fixed that.
        whenRootCause: [
          { driver: "furnaceRunShare", deltaPct: 0.18, rampQuarters: 2 },
          { driver: "fixedPlantCost", deltaPct: 0.05 },
        ],
        otherwise: [
          { driver: "fixedPlantCost", deltaPct: 0.06 },
          { driver: "overtimeCost", deltaPct: -0.15 },
          // More parts, made faster, into a queue that is already the problem.
          { driver: "wipDays", deltaPct: 0.1, rampQuarters: 2 },
        ],
      },
      debrief:
        "Capacity bought at a step that already had 17% of slack. It produces more machined gears, all of which join the 19-day queue at the furnace, and it adds ₹56 lakh a year of depreciation and upkeep to the fixed cost. The plant already ran this experiment on grinding in FY24 and on-time delivery got worse.",
    },
    {
      id: "iv-third-shift",
      label: "Run a third shift",
      pitch:
        "The production head's proposal. If the furnace is short of hours, buy more hours: a third shift across the plant, at ₹1.43 crore a year of labour and allowances.",
      addresses: "capacity.shifts",
      cost: { sprints: 1, rupees: 1.6 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "furnaceHours", deltaPct: 0.18, rampQuarters: 2 },
          { driver: "overtimeCost", deltaPct: 0.9 },
        ],
        otherwise: [
          { driver: "furnaceHours", deltaPct: 0.1, rampQuarters: 2 },
          { driver: "overtimeCost", deltaPct: 1.3 },
        ],
      },
      debrief:
        "Not wrong, and not the answer. It genuinely adds constraint hours — the only decoy here that does — but manning limits it to about 10%, the new hours lose the same third to changeover and starvation, and the labour bill is permanent. Buy the 770 hours you are already throwing away before you buy hours at ₹1.43 crore a year.",
    },
    {
      id: "iv-expedite-cell",
      label: "Stand up a customer-service and expediting cell",
      pitch:
        "The sales director's proposal. Four people who own the top 200 order lines end to end, with a budget for premium freight when a line is going to miss.",
      addresses: "service.expediting",
      cost: { sprints: 1, rupees: 0.7 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "onTimeShareRaw", deltaPct: 0.14, rampQuarters: 2 },
          { driver: "overtimeCost", deltaPct: 0.35 },
        ],
        otherwise: [
          { driver: "onTimeShareRaw", deltaPct: 0.1, rampQuarters: 2 },
          { driver: "overtimeCost", deltaPct: 0.65 },
        ],
      },
      debrief:
        "It moves the headline number a little and it moves the queue not at all. Expediting reorders a queue: the plant's own data has expedited lines gaining 9 days while everything behind them lost 6. What it reliably buys is premium freight — and a cell whose job is to decide which customer is disappointed this week.",
    },
  ],

  /**
   * Standing still is not free. The order book keeps fragmenting into more
   * variants, which means more furnace changeovers; the queue keeps growing,
   * which means the promise keeps slipping; and the OEMs keep asking for their
   * annual price reduction.
   */
  drift: [
    { driver: "furnaceRunShare", deltaPct: -0.02 },
    { driver: "onTimeShareRaw", deltaPct: -0.015 },
    { driver: "contributionPerUnit", deltaPct: -0.008 },
    { driver: "wipDays", deltaPct: 0.02 },
    // The order book is deliberately NOT drifted. It is the ceiling the plant
    // is measured against, and a ceiling that rises on its own would quietly
    // make over-funding capacity free again.
  ],
  horizonQuarters: 4,
  periodNoun: "quarter",

  parInvestigation: ["dd-constraint-map", "dd-furnace-log"],
  bestAllocation: [
    { interventionId: "iv-furnace-changeover", sprints: 2, rupees: 1.9 * CRORE },
    { interventionId: "iv-pull-release", sprints: 2, rupees: 1.5 * CRORE },
  ],

  debrief: {
    causalChain: [
      "Every work centre in the plant is measured on its own utilisation, and every one of them reports a good number.",
      "Only one of them is short of capacity against the order book: heat treatment, at a load factor of 1.24 while nothing else exceeds 0.84.",
      "The furnace is available 5,760 hours and treats parts for 3,917 of them — 1,010 hours of changeover across 168 batches, 448 hours idle for want of staged material, 385 of maintenance.",
      "So the plant's output is 3.06 lakh gears against a 3.80 lakh order book, and that ceiling is set by one machine.",
      "Meanwhile the cells, chasing their own utilisation, keep releasing work into the queue in front of that machine: 29,600 gears, 19.4 days deep.",
      "Little's law then fixes the lead time at 34 days whatever anybody promises, which is where on-time delivery went — 74% by the fourth quarter.",
      "Expediting cannot touch it, because moving one order up the queue moves every other order down: expedited lines gained 9 days last year and everything else lost 6.",
    ],
    whereTheLeverageWas:
      "Both halves of the answer are on the constraint, and neither is a machine. Quick changeover buys back about 770 furnace hours a year the plant has already paid for. Releasing material at the furnace's pace collapses the queue that sets the lead time — which is the only thing that moves on-time delivery. The second hobber would have bought parts for a queue, and the third shift would have bought hours at four times the price of the ones being thrown away.",
    strongAnswer: [
      "A plant's output is its constraint's output, so the first question is which step is actually constrained.",
      "Not which is busiest — busy is a measurement of the step, and I need a measurement against the order book.",
      "Load factor answers it: heat treatment needs 4,872 hours and has 3,917 of treating time, a load of 1.24. Nothing else is above 0.84.",
      "So there is exactly one constraint, and every hour it loses is an hour the whole factory loses.",
      "It loses 1,843 of them: 1,010 to changeovers across 168 batches, 448 idle waiting for material, 385 to maintenance.",
      "The 448 idle hours are the tell. The cells are measured on their own utilisation, so they make what suits their setup rather than what the furnace needs next.",
      "That same incentive is what builds the queue — 29,600 gears, 19.4 days deep in front of the furnace.",
      "And the queue, not effort, is what sets delivery. Little's law: 29,600 gears at 1,270 a day is 23 working days, which is the 34-day lead time the customers are seeing.",
      "So I would do two things, both on the constraint. Campaign the recipes and cut the changeover from six hours to two and a half — 770 hours back, capacity nobody has to buy.",
      "And release material at the furnace's pace with a small buffer, so the queue drains and a promise date means something.",
      "I would not buy the hobber. Hobbing already machines 3.41 lakh gears against 3.06 lakh dispatched — more of them would just be queue, and the FY24 grinder proved it.",
      "And I would hold the third shift. It is the only proposal that genuinely adds constraint hours, but manning caps it at 10%, those hours lose the same third to changeover, and the labour cost is permanent.",
      "Fix the hours you own before you buy new ones.",
    ],
  },

  coachFallback: [
    {
      topic: ["constraint", "bottleneck", "furnace", "heat treatment", "limiting", "theory of constraints"],
      answer: [
        "Heat treatment is the constraint: it needs 4,872 hours to cover the order book and treats for 3,917.",
        "Load factor 1.24, against 0.84 or less everywhere else in the plant.",
        "That single machine sets the plant's output at 3.06 lakh gears against a 3.80 lakh book.",
      ],
    },
    {
      topic: ["utilisation", "oee", "92%", "busy", "efficiency", "local"],
      answer: [
        "OEE and utilisation are per-machine numbers, and averaging them across a plant hides the only one that matters.",
        "Heat treatment shows the lowest utilisation on the board — 68% — because a third of its hours go to changeover and starvation.",
        "Measuring every cell on utilisation is also what causes the problem: a cell keeps itself busy by making parts the furnace cannot take.",
      ],
    },
    {
      topic: ["changeover", "setup", "smed", "batch", "campaign", "1010"],
      answer: [
        "168 batches at about six hours of changeover and ramp each is 1,010 furnace hours — 79,000 gears the plant never made.",
        "Two thirds of those changes are between case-depth recipes that could be campaigned into runs of the same specification.",
        "Staging equipment at ₹1.7 crore takes the changeover to two and a half hours, and campaigning cuts how many of them there are — 770 hours of capacity nobody has to buy.",
      ],
    },
    {
      topic: ["queue", "wip", "lead time", "little's law", "34 days", "waiting"],
      answer: [
        "3.1 of the 34 days are a machine touching the gear. 19.4 are the queue in front of the furnace.",
        "Little's law: 29,600 gears on the floor at 1,270 finished a day is 23 working days of lead time.",
        "Shorten the queue and the lead time falls with it — that is the only lever on-time delivery actually responds to.",
      ],
    },
    {
      topic: ["hobber", "cnc", "buy a machine", "capex", "machining", "second machine"],
      answer: [
        "Hobbing machines 3.41 lakh gears a year against 3.06 lakh dispatched, and 62% of its output is already waiting at the furnace.",
        "A second machine adds parts to a 19-day queue and ₹56 lakh a year to the fixed cost.",
        "The plant ran the experiment in FY24 with a third grinder: WIP rose 18% and on-time delivery fell from 86% to 84%.",
      ],
    },
    {
      topic: ["third shift", "shift", "more hours", "overtime", "manning"],
      answer: [
        "It is the only proposal that genuinely adds constraint hours, which is why it is worth taking seriously.",
        "But qualified heat-treatment operators cap it at about 10% more hours — 392 of them treating — for ₹1.43 crore a year of labour.",
        "And those hours run the same 68% pattern, so a third of them are lost to changeover and starvation as well.",
      ],
    },
    {
      topic: ["expedite", "chase", "service cell", "customer service", "otif", "on time"],
      answer: [
        "Expediting reorders a queue rather than shortening one.",
        "Last year's expedited lines gained 9 days and everything behind them lost 6.",
        "What it reliably buys is premium freight and a weekly decision about which customer to disappoint.",
      ],
    },
    {
      topic: ["drum buffer rope", "pull", "release", "conwip", "scheduling", "kanban"],
      answer: [
        "The furnace sets the beat, a two-day buffer protects it, and no cell starts a job the furnace cannot take.",
        "That stops the queue growing, which is what fixes the lead time and therefore the promise date.",
        "It also recovers the 448 idle furnace hours, because staging becomes the cells' job rather than an accident.",
      ],
    },
    {
      topic: ["forging", "vendor", "supplier", "material shortage", "lead time from supplier"],
      answer: [
        "The forging vendor did go from 21 days to 34, and it has cost the plant nothing so far.",
        "26 days of forging stock is held and no machine hour has been lost to a shortage.",
        "It is a risk worth managing and not a cause of this year's delivery numbers.",
      ],
    },
    {
      topic: ["demand", "order book", "ceiling", "sell more", "market"],
      answer: [
        "The order book is 3.80 lakh gears and the plant makes 3.06 lakh, so throughput is worth having up to that ceiling.",
        "Past it, extra furnace hours earn nothing — which is what happens if every lever on the board is funded at once.",
        "Capacity is only worth what the market will take.",
      ],
    },
  ],
};
