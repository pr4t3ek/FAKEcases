/**
 * The case frameworks a candidate builds trees from.
 *
 * Reconciled from two sources: the ICON / IIM Bangalore casebook (labels are
 * reproduced as it states them, because the diagnostic scorer matches
 * `expectedBuckets` and `rootCause` BY LABEL and a paraphrase would mark correct
 * answers wrong), and the author's own curated trees, carried as `aliases` so
 * both wordings match and both complete.
 *
 * These five are the casebook's own section structure — Profitability (18
 * cases), Market Entry (7), Growth (9), Pricing (9), M&A/PE (8) — plus the
 * "Best of season" and "Unconventional" sections, which reuse them. Cost
 * Reduction and Market Share Decline are deliberately absent: they are not
 * frameworks in the source, they are entries into Profitability's cost and
 * demand arms.
 *
 * `hints` are prompts, not nodes. A Guided click that dropped every hint as a
 * box would put forty rows on screen; they sit under a branch as grey text and
 * can be promoted when the candidate wants that depth.
 */

export interface FrameworkNodeTemplate {
  label: string;
  /** Other wordings that mean this branch — for matching and completion. */
  aliases?: string[];
  /** Prompts shown under the branch, promotable to real nodes. */
  hints?: string[];
  children?: FrameworkNodeTemplate[];
  /** An analytical lens that applies inside this branch. */
  lens?: string;
}

export interface Framework {
  slug: string;
  label: string;
  /** Words that, typed into a label, suggest this framework. */
  triggers: string[];
  /** What to ask before structuring anything. Straight from the casebook. */
  preliminary?: string[];
  children: FrameworkNodeTemplate[];
}

export const FRAMEWORKS: Framework[] = [
  {
    slug: "profitability",
    label: "Profitability",
    triggers: ["profit", "profitability", "margin", "loss", "losses", "bottom line"],
    preliminary: [
      "What's the objective, how much of a change, and by when?",
      "How does the business actually make money?",
      "Which customer segments are we talking about?",
      "What's the product mix, and has it changed?",
      "What's happened in the competitive landscape?",
    ],
    children: [
      {
        label: "Revenue",
        children: [
          { label: "Selling Price per Unit", aliases: ["Price", "Price per unit"] },
          {
            label: "Number of Units",
            aliases: ["Volume", "# Units Sold", "Units sold", "Quantity"],
            children: [
              {
                label: "Demand",
                aliases: ["Demand Side"],
                children: [
                  {
                    label: "Number of Customers",
                    children: [
                      {
                        label: "Pre-Service",
                        aliases: ["Pre-Purchase"],
                        hints: ["Need", "Awareness", "Accessibility", "Affordability", "Customer Experience"],
                        lens: "4A",
                      },
                      {
                        label: "During Service",
                        aliases: ["During Purchase"],
                        hints: ["Brand value", "Quality", "Experience"],
                      },
                      {
                        label: "Post-Service",
                        aliases: ["Post-Purchase"],
                        hints: ["After-sales service", "Returns / exchange", "Loyalty programs"],
                      },
                      { label: "Firm Level" },
                      { label: "Industry Level" },
                      { label: "Macro", hints: ["PESTEL"], lens: "PESTEL" },
                    ],
                  },
                  { label: "Avg Order Amount", aliases: ["Average order value", "AOV", "Basket size"] },
                  { label: "Order Frequency", aliases: ["Frequency", "Repeat rate"] },
                ],
              },
              {
                label: "Supply",
                aliases: ["Supply Side"],
                children: [
                  {
                    label: "Value Chain",
                    children: [
                      {
                        label: "Primary Activities",
                        hints: ["Procurement", "Manufacturing", "Distribution", "Post-sales service"],
                      },
                      {
                        label: "Support Activities",
                        hints: ["SG&A", "Infrastructure & IT", "Human capital"],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            label: "Product Mix",
            hints: ["Which products in the portfolio", "Apply 80/20"],
          },
        ],
      },
      {
        label: "Cost",
        children: [
          {
            label: "Primary Activities",
            // Fixed/Variable is not the same cut as Primary/Support — it is close
            // enough to help a candidate find the branch, so it is a fuzzy alias
            // rather than a claim of equivalence.
            aliases: ["Variable Cost", "Variable costs"],
            children: [
              {
                label: "Procuring Raw Materials",
                aliases: ["Raw materials", "Procurement"],
                hints: ["Cost of raw materials", "Transport & packaging", "#suppliers × contract × duration"],
              },
              {
                label: "Manufacturing",
                aliases: ["Production"],
                hints: ["Plant maintenance", "Idle-capacity cost", "Wastage", "Setup time & cost"],
              },
              {
                label: "Distribution and Storage",
                aliases: ["Distribution", "Logistics", "Delivery"],
                hints: ["#distributors × avg order × frequency", "Transport & packaging", "Intermediate storage"],
              },
              {
                label: "Post Sales Service",
                hints: ["#customers × frequency × cost", "Spare parts, returns, replacements"],
              },
            ],
          },
          {
            label: "Support Activities",
            aliases: ["Fixed Cost", "Fixed costs", "Overheads"],
            children: [
              { label: "Research and Development", aliases: ["R&D"] },
              { label: "Financing costs", aliases: ["Interest", "Financing"] },
              { label: "Branding and Advertising", aliases: ["Marketing", "Advertising"] },
              { label: "Human Capital", hints: ["Capacity × efficiency × utilization"] },
              { label: "Selling, General & Administrative", aliases: ["SG&A"] },
            ],
          },
        ],
      },
    ],
  },

  {
    slug: "market-entry",
    label: "Market Entry",
    triggers: ["market entry", "enter", "entry", "launch in", "expand into", "new market"],
    preliminary: [
      "Why enter at all — what's the strategic objective?",
      "What does success look like, and by when?",
      "What can the client already do that transfers?",
    ],
    children: [
      {
        label: "Strategic Objective",
        hints: ["Why enter?", "Target metric"],
      },
      {
        label: "Industrial Conditions",
        aliases: ["Market attractiveness", "Industry"],
        children: [
          {
            label: "Market Attractiveness",
            hints: ["Addressable market (TAM, SAM, SOM)", "Growth rate", "Profit margin"],
          },
          {
            label: "Competition",
            hints: ["Market structure", "Reaction to entry", "Major players"],
            lens: "Porter",
          },
          {
            label: "Customers",
            aliases: ["Customer segments"],
            hints: ["Segments", "Price, Product, Place, Promotion"],
            lens: "4P",
          },
          {
            label: "Barriers to Entry",
            hints: ["Financial constraints", "Capabilities / resources", "Suppliers", "Govt. regulations", "Patents, IP"],
            lens: "PESTEL",
          },
        ],
      },
      {
        label: "How to Enter?",
        aliases: ["Mode of Entry", "Entry mode"],
        children: [
          { label: "Organic", hints: ["Build internally"] },
          {
            label: "Inorganic",
            children: [
              { label: "Joint Venture", hints: ["Partner with a local entity"] },
              { label: "Acquisition", hints: ["Buy an existing player"] },
            ],
          },
        ],
      },
      {
        // From the author's tree. The casebook folds these into Barriers to
        // Entry, but a candidate who starts here should still land somewhere.
        label: "Financial Feasibility",
        hints: ["Setup costs / investment", "Expected profit margins", "Break-even analysis"],
      },
      {
        label: "Operational Feasibility",
        hints: ["Existing resources", "Technical expertise / infrastructure", "Value chain setup"],
      },
    ],
  },

  {
    slug: "growth",
    label: "Growth Strategy",
    triggers: ["growth", "grow", "scale", "double", "expand", "increase revenue"],
    preliminary: [
      "Grow what, by how much, and by when?",
      "Is the market growing, or are we taking share?",
    ],
    children: [
      {
        // The casebook frames growth as Ansoff — products × markets.
        label: "Increase Number of Customers",
        aliases: ["Ansoff", "Organic Growth"],
        children: [
          {
            label: "Market Penetration",
            aliases: ["Existing product, existing market"],
            hints: ["Growth in line with expectations", "Low share vs the leader", "Becomes a profitability case"],
          },
          {
            label: "Product Development",
            aliases: ["New product, existing market"],
            hints: ["Growth below expectations", "Product maturing or declining", "Becomes a launch case"],
          },
          {
            label: "Market Development",
            aliases: ["Existing product, new market"],
            hints: ["High share vs closest competitor", "Concentrated in a small market", "Becomes a market entry case"],
          },
          {
            label: "Diversification",
            aliases: ["New product, new market"],
            hints: ["High concentration in one product or category"],
          },
        ],
      },
      {
        // Ansoff has no ARPU arm, and real growth cases need one. From the
        // author's tree.
        label: "Increase Revenue per Customer",
        aliases: ["ARPU", "Revenue per customer"],
        children: [
          { label: "Price Discrimination" },
          { label: "Upselling & Cross-selling", aliases: ["Upsell", "Cross-sell"] },
          { label: "Bundling" },
          { label: "Loyalty Programs / Discounts", aliases: ["Loyalty", "Discounts"] },
        ],
      },
      {
        label: "Inorganic Growth",
        children: [
          { label: "Mergers & Acquisitions", aliases: ["M&A", "Acquisition"] },
          { label: "Joint Ventures", aliases: ["Joint venture", "Partnership"] },
        ],
      },
    ],
  },

  {
    slug: "pricing",
    label: "Pricing",
    triggers: ["pricing", "price it", "how much to charge", "what price"],
    preliminary: [
      "What are we pricing, and for whom?",
      "Is this a new product, or a repricing?",
      "What's the objective — share, margin, or volume?",
    ],
    children: [
      {
        label: "Cost Based",
        aliases: ["Cost-Plus Pricing", "Cost plus"],
        children: [
          { label: "Fixed costs", hints: ["Per year", "Per user", "Total fixed cost"] },
          { label: "Variable costs", aliases: ["Manufacturing costs"] },
          { label: "Number of users", aliases: ["User base", "Volume"] },
          { label: "R&D Costs", aliases: ["Research and development"] },
          { label: "Other Costs / Overheads", aliases: ["Overheads"] },
        ],
      },
      {
        label: "Competitor Based",
        aliases: ["Competitor-Based Pricing", "Competition based"],
        children: [
          { label: "Existing Products in Market", aliases: ["Existing products"] },
          { label: "Substitute Availability", aliases: ["Substitutes"] },
        ],
      },
      {
        label: "Value Based",
        aliases: ["Value-Based Pricing", "Willingness to pay"],
        children: [
          { label: "Customer Profile / Segment", aliases: ["Customer segment"] },
          { label: "Uses and Benefits over existing products", aliases: ["Benefits", "Differentiation"] },
          { label: "Perceived Value to Customer", aliases: ["Perceived value"] },
        ],
      },
    ],
  },

  {
    slug: "ma-pe",
    label: "M&A / PE",
    triggers: ["acquisition", "acquire", "merger", "invest in", "private equity", "due diligence", "valuation", "target"],
    preliminary: [
      "What's the investment thesis — why this target?",
      "What return, over what horizon?",
      "Any constraints on ticket size or sector?",
    ],
    children: [
      {
        label: "Financial Feasibility",
        children: [
          {
            label: "Financial Factors",
            hints: ["Market size (guesstimate)", "Growth rate", "Profitability"],
          },
          {
            label: "Acquired Firm's Factors",
            aliases: ["Target factors"],
            hints: ["Unique value proposition", "Competitors", "Current equity structure"],
          },
        ],
      },
      {
        label: "Synergies and Business Model",
        children: [
          {
            label: "Synergies",
            hints: ["Demand-side", "Supply-side", "Efficiency"],
          },
          {
            label: "Business Model",
            hints: ["Company's evaluation", "Operations", "Financials"],
          },
        ],
      },
      {
        label: "Exit Options and Risks",
        children: [
          { label: "Exit Options", hints: ["Total exit", "Partial exit", "IPO"] },
          { label: "Risks", hints: ["PESTLE"], lens: "PESTEL" },
        ],
      },
    ],
  },
];

/**
 * The second tier from the casebook (pp13–17): lenses applied INSIDE a branch,
 * never as a root. They take no part in framework detection — only the five
 * case-type trees ever compete for "which framework is this" — and they attach
 * by parent, which path-scoped completion already handles.
 */
export const LENSES: Record<string, { label: string; parts: string[] }> = {
  SWOT: {
    label: "SWOT",
    parts: ["Strengths", "Weaknesses", "Opportunities", "Threats"],
  },
  PESTEL: {
    label: "PESTEL",
    parts: ["Political", "Economic", "Social", "Technological", "Environmental", "Legal"],
  },
  "5C": {
    label: "5C's",
    parts: ["Company", "Customer", "Competitor", "Collaborator", "Context"],
  },
  "4P": {
    label: "4P's",
    parts: ["Product", "Price", "Place", "Promotion"],
  },
  Porter: {
    label: "Porter's Five Forces",
    parts: [
      "Bargaining power of buyers",
      "Bargaining power of suppliers",
      "Threat of substitution",
      "Threat of new entrants",
      "Competitive rivalry",
    ],
  },
  "4A": {
    label: "4A / Customer journey",
    parts: ["Need", "Awareness", "Accessibility", "Affordability"],
  },
  "7S": {
    label: "7S",
    parts: ["Strategy", "Structure", "Systems", "Shared values", "Style", "Staff", "Skills"],
  },
  "6M": {
    label: "6M",
    parts: ["Man", "Machine", "Method", "Material", "Measurement", "Mother Nature"],
  },
  BCG: {
    label: "BCG matrix",
    parts: ["Star", "Question mark", "Cash cow", "Dog"],
  },
};

export function frameworkBySlug(slug: string | null | undefined): Framework | null {
  if (!slug) return null;
  return FRAMEWORKS.find((f) => f.slug === slug) ?? null;
}
