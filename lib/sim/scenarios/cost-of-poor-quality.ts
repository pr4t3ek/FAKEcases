/**
 * "We doubled the inspectors and the rejects went up."
 *
 * The second operations war room, and deliberately the opposite exercise to the
 * first. Trishul Gears is about where output is decided; this one is about
 * where cost is decided — and both turn on the same habit of mind, which is
 * that the number a factory reports is measured at the wrong place.
 *
 * The lesson: **inspection does not create quality, it only finds the absence
 * of it — and it finds it after every rupee of value has already been added.**
 * A defect prevented at the machine costs a fraction of one caught at final
 * audit, which costs a fraction of one the customer finds.
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * 78% of the defects are made at two places: six knitting machines running on
 * worn needle beds, and one sleeve-attach station on line 4. Nothing checks at
 * either. The only inspection in the plant is the final audit, by which point
 * the piece carries its full ₹296 of yarn, knitting, cutting, stitching,
 * washing and packing — so every defect is discovered at the most expensive
 * moment it is possible to discover it.
 *
 * The quality department costs ₹2.9 crore. Poor quality costs ₹12.91 crore:
 * ₹4.02 crore of pieces downgraded to seconds, ₹1.22 crore of rework, ₹1.66
 * crore of air freight to hold the shipping window after the rework, ₹3.11
 * crore of customer claims, and the ₹2.9 crore of inspection itself. Nobody has
 * ever added those five numbers up, because they are booked in five different
 * cost centres.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * `iv-full-audit` is the trap and it has to stay *nearly* right: it
 * genuinely cuts customer claims — a 100% audit does catch more escapes — and
 * still loses, because it costs more to run than the escapes are worth and
 * pushes more pieces into the rework loop that causes the air freight. That is
 * the appraisal-versus-prevention trade in one lever, and if a retune makes it
 * win, the scenario starts teaching "hire more inspectors".
 *
 * `iv-tighten-aql` is the subtler decoy: it improves every quality metric on
 * the board while destroying value, because a piece downgraded is a piece sold
 * at ₹172 instead of ₹430. A candidate measured on defect escape rate would
 * take it.
 *
 * The two correct levers compose because they move different things: source
 * inspection stops the defect leaving the station, and the knitting overhaul
 * stops it being made. `tests/sim-scenario.test.ts` pins the cost-of-quality
 * arithmetic and the inspection trap; `checkBalance` is what will tell you if a
 * retune lets a decoy win.
 */

import type { SimScenario } from "../types";

const CRORE = 10_000_000;

export const costOfPoorQuality: SimScenario = {
  slug: "cost-of-poor-quality",
  title: "Sunidhi Knits: the inspection team doubled and so did the rejects",
  company: "Sunidhi Knits",
  premise:
    "A knitwear exporter doubled its final-inspection team, and rejects, air freight and customer claims all went up. Work out what inspection was ever going to change.",
  situation:
    "You are the operations manager at Sunidhi Knits, a Tirupur knitwear exporter shipping 36 lakh pieces a year to four European retailers. " +
    "Final inspection rejects 11.4% of what the plant makes. The quality head doubled the audit team last year to catch more of it; rejects found rose, customer claims fell a little, and ₹1.66 crore went out in air freight holding shipping windows after rework. " +
    "The managing director thinks the tailors have got worse since the labour shortage. The quality head wants a 100% audit and a tighter acceptance standard. The merchandiser thinks the buyers keep tightening the specification. " +
    "You have 6 analyst-days to find out where the defects are actually made, then 4 people-weeks and ₹4 crore to act on it.",
  difficulty: "Medium",

  mentor: {
    persona: "a factory director debriefing a graduate operations manager",
    audience: "manager",
  },

  teaching: {
    /**
     * Shown, unlike the constraint scenario. The shape of this model *is* the
     * teaching — a defect turns into four different costs in four different
     * places — and none of it says where the defects are made, which is the
     * thing the candidate has to go and find.
     */
    showMetricMap: true,
    primer: {
      intro:
        "Quality costs money in four different ways, and only one of them appears in the quality department's budget. The whole exercise is learning to add the other three up, and then to notice that they are all consequences of when a defect is found rather than of how hard anybody looked.",
      terms: [
        {
          term: "Defect rate",
          plain: "The share of pieces made that fail the standard — here, measured at final inspection because that is the only place anybody measures.",
          formula: "defective pieces ÷ pieces made",
          matters:
            "Where it is measured decides what it can tell you. A rate measured only at the end says how many defects exist and nothing about where they came from.",
          driver: "defectRate",
        },
        {
          term: "Cost of poor quality",
          full: "COPQ",
          plain: "Everything the business spends because things are not right first time — rework, downgrades, freight to recover a slipped date, customer claims, and the cost of looking.",
          formula: "prevention + appraisal + internal failure + external failure",
          matters:
            "It is booked across five cost centres and reported in none, so almost every factory believes its quality cost is the quality department's budget. Here that is ₹2.9 crore of a ₹12.91 crore number.",
          driver: "costOfPoorQuality",
        },
        {
          term: "Prevention",
          plain: "Money spent so the defect never happens — maintaining the machine, training the operator, checking the first piece off a run.",
          matters:
            "The cheapest of the four and the only one that reduces the other three. It is also the first budget cut, because it is the only one whose benefit does not show up as an event.",
        },
        {
          term: "Appraisal",
          plain: "Money spent looking for defects — inspectors, audits, test rigs.",
          matters:
            "It changes who finds the defect and when, never whether it was made. Doubling it doubles a cost and moves a number that was never the problem.",
          driver: "inspectionCost",
        },
        {
          term: "Internal failure",
          plain: "What a defect costs when you find it yourself — rework labour, the piece sold as a second, the freight to make up the lost days.",
          matters:
            "It is proportional to how much value the piece already carries, which is why finding a defect at the last station costs many times what finding it at the first would.",
          driver: "reworkCost",
        },
        {
          term: "External failure",
          plain: "What a defect costs when the customer finds it — claims, credit notes, the next order that does not come.",
          matters:
            "The most expensive box by a distance, and the one nobody can see from inside the factory. ₹3.11 crore of claims here against ₹1.22 crore of rework.",
          driver: "claimCost",
        },
        {
          term: "The 1-10-100 rule",
          plain: "A rough industry rule: a defect costs ₹1 to prevent at the station, ₹10 to catch at final inspection, ₹100 once it reaches the customer.",
          matters:
            "It is the reason the question 'where is this defect made?' is worth more than the question 'how do we catch more of them?'.",
        },
        {
          term: "AQL",
          full: "Acceptable quality level",
          plain: "The sampling standard a buyer and a supplier agree on — how many defects in a sample before the lot is rejected.",
          matters:
            "It decides what happens to a piece once it exists. Tightening it improves every quality metric on the board by downgrading more pieces, which is a decision about revenue dressed as a decision about quality.",
        },
        {
          term: "Rework",
          plain: "Putting a defective piece back through a station to make it sellable — re-linking a sleeve, re-washing a stain.",
          formula: "reworkable defects × cost per piece",
          matters:
            "It recovers most of the value and it consumes capacity and days, which is what turns a quality problem into a delivery problem and then into an air-freight bill.",
          driver: "reworkedPieces",
        },
        {
          term: "Escape rate",
          plain: "The share of shipped pieces that turn out to be defective after all — the ones inspection missed.",
          formula: "claims ÷ pieces shipped",
          matters:
            "Sampling inspection always has one, because sampling is a statement about a lot and not about a piece. It is the number that proves inspection cannot be the answer on its own.",
          driver: "claimRate",
        },
      ],
      worked: [
        "36 lakh pieces are cut, and each one carries ₹296 of yarn, knitting, cutting, stitching, washing and packing by the time it reaches final inspection.",
        "11.4% of them — 4.10 lakh pieces — fail there.",
        "62% of those are reworked at ₹48 a piece and sold as first quality; the other 1.56 lakh are sold as seconds at ₹172 against a list price of ₹430.",
        "That downgrade alone is ₹4.02 crore, before the ₹1.22 crore of rework, the ₹1.66 crore of air freight and the ₹3.11 crore of customer claims.",
        "The whole quality department costs ₹2.9 crore. The question is which of those five numbers it was ever able to move.",
      ],
    },
  },

  northStar: "netContribution",
  reported: [
    "defectRate",
    "firstQualityPieces",
    "claimCost",
    "costOfPoorQuality",
    "reworkCost",
    "netContribution",
  ],

  drivers: [
    // ── What the plant makes, and what fails. ──────────────────────────────
    { id: "piecesCut", kind: "input", label: "Pieces cut a year", unit: "count", goodDirection: "up", baseline: 3_600_000 },
    { id: "defectRate", kind: "input", label: "Defect rate at final inspection", unit: "ratio", goodDirection: "down", baseline: 0.114 },
    { id: "defectivePieces", kind: "product", label: "Defective pieces", unit: "count", goodDirection: "down", of: ["piecesCut", "defectRate"] },
    { id: "goodPieces", kind: "difference", label: "Pieces right first time", unit: "count", goodDirection: "up", minuend: "piecesCut", subtrahend: "defectivePieces" },

    // ── What happens to a defect once it has been made. ────────────────────
    { id: "reworkShare", kind: "input", label: "Share of defects that can be reworked", unit: "ratio", goodDirection: "up", baseline: 0.62 },
    { id: "reworkedPieces", kind: "product", label: "Pieces reworked", unit: "count", goodDirection: "down", of: ["defectivePieces", "reworkShare"] },
    { id: "secondsPieces", kind: "difference", label: "Pieces downgraded to seconds", unit: "count", goodDirection: "down", minuend: "defectivePieces", subtrahend: "reworkedPieces" },
    { id: "firstQualityPieces", kind: "sum", label: "Pieces shipped as first quality", unit: "count", goodDirection: "up", of: ["goodPieces", "reworkedPieces"] },

    // ── Revenue. A downgrade is a price decision the factory made by accident.
    { id: "price", kind: "input", label: "FOB price per piece", unit: "inr", goodDirection: "up", baseline: 430 },
    { id: "secondsPrice", kind: "input", label: "Seconds price per piece", unit: "inr", goodDirection: "up", baseline: 172 },
    { id: "firstQualityRevenue", kind: "product", label: "Revenue — first quality", unit: "inr", goodDirection: "up", of: ["firstQualityPieces", "price"] },
    { id: "secondsRevenue", kind: "product", label: "Revenue — seconds", unit: "inr", goodDirection: "up", of: ["secondsPieces", "secondsPrice"] },
    { id: "revenue", kind: "sum", label: "Revenue", unit: "inr", goodDirection: "up", of: ["firstQualityRevenue", "secondsRevenue"] },
    /**
     * The largest of the four failure costs and the one that is invisible,
     * because it is never spent — it is a price that was not received. Derived
     * from the gap so it cannot drift away from the two prices above.
     */
    { id: "priceGap", kind: "difference", label: "Value lost on a downgraded piece", unit: "inr", goodDirection: "down", minuend: "price", subtrahend: "secondsPrice" },
    { id: "downgradeLoss", kind: "product", label: "Value lost to downgrades", unit: "inr", goodDirection: "down", of: ["secondsPieces", "priceGap"] },

    // ── Cost. Note that every piece cut carries the full conversion cost,
    //    whatever happens to it afterwards. That is the whole scenario. ─────
    { id: "variableCostPerPiece", kind: "input", label: "Yarn, knitting, cutting, stitching and packing per piece", unit: "inr", goodDirection: "down", baseline: 296 },
    { id: "variableCost", kind: "product", label: "Variable cost", unit: "inr", goodDirection: "down", of: ["piecesCut", "variableCostPerPiece"] },
    { id: "reworkCostPerPiece", kind: "input", label: "Rework cost per piece", unit: "inr", goodDirection: "down", baseline: 48 },
    { id: "reworkCost", kind: "product", label: "Rework cost", unit: "inr", goodDirection: "down", of: ["reworkedPieces", "reworkCostPerPiece"] },

    { id: "airFreightShare", kind: "input", label: "Share of defects that force an air shipment", unit: "ratio", goodDirection: "down", baseline: 0.42 },
    { id: "airFreightPieces", kind: "product", label: "Pieces air-freighted", unit: "count", goodDirection: "down", of: ["defectivePieces", "airFreightShare"] },
    { id: "airFreightCostPerPiece", kind: "input", label: "Air freight premium per piece", unit: "inr", goodDirection: "down", baseline: 96 },
    { id: "airFreightCost", kind: "product", label: "Air freight premium", unit: "inr", goodDirection: "down", of: ["airFreightPieces", "airFreightCostPerPiece"] },

    { id: "claimRate", kind: "input", label: "Escape rate — claims per piece shipped", unit: "ratio", goodDirection: "down", baseline: 0.021 },
    { id: "claimedPieces", kind: "product", label: "Pieces claimed by customers", unit: "count", goodDirection: "down", of: ["firstQualityPieces", "claimRate"] },
    { id: "claimCostPerPiece", kind: "input", label: "Credit note per claimed piece", unit: "inr", goodDirection: "down", baseline: 430 },
    { id: "claimCost", kind: "product", label: "Customer claims", unit: "inr", goodDirection: "down", of: ["claimedPieces", "claimCostPerPiece"] },

    { id: "inspectionCost", kind: "input", label: "Inspection and quality department", unit: "inr", goodDirection: "down", baseline: 2.9 * CRORE },
    { id: "fixedCost", kind: "input", label: "Factory fixed cost", unit: "inr", goodDirection: "down", baseline: 18 * CRORE },

    /**
     * The number the whole scenario exists to put on one line. Reported rather
     * than subtracted — `downgradeLoss` is revenue that never arrived and is
     * already absent from `revenue`, so adding it into the P&L would count it
     * twice. It is here because a candidate has to see the four boxes in one
     * place before the appraisal-versus-prevention trade means anything.
     */
    { id: "costOfPoorQuality", kind: "sum", label: "Cost of poor quality", unit: "inr", goodDirection: "down", of: ["downgradeLoss", "reworkCost", "airFreightCost", "claimCost", "inspectionCost"] },

    { id: "totalCost", kind: "sum", label: "Cost", unit: "inr", goodDirection: "down", of: ["variableCost", "reworkCost", "airFreightCost", "claimCost", "inspectionCost", "fixedCost"] },
    { id: "netContribution", kind: "difference", label: "Net contribution", unit: "inr", goodDirection: "up", minuend: "revenue", subtrahend: "totalCost" },
  ],

  dashboard: [
    {
      id: "p-cq-scorecard",
      kind: "stat",
      title: "The quality report the board sees",
      caption: "FY26, from the final-inspection log.",
      tiles: [
        { label: "Defect rate at final inspection", value: 0.114, unit: "ratio", deltaPct: 0.09, goodDirection: "down" },
        { label: "Inspectors on the audit floor", value: 34, unit: "count", deltaPct: 0.94, goodDirection: "down" },
        { label: "Escape rate — claims per piece shipped", value: 0.021, unit: "ratio", deltaPct: -0.12, goodDirection: "down" },
        { label: "Pieces cut", value: 3_600_000, unit: "count", deltaPct: 0.03, goodDirection: "up" },
        { label: "Shipped as first quality", value: 3_444_048, unit: "count", goodDirection: "up" },
        { label: "Downgraded to seconds", value: 155_952, unit: "count", deltaPct: 0.14, goodDirection: "down" },
      ],
    },
    {
      id: "p-cq-costs",
      kind: "stat",
      title: "What quality cost last year",
      caption: "As booked, in five different cost centres.",
      tiles: [
        { label: "Inspection and quality department", value: 2.9 * CRORE, unit: "inr", deltaPct: 0.86, goodDirection: "down" },
        { label: "Rework labour", value: 1.22 * CRORE, unit: "inr", deltaPct: 0.11, goodDirection: "down" },
        { label: "Air freight premium", value: 1.66 * CRORE, unit: "inr", deltaPct: 0.31, goodDirection: "down" },
        { label: "Customer claims and credit notes", value: 3.11 * CRORE, unit: "inr", deltaPct: -0.06, goodDirection: "down" },
      ],
    },
    {
      id: "p-cq-trend",
      kind: "timeseries",
      title: "Inspection headcount against the defect rate",
      caption: "The audit team went from 18 to 34 in Q2. The rate did not notice.",
      series: [
        {
          label: "Inspectors",
          unit: "count",
          points: [
            { period: "Q1", value: 18 },
            { period: "Q2", value: 31 },
            { period: "Q3", value: 34 },
            { period: "Q4", value: 34 },
          ],
        },
        {
          label: "Defect rate at final inspection",
          unit: "ratio",
          points: [
            { period: "Q1", value: 0.106 },
            { period: "Q2", value: 0.112 },
            { period: "Q3", value: 0.115 },
            { period: "Q4", value: 0.119 },
          ],
        },
      ],
    },
    {
      /**
       * A decoy that does real work: it is the only defect breakdown anybody in
       * the plant has, and it is cut by *symptom* rather than by origin. A
       * candidate who takes it at face value spends the budget on the sewing
       * floor, which is where the defects are found and not where they are made.
       */
      id: "p-cq-defect-types",
      kind: "segments",
      title: "Defects by type, as recorded at final inspection",
      caption: "Share of the 4.10 lakh rejected pieces.",
      dimension: "Defect",
      rows: [
        { label: "Fabric fault — needle line, holes, barré", value: 0.41, unit: "ratio" },
        { label: "Stitching — puckering, broken seam, sleeve attach", value: 0.37, unit: "ratio" },
        { label: "Measurement out of tolerance", value: 0.11, unit: "ratio" },
        { label: "Stain, oil mark or wash fault", value: 0.08, unit: "ratio" },
        { label: "Trim, label or packing", value: 0.03, unit: "ratio" },
      ],
    },
    {
      id: "p-cq-customers",
      kind: "segments",
      title: "Claims by customer",
      caption: "Claim value as a share of that buyer's shipped value.",
      dimension: "Buyer",
      rows: [
        { label: "Buyer A — UK fast fashion", value: 0.024, unit: "ratio", deltaPct: -0.04 },
        { label: "Buyer B — German mail order", value: 0.019, unit: "ratio", deltaPct: -0.09 },
        { label: "Buyer C — Nordic basics", value: 0.022, unit: "ratio", deltaPct: 0.02 },
        { label: "Buyer D — French department store", value: 0.018, unit: "ratio", deltaPct: -0.11 },
      ],
    },
    {
      id: "p-cq-labour",
      kind: "stat",
      title: "The sewing floor",
      caption: "What the managing director thinks has changed.",
      tiles: [
        { label: "Tailors on the floor", value: 1_410, unit: "count", deltaPct: -0.03, goodDirection: "up" },
        { label: "Annual attrition", value: 0.34, unit: "ratio", deltaPct: 0.06, goodDirection: "down" },
        { label: "Average experience, months", value: 27, unit: "count", deltaPct: -0.07, goodDirection: "up" },
        { label: "Pieces per tailor per shift", value: 61, unit: "count", deltaPct: 0.04, goodDirection: "up" },
      ],
    },
    {
      id: "p-cq-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "Quality head: we found more defects the moment we put more people on the audit floor, which proves we were missing them before. Give me a 100% audit and a tighter AQL and the claims stop.\n" +
        "Managing director: attrition is 34% and the average tailor has 27 months of experience against 41 three years ago. The work has got worse because the people are newer.\n" +
        "Merchandiser: Buyer A moved to a 2.5 AQL last season and everyone else will follow. The specification is tightening under us.\n" +
        "Nobody has traced a rejected piece back to the station that made it.",
    },
  ],

  budget: { analystDays: 6, sprints: 4, rupees: 4 * CRORE },

  drilldowns: [
    {
      id: "dd-defect-origin",
      label: "Trace a month of rejects back to the station that made them",
      question: "Where are the defects actually made, as opposed to found?",
      cost: 2,
      evidenceFor: ["origin.upstream", "people.skill"],
      readsAs:
        "78% of the rejects come from two places: six knitting machines on worn needle beds, and the sleeve-attach station on line 4. Neither is inspected. The sewing floor as a whole is not the problem — one station on it is.",
      reveals: [
        {
          id: "p-cq-origin",
          kind: "segments",
          title: "34,100 rejects traced to origin, March",
          caption: "Share of rejects by the station that created the defect.",
          dimension: "Where it was made",
          rows: [
            { label: "Knitting — six machines with worn needle beds", value: 0.44, unit: "ratio" },
            { label: "Sleeve attach — line 4, two shifts", value: 0.34, unit: "ratio" },
            { label: "Cutting — spread and marker", value: 0.08, unit: "ratio" },
            { label: "Washing and finishing", value: 0.09, unit: "ratio" },
            { label: "Packing and trims", value: 0.05, unit: "ratio" },
          ],
        },
        {
          id: "p-cq-origin-note",
          kind: "note",
          title: "What the two stations have in common",
          body:
            "Nothing checks either of them. The knitting floor has no first-piece check and no needle-change schedule — beds are replaced when an operator notices a line in the fabric, which is on average 9 days after it starts. The sleeve-attach station on line 4 was re-laid out in April and the operators there have the same experience profile as every other line.\n\n" +
            "Both defects are visible at the station with no instrument: a needle line shows in the fabric as it comes off the machine, and a puckered sleeve is obvious at the next operation. Both are currently discovered after washing, packing and boxing.",
        },
      ],
    },
    {
      id: "dd-quality-cost",
      label: "Add up what poor quality costs across the plant",
      question: "How much does this cost in total, and where is it booked?",
      cost: 2,
      evidenceFor: ["origin.upstream", "inspection.coverage"],
      readsAs:
        "₹12.91 crore, of which the quality department is ₹2.9 crore. The largest single line is the ₹4.02 crore of value given away on downgraded pieces, and the second is ₹3.11 crore of customer claims. Neither is anywhere in a quality report.",
      reveals: [
        {
          id: "p-cq-copq",
          kind: "segments",
          title: "The cost of poor quality, FY26",
          caption: "₹ crore, by the four standard boxes.",
          dimension: "Cost",
          rows: [
            { label: "Prevention — maintenance, training, first-piece checks", value: 0.3, unit: "inr_crore" },
            { label: "Appraisal — inspection and the quality department", value: 2.9, unit: "inr_crore" },
            { label: "Internal failure — downgrades, rework, air freight", value: 6.9, unit: "inr_crore" },
            { label: "External failure — customer claims and credit notes", value: 3.11, unit: "inr_crore" },
          ],
        },
        {
          id: "p-cq-copq-note",
          kind: "note",
          title: "Where each of those is booked",
          body:
            "Inspection sits in the quality department's budget. Rework labour is inside the sewing floor's conversion cost. Air freight is in logistics, against the shipment rather than against the defect that caused it. Downgrades never appear as a cost at all — they are simply a lower price on a sales invoice. Claims are a credit note in the finance ledger.\n\n" +
            "So five people each look at one box, and the only person who sees a total is whoever adds them up. Against a net contribution of ₹17.33 crore, the total is ₹12.91 crore.",
        },
      ],
    },
    {
      id: "dd-inspection-effect",
      label: "What the doubled audit team changed",
      question: "Did adding inspectors reduce anything?",
      cost: 2,
      evidenceFor: ["inspection.coverage"],
      readsAs:
        "The team went from 18 to 34 and found 1.4 points more of the same defects. The defect rate rose over the same period, claims fell 0.3 points, and rework and air freight both went up because more pieces entered the loop. It moved the finding, not the making.",
      reveals: [
        {
          id: "p-cq-inspection",
          kind: "segments",
          title: "Before and after the audit team doubled",
          caption: "Q1 against Q4, indexed to Q1.",
          dimension: "Measure",
          rows: [
            { label: "Inspectors", value: 1.89, unit: "multiple" },
            { label: "Defects found per 100 pieces", value: 1.12, unit: "multiple" },
            { label: "Escape rate — claims per piece shipped", value: 0.87, unit: "multiple" },
            { label: "Rework hours", value: 1.19, unit: "multiple" },
            { label: "Air freight premium", value: 1.31, unit: "multiple" },
          ],
        },
        {
          id: "p-cq-inspection-note",
          kind: "note",
          title: "The arithmetic of a 100% audit",
          body:
            "A full audit costs about ₹1.3 crore a year on top of the current team. The quality head's estimate of what it catches is right: escapes fall by roughly a third, worth ₹1.09 crore of claims.\n\n" +
            "What the estimate leaves out is that every extra piece caught is a piece entering the rework loop, and the rework loop is what causes the air freight. The last doubling raised air freight 31%.",
        },
      ],
    },
    {
      id: "dd-rework-journey",
      label: "Follow a rejected piece through the plant",
      question: "What does a defect actually cost once it is found at the end?",
      cost: 2,
      evidenceFor: ["origin.upstream"],
      readsAs:
        "By final inspection a piece carries ₹296 of value. Rework costs ₹48 and eleven days, which is what turns a sea shipment into an air shipment. The same defect stopped at the knitting machine costs about ₹7 and no days at all.",
      reveals: [
        {
          id: "p-cq-journey",
          kind: "segments",
          title: "What it costs to deal with one defect, by where it is caught",
          caption: "Rupees per piece, including the value already added.",
          dimension: "Caught at",
          rows: [
            { label: "The station that made it", value: 7, unit: "inr" },
            { label: "The next operation", value: 34, unit: "inr" },
            { label: "Final inspection — reworked", value: 122, unit: "inr" },
            { label: "Final inspection — downgraded", value: 258, unit: "inr" },
            { label: "The customer", value: 430, unit: "inr" },
          ],
        },
        {
          id: "p-cq-journey-note",
          kind: "note",
          title: "The eleven days",
          body:
            "A rejected lot waits for the rework line, is re-linked or re-washed, re-pressed, re-packed and re-audited. The average is eleven working days, against a shipping window that is built with four days of slack.\n\n" +
            "42% of rejected pieces therefore ship by air at a ₹96 premium. Logistics reports that number as a freight overrun and nobody in the quality meeting has ever seen it.",
        },
      ],
    },
    {
      id: "dd-operator-data",
      label: "Defects by tailor, line and shift",
      question: "Is this a skill problem, or a pay problem?",
      cost: 2,
      evidenceFor: ["people.skill", "people.incentive"],
      readsAs:
        "Defect rate by operator experience is flat after the first eight weeks, and the new joiners' lines are no worse than the veterans'. Line 4 is 2.6× every other line on one operation, on both shifts, with the same experience mix. It is the station, not the people standing at it.",
      reveals: [
        {
          id: "p-cq-operators",
          kind: "segments",
          title: "Defect rate by line",
          caption: "Sewing defects per 100 pieces, FY26 average.",
          dimension: "Line",
          rows: [
            { label: "Line 1", value: 2.1, unit: "count" },
            { label: "Line 2", value: 2.4, unit: "count" },
            { label: "Line 3", value: 1.9, unit: "count" },
            { label: "Line 4", value: 5.6, unit: "count" },
            { label: "Line 5", value: 2.2, unit: "count" },
            { label: "Line 6", value: 2.3, unit: "count" },
          ],
        },
        {
          id: "p-cq-operators-note",
          kind: "note",
          title: "Experience, pay and defects",
          body:
            "Tailors are paid a piece rate with no quality component, which is a genuine risk and does not show up in this data: defect rate is flat against pieces per shift across 1,410 operators. The fastest quartile is not the worst quartile.\n\n" +
            "Defect rate against experience falls steeply for eight weeks and is then flat. With 34% attrition the plant always has about 9% of its floor inside that window, and that has been true for four years.",
        },
      ],
    },
    {
      id: "dd-yarn-lots",
      label: "Defect rate by yarn lot and supplier",
      question: "Is the fabric fault coming in with the yarn, or is it being made here?",
      cost: 2,
      evidenceFor: ["origin.upstream"],
      readsAs:
        "Count variation is within tolerance on every lot tested, and the fabric faults cluster by machine rather than by lot — the same yarn runs clean on the other fourteen knitting machines.",
      reveals: [
        {
          id: "p-cq-yarn",
          kind: "segments",
          title: "Fabric faults per 100 kg, by yarn supplier",
          caption: "Across all twenty knitting machines.",
          dimension: "Supplier",
          rows: [
            { label: "Supplier 1 — 46% of volume", value: 3.1, unit: "count" },
            { label: "Supplier 2 — 31% of volume", value: 2.9, unit: "count" },
            { label: "Supplier 3 — 23% of volume", value: 3.2, unit: "count" },
          ],
        },
        {
          id: "p-cq-yarn-note",
          kind: "note",
          title: "The same yarn, different machines",
          body:
            "Split the same lots by machine instead of by supplier and the picture changes completely: the six machines with needle beds past 4,000 running hours show 9.4 faults per 100 kg, and the other fourteen show 1.1.\n\n" +
            "Yarn is not the variable. The needle bed is.",
        },
      ],
    },
    {
      id: "dd-buyer-standard",
      label: "What the buyers' standards actually did",
      question: "Have the specifications tightened under us?",
      cost: 2,
      evidenceFor: ["inspection.standard"],
      readsAs:
        "One buyer moved from AQL 4.0 to 2.5 last season, worth about 0.4 points of the defect rate on 24% of the volume. The other three are unchanged. It is real and it is a fifth of what moved.",
      reveals: [
        {
          id: "p-cq-standards",
          kind: "stat",
          title: "Acceptance standards by buyer",
          tiles: [
            { label: "Buyer A — AQL, was 4.0", value: 2.5, unit: "count", goodDirection: "down" },
            { label: "Buyer B — AQL, unchanged", value: 4.0, unit: "count", goodDirection: "down" },
            { label: "Buyer C — AQL, unchanged", value: 4.0, unit: "count", goodDirection: "down" },
            { label: "Share of volume affected", value: 0.24, unit: "ratio", goodDirection: "down" },
          ],
        },
      ],
    },
  ],

  causes: [
    { id: "origin", parentId: null, label: "Where the defects are made", verdict: "The branch nobody in the plant has data for, and the one holding the answer." },
    {
      id: "origin.upstream",
      parentId: "origin",
      label: "78% are made at two unwatched stations, and every one of them is found after the full cost is in the piece",
      verdict:
        "This was it. Six knitting machines on needle beds past 4,000 hours make 44% of the rejects, and the sleeve-attach station on line 4 makes another 34%. Neither is checked, so both defects travel through cutting, stitching, washing, packing and boxing before anybody sees them — ₹296 of value added to a piece that was already scrap. The same defect stopped at the machine costs about ₹7.",
    },
    {
      id: "origin.finishing",
      parentId: "origin",
      label: "Washing and finishing are damaging good pieces",
      verdict:
        "9% of traced rejects, mostly oil marks from two dryers due a service. Worth having fixed and worth about ₹0.4 crore. It is not what doubled the air freight.",
    },
    { id: "inspection", parentId: null, label: "How hard we look for them", verdict: "Where the entire budget went, and the one branch that cannot change how many defects exist." },
    {
      id: "inspection.coverage",
      parentId: "inspection",
      label: "We are still not catching enough of them — we need a 100% audit",
      verdict:
        "Inspection changes who finds a defect, never whether it was made. The last doubling found 1.4 points more of the same defects, cut escapes by a third, and raised rework 19% and air freight 31% because more pieces entered the loop. A full audit costs ₹1.3 crore to save ₹1.09 crore of claims and adds to the loop that causes the freight.",
    },
    {
      id: "inspection.standard",
      parentId: "inspection",
      label: "The buyers' acceptance standards have tightened under us",
      verdict:
        "One buyer moved from AQL 4.0 to 2.5 on 24% of the volume, worth about 0.4 points of the 11.4. Real, and a fifth of the story. Tightening our own standard in response is worse than doing nothing: it downgrades pieces worth ₹430 into seconds worth ₹172 and improves every quality metric while doing it.",
    },
    { id: "people", parentId: null, label: "The people making the garments", verdict: "The managing director's theory, and the data says no." },
    {
      id: "people.skill",
      parentId: "people",
      label: "Attrition has left us with tailors who cannot sew well enough",
      verdict:
        "Defect rate against experience falls steeply for eight weeks and is flat after that, and the plant has had 34% attrition for four years. Line 4 is 2.6× every other line with the same experience mix on both shifts, which is a fact about the station rather than about the people standing at it.",
    },
    {
      id: "people.incentive",
      parentId: "people",
      label: "A piece rate with no quality component rewards speed over care",
      verdict:
        "A genuine risk that this data does not support: defect rate is flat against pieces per shift across 1,410 operators, and the fastest quartile is not the worst. Worth changing on principle, and it will not move this year's number.",
    },
  ],
  trueCauseIds: ["origin.upstream"],

  interventions: [
    {
      id: "iv-source-inspection",
      label: "Check at the station instead of at the end",
      pitch:
        "First-piece and hourly checks at the knitting machines and at sleeve attach, with authority to stop the station. A needle line is visible in the fabric as it comes off the machine; a puckered sleeve is obvious at the next operation. Neither has to travel through the wash house to be found.",
      addresses: "origin.upstream",
      cost: { sprints: 2, rupees: 1.4 * CRORE },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "defectRate", deltaPct: -0.45, rampQuarters: 2 },
          // Fewer escapes, because a defect stopped at source never enters the
          // lot that inspection is sampling.
          { driver: "claimRate", deltaPct: -0.3, rampQuarters: 2 },
          { driver: "airFreightShare", deltaPct: -0.35, rampQuarters: 2 },
        ],
        otherwise: [{ driver: "defectRate", deltaPct: -0.1, rampQuarters: 2 }],
      },
      debrief:
        "The prevention half, and the cheapest quality spend in the plant: it does not need a machine, a headcount ratio or a buyer's agreement, and it changes the moment a defect is discovered from after ₹296 of value to after ₹7.",
    },
    {
      id: "iv-knitting-overhaul",
      label: "Rebuild the six knitting machines and put them on a schedule",
      pitch:
        "New needle beds on the six machines past 4,000 hours, and a change schedule by running hours instead of by whoever notices a line in the fabric nine days later.",
      addresses: "origin.upstream",
      cost: { sprints: 2, rupees: 2.2 * CRORE },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "defectRate", deltaPct: -0.28, rampQuarters: 2 },
          { driver: "claimRate", deltaPct: -0.1, rampQuarters: 2 },
        ],
        otherwise: [{ driver: "defectRate", deltaPct: -0.06, rampQuarters: 2 }],
      },
      debrief:
        "The other half, and the one that removes the defect rather than catching it early. Six machines make 44% of the rejects in a plant of twenty; a needle bed is ₹36 lakh and a preventive schedule is free.",
    },
    {
      id: "iv-full-audit",
      label: "Move to a 100% final audit",
      pitch:
        "The quality head's proposal. Inspect every piece rather than a sample, and the escapes that turn into claims stop reaching the buyer.",
      addresses: "inspection.coverage",
      cost: { sprints: 1, rupees: 1.3 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "claimRate", deltaPct: -0.45, rampQuarters: 2 },
          { driver: "inspectionCost", deltaPct: 0.45 },
        ],
        otherwise: [
          { driver: "claimRate", deltaPct: -0.35, rampQuarters: 2 },
          { driver: "inspectionCost", deltaPct: 0.45 },
          // Every extra piece caught is a piece entering the rework loop, and
          // the rework loop is what buys the air tickets.
          { driver: "airFreightShare", deltaPct: 0.15, rampQuarters: 2 },
        ],
      },
      debrief:
        "The most reasonable-sounding answer on the board, and it loses. The estimate of what it catches is right — about a third of the escapes, ₹1.09 crore — and it costs ₹1.3 crore to run and pushes more pieces into the rework loop that causes the freight. Appraisal changes who finds a defect. Only prevention changes whether it exists.",
    },
    {
      id: "iv-tighten-aql",
      label: "Tighten our own acceptance standard",
      pitch:
        "Buyer A has gone to AQL 2.5 and the others will follow. Move the whole plant to the tighter standard now and stop being caught out.",
      addresses: "inspection.standard",
      cost: { sprints: 1, rupees: 0.4 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "claimRate", deltaPct: -0.2, rampQuarters: 2 },
          { driver: "reworkShare", deltaPct: -0.1, rampQuarters: 2 },
        ],
        otherwise: [
          { driver: "claimRate", deltaPct: -0.15, rampQuarters: 2 },
          // A tighter standard downgrades pieces rather than improving them:
          // ₹430 of first quality becomes ₹172 of seconds.
          { driver: "reworkShare", deltaPct: -0.2, rampQuarters: 2 },
        ],
      },
      debrief:
        "The dangerous one, because every quality metric on the board improves. Escapes fall, the audit passes, and the plant gives away ₹258 a piece on everything it downgrades to get there. A standard decides what happens to a piece that already exists; it has no opinion about how many of them there are.",
    },
    {
      id: "iv-quality-bonus",
      label: "Put a quality component into the piece rate",
      pitch:
        "Tailors are paid for speed and nothing else. Add a defect-linked bonus and the floor starts caring about the second thing.",
      addresses: "people.incentive",
      cost: { sprints: 1, rupees: 0.9 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "defectRate", deltaPct: -0.14, rampQuarters: 3 },
          { driver: "variableCostPerPiece", deltaPct: 0.006 },
        ],
        otherwise: [
          { driver: "defectRate", deltaPct: -0.08, rampQuarters: 3 },
          { driver: "variableCostPerPiece", deltaPct: 0.006 },
        ],
      },
      debrief:
        "Right in principle and roughly self-cancelling here, because the data says the floor is not the variable: defect rate is flat against pieces per shift across 1,410 operators. Worth doing in a year when it is not being asked to carry the answer.",
    },
  ],

  /**
   * Nothing stands still: needle beds keep wearing, the buyers keep tightening,
   * and a plant that has not found its defect origin keeps discovering them at
   * the end.
   */
  drift: [
    { driver: "defectRate", deltaPct: 0.015 },
    { driver: "claimRate", deltaPct: 0.02 },
    { driver: "price", deltaPct: -0.005 },
  ],
  horizonQuarters: 4,
  periodNoun: "quarter",

  parInvestigation: ["dd-defect-origin", "dd-quality-cost"],
  bestAllocation: [
    { interventionId: "iv-source-inspection", sprints: 2, rupees: 1.4 * CRORE },
    { interventionId: "iv-knitting-overhaul", sprints: 2, rupees: 2.2 * CRORE },
  ],

  debrief: {
    causalChain: [
      "The only place anybody inspects is the final audit, so the only defect data the plant has is a list of symptoms found at the end.",
      "Traced back to origin, 78% of rejects are made at two stations: six knitting machines on worn needle beds, and sleeve attach on line 4.",
      "Neither station is checked, so a defect made there travels through cutting, stitching, washing, packing and boxing before anyone sees it.",
      "By then the piece carries ₹296 of value. Caught at the machine it would have cost about ₹7.",
      "62% are reworked at ₹48 and eleven days, and eleven days is four days more than the shipping window has — so 42% of rejects go by air at a ₹96 premium.",
      "The rest are downgraded from ₹430 to ₹172, which is ₹4.02 crore of value given away and appears nowhere as a cost.",
      "Sampling still lets 2.1% escape, and those become ₹3.11 crore of customer claims.",
      "Doubling the audit team moved the finding and not the making: defects found rose 12%, rework 19%, air freight 31%, and the defect rate itself went up.",
    ],
    whereTheLeverageWas:
      "Upstream, at two stations, for less than the quality department costs to run. Checking at the machine and rebuilding six needle beds takes the defect rate from 11.4% to about 4.5% and, more to the point, moves the moment of discovery from after ₹296 of value to after ₹7. The 100% audit the room wanted would have cost ₹1.3 crore to catch ₹1.09 crore, and the tighter standard would have improved every quality metric by giving away ₹258 a piece.",
    strongAnswer: [
      "The first thing to say is that the defect rate is measured in one place, and it is the last place.",
      "So the plant knows what its defects look like and nothing about where they come from.",
      "Trace a month of rejects back to the station: 44% are six knitting machines with needle beds past 4,000 hours, 34% is sleeve attach on line 4.",
      "Neither is inspected, so both defects travel the whole route before anybody sees them.",
      "That timing is the entire cost structure. A defect caught at the machine costs ₹7; at final inspection it costs ₹122 to rework or ₹258 to downgrade; at the customer it costs ₹430.",
      "Add the four boxes up and poor quality costs ₹12.91 crore against a net contribution of ₹17.33 crore. The quality department is ₹2.9 crore of that.",
      "Which is why doubling the audit team changed nothing that mattered: it is appraisal, and appraisal cannot change how many defects were made.",
      "It made two things worse. More pieces caught means more rework, and rework takes eleven days against a four-day window — so air freight rose 31%.",
      "I would spend the budget upstream. First-piece and hourly checks at the two stations, with authority to stop them.",
      "And rebuild the six needle beds with a change schedule by running hours rather than by whoever notices.",
      "That takes the defect rate to about 4.5% and cuts claims and air freight with it — about ₹5.8 crore of net contribution.",
      "I would not tighten the AQL. It improves every number on this dashboard by downgrading pieces worth ₹430 into seconds worth ₹172.",
    ],
  },

  coachFallback: [
    {
      topic: ["origin", "where", "traced", "station", "knitting", "needle", "line 4", "sleeve"],
      answer: [
        "78% of rejects are made at two stations: six knitting machines on worn needle beds (44%) and sleeve attach on line 4 (34%).",
        "Neither is checked, and both defects are visible at the station with no instrument at all.",
        "Everything else — cutting, washing, packing — is 22% between them.",
      ],
    },
    {
      topic: ["cost of poor quality", "copq", "prevention", "appraisal", "internal failure", "external failure", "four boxes"],
      answer: [
        "₹12.91 crore in total: ₹0.3 crore of prevention, ₹2.9 crore of appraisal, ₹6.9 crore of internal failure and ₹3.11 crore of external failure.",
        "It is booked in five different cost centres, which is why nobody had ever added it up.",
        "Net contribution for the year is ₹17.33 crore, so the number is three quarters of the profit.",
      ],
    },
    {
      topic: ["inspection", "audit", "100%", "inspectors", "more people", "catch"],
      answer: [
        "Inspection changes who finds a defect and when. It cannot change whether it was made.",
        "The last doubling found 12% more defects, cut escapes by a third, and raised rework 19% and air freight 31%.",
        "A 100% audit costs ₹1.3 crore a year to save about ₹1.09 crore of claims, and adds to the rework loop that causes the freight.",
      ],
    },
    {
      topic: ["1-10-100", "when", "timing", "value added", "296", "downstream"],
      answer: [
        "A piece carries ₹296 of yarn, knitting, cutting, stitching and packing by the time it reaches final inspection.",
        "The same defect costs ₹7 at the station that made it, ₹122 to rework at the end, ₹258 to downgrade, ₹430 at the customer.",
        "So the question worth asking is never 'how do we catch more?' — it is 'why are we finding this here?'.",
      ],
    },
    {
      topic: ["aql", "standard", "tighten", "buyer", "specification"],
      answer: [
        "One buyer moved from AQL 4.0 to 2.5 on 24% of the volume — about 0.4 points of the 11.4.",
        "Tightening our own standard downgrades more pieces rather than making better ones.",
        "Every quality metric on the dashboard improves, and each downgraded piece gives away ₹258.",
      ],
    },
    {
      topic: ["air freight", "rework", "eleven days", "window", "late"],
      answer: [
        "Rework takes eleven working days against a shipping window built with four days of slack.",
        "So 42% of rejected pieces go by air at a ₹96 premium — ₹1.66 crore last year, booked in logistics.",
        "That is how a quality problem becomes a freight overrun that the quality meeting never sees.",
      ],
    },
    {
      topic: ["tailor", "attrition", "skill", "experience", "piece rate", "incentive", "people"],
      answer: [
        "Defect rate against experience falls steeply for eight weeks and is flat afterwards, and attrition has been 34% for four years.",
        "Line 4 is 2.6× every other line on both shifts with the same experience mix — that is the station, not the people.",
        "Defect rate is also flat against pieces per shift, so the piece rate is not buying speed at the cost of care.",
      ],
    },
    {
      topic: ["yarn", "supplier", "fabric", "count variation", "spinner"],
      answer: [
        "All three yarn suppliers sit within a tenth of a point of each other on faults per 100 kg.",
        "Split the same lots by machine and six show 9.4 faults per 100 kg against 1.1 for the other fourteen.",
        "The variable is the needle bed, not the yarn.",
      ],
    },
    {
      topic: ["downgrade", "seconds", "172", "430", "price"],
      answer: [
        "1.56 lakh pieces a year are sold as seconds at ₹172 against a list price of ₹430.",
        "That is ₹4.02 crore of value given away, and it appears nowhere as a cost — only as a lower price on an invoice.",
        "It is the single largest line in the cost of poor quality.",
      ],
    },
  ],
};
