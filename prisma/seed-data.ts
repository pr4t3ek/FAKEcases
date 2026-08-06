/** India-only seed content for EstimateIQ. All figures in Indian context / ₹. */

export const categories = [
  { slug: "market-sizing", name: "Market Sizing", icon: "PieChart", order: 1 },
  { slug: "demand-estimation", name: "Demand Estimation", icon: "TrendingUp", order: 2 },
  { slug: "revenue-estimation", name: "Revenue Estimation", icon: "IndianRupee", order: 3 },
  { slug: "population", name: "Population", icon: "Users", order: 4 },
  { slug: "retail", name: "Retail", icon: "ShoppingCart", order: 5 },
  { slug: "healthcare", name: "Healthcare", icon: "HeartPulse", order: 6 },
  { slug: "technology", name: "Technology", icon: "Cpu", order: 7 },
  { slug: "education", name: "Education", icon: "GraduationCap", order: 8 },
  { slug: "transportation", name: "Transportation", icon: "Bus", order: 9 },
  { slug: "manufacturing", name: "Manufacturing", icon: "Factory", order: 10 },
  { slug: "consumer-goods", name: "Consumer Goods", icon: "Package", order: 11 },
  { slug: "finance", name: "Finance", icon: "Landmark", order: 12 },
  { slug: "energy", name: "Energy", icon: "Zap", order: 13 },
  { slug: "startups", name: "Startups", icon: "Rocket", order: 14 },
  { slug: "product-management", name: "Product Management", icon: "LineChart", order: 15 },
];

export interface SeedQuestion {
  externalId: string;
  title: string;
  prompt: string;
  category: string; // slug
  difficulty: "Easy" | "Medium" | "Hard";
  interviewLevel: string;
  /** Omitted for qualitative questions, which don't end in a number. */
  idealLow?: number;
  idealHigh?: number;
  unit?: string;
  betterApproach: string;
  sampleSolution: string;
  tags: string;
  /** "guesstimate" (default) | "qualitative" | "simulation". */
  type?: string;
  /** Framework slug this case is written against, for qualitative questions. */
  framework?: string;
  /** Branches a good answer covers, for MECE coverage scoring. */
  expectedBuckets?: string[];
  /** Facts the interviewer releases only when asked about that topic. */
  dataPack?: { topic: string[]; fact: string }[];
  /** The branch that actually holds the problem. Presence makes a case diagnostic. */
  rootCause?: { path: string[]; note?: string };
  /**
   * Open to guests, with no account. The shop window — see
   * `lib/entitlements.ts` and `guestSampleSize` in `lib/config/access.ts`.
   *
   * Exactly one guesstimate, one case and one simulation carry it, and each was
   * picked to be the most inviting of its kind rather than the first of its
   * kind: chai in Bangalore is the guesstimate everyone has already half-done in
   * their head, the delivery-margin case is the classic profitability tree, and
   * Kadak Coffee is the scenario authored as the beginner war room.
   */
  freeTier?: boolean;
}

export const questions: SeedQuestion[] = [
  {
    externalId: "umbrellas-mumbai",
    title: "Annual umbrella demand in Mumbai",
    prompt: "Estimate the annual demand for umbrellas in Mumbai.",
    category: "demand-estimation",
    difficulty: "Easy",
    interviewLevel: "McKinsey",
    idealLow: 6_000_000,
    idealHigh: 12_000_000,
    unit: "umbrellas/year",
    betterApproach:
      "Segment population into adults vs children, narrow to actual umbrella owners, apply a replacement frequency (~1 per 2 years), then add monsoon damage, first-time buyers and institutional demand.",
    sampleSolution:
      "Mumbai ~2 cr people → owners ~1.4 cr → replaced every ~2 yrs = 0.7 cr/yr → +15% for monsoon loss/new buyers/institutional ≈ 75–85 lakh umbrellas/year. Illustrative, not exact.",
    tags: "monsoon,replacement,segmentation",
  },
  {
    externalId: "chai-bangalore-daily",
    title: "Cups of chai consumed in Bangalore per day",
    prompt: "Estimate the number of cups of chai consumed in Bangalore in a day.",
    category: "demand-estimation",
    difficulty: "Easy",
    interviewLevel: "GeneralMBA",
    idealLow: 8_000_000,
    idealHigh: 22_000_000,
    unit: "cups/day",
    betterApproach:
      "Split population into tea drinkers vs non-drinkers, estimate cups/day per drinker (home + roadside + office), and don't forget the floating/working population and tourists.",
    sampleSolution:
      "~1.3 cr population, ~65% tea drinkers ≈ 85 lakh, avg ~1.5 cups/day ≈ 1.3 cr cups; add offices/roadside/tourists → ~1.2–1.8 cr cups/day.",
    tags: "food,frequency,segmentation",
    // The guest tier's guesstimate.
    freeTier: true,
  },
  {
    externalId: "autos-bangalore",
    title: "Number of auto-rickshaws in Bangalore",
    prompt: "Estimate the number of auto-rickshaws operating in Bangalore.",
    category: "transportation",
    difficulty: "Easy",
    interviewLevel: "McKinsey",
    idealLow: 200_000,
    idealHigh: 500_000,
    unit: "auto-rickshaws",
    betterApproach:
      "Estimate daily auto trips from population and trip-per-capita share, then divide by trips a single auto serves per day. Cross-check with a supply view (registrations).",
    sampleSolution:
      "~1.3 cr people, ~10% take an auto daily → ~13 lakh trips; ~30–40 trips/auto/day → ~3–4 lakh autos. Registered figure is ~3 lakh.",
    tags: "mobility,demand-supply",
  },
  {
    externalId: "smartphone-users-delhi",
    title: "Number of smartphone users in Delhi",
    prompt: "Estimate the number of smartphone users in Delhi.",
    category: "population",
    difficulty: "Easy",
    interviewLevel: "PM",
    idealLow: 10_000_000,
    idealHigh: 16_000_000,
    unit: "users",
    betterApproach:
      "Start from population, remove very young children, apply an age-banded smartphone penetration (higher for 15–45, lower for elderly), and account for people owning multiple phones.",
    sampleSolution:
      "Delhi ~2 cr, ~85% above age 10 ≈ 1.7 cr, ~70–80% smartphone penetration → ~1.2–1.4 cr users.",
    tags: "penetration,age-bands",
  },
  {
    externalId: "maggi-market-india",
    title: "Annual market size for Maggi noodles in India",
    prompt: "Estimate the annual market size (in ₹) for Maggi noodles in India.",
    category: "market-sizing",
    difficulty: "Medium",
    interviewLevel: "McKinsey",
    idealLow: 30_000_000_000,
    idealHigh: 60_000_000_000,
    unit: "₹/year",
    betterApproach:
      "Estimate consuming households (urban skew), packs consumed per week, average price per pack, and annualise. Cross-check against Maggi's known dominant share of instant noodles.",
    sampleSolution:
      "~10 cr consuming households, ~1.5 packs/week × 52 × ~₹12 net ≈ ₹9,000 cr gross demand; company revenue is a subset (~₹4,000–5,000 cr). Range reflects consumer vs company view.",
    tags: "fmcg,households,frequency",
  },
  {
    externalId: "food-delivery-market-india",
    title: "Online food delivery market in India per year",
    prompt: "Estimate the annual GMV of online food delivery in India.",
    category: "market-sizing",
    difficulty: "Hard",
    interviewLevel: "BCG",
    idealLow: 400_000_000_000,
    idealHigh: 900_000_000_000,
    unit: "₹ GMV/year",
    betterApproach:
      "Funnel from urban internet users → food-delivery app users → monthly active orderers → orders/month → average order value. Focus on metros/tier-1 where delivery is concentrated.",
    sampleSolution:
      "~6 cr active orderers, ~3 orders/month × 12 × ~₹350 AOV ≈ ₹75,000 cr GMV. Range spans conservative vs aggressive penetration.",
    tags: "internet-funnel,aov,gmv",
  },
  {
    externalId: "cricket-bats-india",
    title: "Annual demand for cricket bats in India",
    prompt: "Estimate the number of cricket bats sold in India each year.",
    category: "demand-estimation",
    difficulty: "Medium",
    interviewLevel: "Bain",
    idealLow: 10_000_000,
    idealHigh: 40_000_000,
    unit: "bats/year",
    betterApproach:
      "Segment into casual/tennis-ball players, serious/leather-ball players, schools/academies and institutions; apply different replacement rates to each rather than one blended number.",
    sampleSolution:
      "~10 cr who play occasionally, small % own a bat replaced every few years, plus schools/clubs bulk demand → ~2–3 cr bats/year including cheap tennis-ball bats.",
    tags: "sports,segmentation,replacement",
  },
  {
    externalId: "delhi-metro-station-revenue",
    title: "Daily revenue of a single Delhi Metro station",
    prompt: "Estimate the daily fare revenue of one busy Delhi Metro station (e.g., Rajiv Chowk).",
    category: "revenue-estimation",
    difficulty: "Medium",
    interviewLevel: "BCG",
    idealLow: 300_000,
    idealHigh: 3_000_000,
    unit: "₹/day",
    betterApproach:
      "Estimate footfall by peak vs off-peak hours and platform throughput, split entries vs interchanges (interchange passengers don't pay at this station), then apply average fare.",
    sampleSolution:
      "~4–5 lakh footfall at a major interchange, of which paying originations ~1.5–2 lakh × ~₹35 avg fare ≈ ₹5–70 lakh/day depending on how interchange traffic is treated.",
    tags: "footfall,peak-offpeak,fare",
  },
  {
    externalId: "pvr-multiplex-pune-revenue",
    title: "Annual revenue of a PVR multiplex in Pune",
    prompt: "Estimate the annual revenue of a single multiplex cinema in Pune.",
    category: "revenue-estimation",
    difficulty: "Medium",
    interviewLevel: "Big4",
    idealLow: 150_000_000,
    idealHigh: 500_000_000,
    unit: "₹/year",
    betterApproach:
      "Build from screens × seats × shows/day × occupancy × ticket price, then add F&B (often ~25–30% of revenue) and advertising. Weekdays vs weekends differ sharply.",
    sampleSolution:
      "~6 screens × 200 seats × 4 shows × ~35% occupancy × ~₹220 ≈ ₹3.5 cr tickets/year; +F&B/ads → ~₹4.5–6 cr. Range widens with occupancy assumptions.",
    tags: "occupancy,f&b,capacity",
  },
  {
    externalId: "school-teachers-india",
    title: "Number of school teachers in India",
    prompt: "Estimate the total number of school teachers in India.",
    category: "population",
    difficulty: "Medium",
    interviewLevel: "GeneralMBA",
    idealLow: 7_000_000,
    idealHigh: 12_000_000,
    unit: "teachers",
    betterApproach:
      "Estimate school-going children from population age structure, apply a pupil-teacher ratio (~25–30), and sanity-check against number of schools × teachers per school.",
    sampleSolution:
      "~25 cr school-age children in school, PTR ~25 → ~1 cr teachers. India's actual figure is ~9.5 million.",
    tags: "ratios,age-structure",
  },
  {
    externalId: "kirana-stores-india",
    title: "Number of kirana stores in India",
    prompt: "Estimate the number of kirana (neighbourhood grocery) stores in India.",
    category: "retail",
    difficulty: "Hard",
    interviewLevel: "McKinsey",
    idealLow: 10_000_000,
    idealHigh: 15_000_000,
    unit: "stores",
    betterApproach:
      "Use households per kirana store as the driver (urban vs rural differ), or population served per store. Cross-check top-down (households ÷ households-per-store) with a per-locality view.",
    sampleSolution:
      "~30 cr households, ~1 kirana per ~20–25 households → ~1.2–1.5 cr stores. Widely cited figure is ~1.2–1.3 crore.",
    tags: "households-per-store,retail-density",
  },
  {
    externalId: "dmart-store-sales-hyderabad",
    title: "Annual sales of a DMart store in Hyderabad",
    prompt: "Estimate the annual sales of a single DMart store in Hyderabad.",
    category: "retail",
    difficulty: "Medium",
    interviewLevel: "Big4",
    idealLow: 300_000_000,
    idealHigh: 1_000_000_000,
    unit: "₹/year",
    betterApproach:
      "Estimate daily footfall × conversion × average basket size, then annualise; weekends drive a disproportionate share. Cross-check with sales per sq ft.",
    sampleSolution:
      "~3,000 billed customers/day × ~₹1,200 basket × 360 ≈ ₹130 cr/year. DMart's per-store revenue averages ~₹40–90 cr depending on size/maturity.",
    tags: "footfall,basket-size,retail",
  },
  {
    externalId: "hospital-beds-india",
    title: "Number of hospital beds needed in India",
    prompt: "Estimate the number of hospital beds required to adequately serve India.",
    category: "healthcare",
    difficulty: "Hard",
    interviewLevel: "McKinsey",
    idealLow: 2_000_000,
    idealHigh: 5_000_000,
    unit: "beds",
    betterApproach:
      "Apply a beds-per-1,000-people benchmark (WHO ~3) to population, or build bottom-up from admissions/year × average length of stay ÷ (365 × target occupancy).",
    sampleSolution:
      "1.4 billion × 3 beds/1,000 = ~4.2 million beds for WHO norm. India currently has ~1.9 million, i.e. a large gap.",
    tags: "benchmark,per-1000,occupancy",
  },
  {
    externalId: "insulin-diabetics-india",
    title: "Number of insulin-dependent diabetics in India",
    prompt: "Estimate the number of insulin-dependent diabetics in India.",
    category: "healthcare",
    difficulty: "Hard",
    interviewLevel: "Bain",
    idealLow: 8_000_000,
    idealHigh: 25_000_000,
    unit: "people",
    betterApproach:
      "Start from total diabetics (prevalence ~8–9% of adults), split Type 1 (all insulin-dependent) vs Type 2 (a fraction on insulin), and apply diagnosis/treatment rates.",
    sampleSolution:
      "~10 cr diabetics; Type 1 (~small %) + ~15–25% of Type 2 on insulin → ~1.5–2.5 cr insulin-dependent, of whom many are undiagnosed/untreated.",
    tags: "prevalence,type1-type2,treatment-rate",
  },
  {
    externalId: "upi-transactions-daily",
    title: "UPI transactions in India per day",
    prompt: "Estimate the number of UPI transactions happening in India per day.",
    category: "technology",
    difficulty: "Hard",
    interviewLevel: "Product",
    idealLow: 300_000_000,
    idealHigh: 700_000_000,
    unit: "transactions/day",
    betterApproach:
      "Estimate UPI users, then transactions per user per day (P2P + merchant), separating heavy urban users from occasional users. Cross-check with monthly volumes reported by NPCI.",
    sampleSolution:
      "~30 cr active UPI users × ~1.5 txns/day ≈ 45 cr/day. NPCI reports ~40–50 crore transactions/day.",
    tags: "fintech,per-user,npci",
  },
  {
    externalId: "jio-data-per-day",
    title: "Daily data consumed by Jio users in India",
    prompt: "Estimate the total mobile data (in GB) consumed by Jio users in India per day.",
    category: "technology",
    difficulty: "Hard",
    interviewLevel: "Product",
    idealLow: 150_000_000,
    idealHigh: 500_000_000,
    unit: "GB/day",
    betterApproach:
      "Users × average data per user per day. Segment heavy video/streaming users vs light users. Cross-check per-user monthly GB against published ARPU/usage figures.",
    sampleSolution:
      "~45 cr users × ~0.6–0.7 GB/day (≈ 20 GB/month) ≈ 27–30 crore GB/day.",
    tags: "telecom,per-user,streaming",
  },
  {
    externalId: "coaching-centres-india",
    title: "Number of JEE/NEET coaching centres in India",
    prompt: "Estimate the number of JEE/NEET coaching centres in India.",
    category: "education",
    difficulty: "Medium",
    interviewLevel: "GeneralMBA",
    idealLow: 30_000,
    idealHigh: 100_000,
    unit: "centres",
    betterApproach:
      "Estimate annual aspirants, students served per centre, and account for both large branded chains and small local tutorials. A city-tier view (metros vs small towns) helps.",
    sampleSolution:
      "~30–40 lakh aspirants/year; if a typical centre serves ~50–100 students → ~40,000–70,000 centres including small ones.",
    tags: "edtech,aspirants,per-centre",
  },
  {
    externalId: "edtech-market-india",
    title: "Annual edtech market size in India",
    prompt: "Estimate the annual market size (in ₹) of edtech in India.",
    category: "education",
    difficulty: "Hard",
    interviewLevel: "BCG",
    idealLow: 300_000_000_000,
    idealHigh: 600_000_000_000,
    unit: "₹/year",
    betterApproach:
      "Segment by K-12, test-prep, higher-ed/upskilling; estimate paying users and ARPU per segment. Paying conversion is low, so separate free vs paid users carefully.",
    sampleSolution:
      "Across segments, ~3–4 cr paying learners × blended ARPU ~₹10,000–15,000/year → ~₹35,000–50,000 cr.",
    tags: "segments,arpu,paying-users",
  },
  {
    externalId: "air-passengers-mumbai-delhi",
    title: "Annual air passengers between Mumbai and Delhi",
    prompt: "Estimate the number of air passengers flying between Mumbai and Delhi per year.",
    category: "transportation",
    difficulty: "Medium",
    interviewLevel: "BCG",
    idealLow: 4_000_000,
    idealHigh: 9_000_000,
    unit: "passengers/year",
    betterApproach:
      "Estimate daily flights on the route × seats × load factor × 2 directions × 365. Cross-check with airport share of traffic on this trunk route.",
    sampleSolution:
      "~80–100 flights/day each way × ~180 seats × ~85% load ≈ 13,000/day each way → ~90 lakh–1 cr both ways/year. It is among India's busiest routes.",
    tags: "load-factor,flights,capacity",
  },
  {
    externalId: "cars-manufactured-india",
    title: "Cars manufactured in India per year",
    prompt: "Estimate the number of passenger cars manufactured in India per year.",
    category: "manufacturing",
    difficulty: "Medium",
    interviewLevel: "Bain",
    idealLow: 3_000_000,
    idealHigh: 6_000_000,
    unit: "cars/year",
    betterApproach:
      "Build demand-side: population → households able to afford a car → replacement + first-time buyers; then add exports. Cross-check with top OEM capacities (Maruti, Hyundai, Tata).",
    sampleSolution:
      "Domestic PV sales ~40 lakh/year + exports ~7 lakh → ~45–50 lakh cars produced. Range reflects PV-only vs including UVs.",
    tags: "auto,demand-supply,exports",
  },
  {
    externalId: "toothpaste-tubes-india",
    title: "Annual toothpaste demand in India",
    prompt: "Estimate the number of toothpaste tubes sold in India per year.",
    category: "consumer-goods",
    difficulty: "Medium",
    interviewLevel: "McKinsey",
    idealLow: 2_000_000_000,
    idealHigh: 6_000_000_000,
    unit: "tubes/year",
    betterApproach:
      "Estimate users of toothpaste (penetration below 100%, rural lower), tubes consumed per user per year (depends on household size and tube size), then aggregate.",
    sampleSolution:
      "~100 cr users, ~3–4 tubes/user/year (family packs shared) → ~3–4 billion tubes. Penetration and tube size drive the range.",
    tags: "fmcg,penetration,per-user",
  },
  {
    externalId: "credit-cards-india",
    title: "Number of active credit cards in India",
    prompt: "Estimate the number of active credit cards in India.",
    category: "finance",
    difficulty: "Medium",
    interviewLevel: "Big4",
    idealLow: 60_000_000,
    idealHigh: 120_000_000,
    unit: "cards",
    betterApproach:
      "Funnel from adults → banked adults → those meeting income/credit criteria → cards per eligible holder (many hold multiple). Urban skew is heavy.",
    sampleSolution:
      "~30 cr credit-eligible adults, ~25–30% penetration, ~1.3 cards each → ~9–10 cr cards. RBI reports ~9–10 crore.",
    tags: "banking,eligibility,multiple-cards",
  },
  {
    externalId: "ev-2w-delhi-ncr",
    title: "EV two-wheelers sold per year in Delhi NCR",
    prompt: "Estimate the number of electric two-wheelers sold in Delhi NCR per year.",
    category: "energy",
    difficulty: "Medium",
    interviewLevel: "BCG",
    idealLow: 100_000,
    idealHigh: 400_000,
    unit: "units/year",
    betterApproach:
      "Estimate total two-wheeler sales in Delhi NCR, then apply an EV penetration rate (rising, but still a modest share), separating personal buyers from delivery fleets.",
    sampleSolution:
      "~10–12 lakh 2W sold/year in NCR, EV share ~10–20% (boosted by delivery fleets) → ~1.5–3 lakh EV 2W/year.",
    tags: "ev,penetration,fleets",
  },
  {
    externalId: "d2c-brand-gmv",
    title: "Annual GMV of a mid-size D2C brand in India",
    prompt: "Estimate the annual GMV of a mid-size direct-to-consumer (D2C) brand in India.",
    category: "startups",
    difficulty: "Hard",
    interviewLevel: "Product",
    idealLow: 500_000_000,
    idealHigh: 3_000_000_000,
    unit: "₹/year",
    betterApproach:
      "Build from monthly orders (across own site + marketplaces) × average order value × 12; or from unique customers × orders/year × AOV. Separate repeat vs new customers.",
    sampleSolution:
      "~50,000 orders/month × ~₹800 AOV × 12 ≈ ₹48 cr; a larger mid-size brand doing ~2–3 lakh orders/month reaches ~₹200–300 cr.",
    tags: "ecommerce,orders,aov",
  },

  // ── Qualitative ────────────────────────────────────────────────────────
  // Answered with an issue tree and a recommendation rather than a number, so
  // no ideal range and no unit. These two carry no data pack or root cause yet,
  // which makes them brainstorm-style: structure and reasoning are scored, and
  // there is no diagnosis to grade. Diagnostic cases (facts released on request,
  // a declared root cause) are authored from the casebook separately.
  {
    externalId: "qual-food-delivery-margin",
    title: "Falling delivery margins at a food-delivery platform",
    prompt:
      "A food-delivery platform in India has seen its per-order contribution margin fall over the last four quarters, even though order volumes are steady. Why might that be happening, and what would you look at first?",
    category: "startups",
    difficulty: "Medium",
    interviewLevel: "McKinsey",
    type: "qualitative",
    framework: "profitability",
    // Illustrative seed content, invented to exercise the diagnostic path
    // end-to-end. The casebook-derived cases are authored separately, from what
    // the source actually says about each one.
    expectedBuckets: [
      "Revenue",
      "Cost",
      "Commission / take rate",
      "Delivery cost",
      "Discounts",
      "Order value",
    ],
    dataPack: [
      {
        topic: ["revenue", "order", "volume", "orders"],
        fact: "Order volume is flat year-on-year — it has not fallen.",
      },
      {
        topic: ["commission", "take rate", "revenue per order"],
        fact: "Commission per order is unchanged at 18% of order value.",
      },
      {
        topic: ["order value", "basket", "aov"],
        fact: "Average order value has slipped about 6%, mostly from tier-2 cities.",
      },
      {
        topic: ["cost", "delivery", "rider", "logistics"],
        fact: "Delivery cost per order is up 31% year-on-year, driven by rider payouts.",
      },
      {
        topic: ["discount", "promotion", "marketing"],
        fact: "Discount spend per order is roughly flat.",
      },
      {
        topic: ["packaging", "support", "overhead"],
        fact: "Packaging and support costs per order are broadly unchanged.",
      },
    ],
    rootCause: {
      path: ["Cost", "Delivery cost"],
      note: "Rider payouts per order rose 31% while revenue per order barely moved — the margin is being lost on delivery cost, not on take rate or volume.",
    },
    betterApproach:
      "Split contribution margin into revenue per order (commission rate, delivery fee, ad income) and cost per order (rider payout, discounts, packaging, support). Isolate which side moved before hypothesising why, and check whether the mix of cities or order values shifted underneath a stable total volume.",
    sampleSolution:
      "Steady volume with falling margin points at price or cost per order rather than demand. Common culprits in India: rider payouts rising with fuel and competition for supply, deeper discounting to hold share, and a mix shift toward smaller orders in tier-2 cities where the fixed delivery cost is spread over a lower basket.",
    tags: "profitability,unit economics,delivery",
    // The guest tier's case: a profitability tree with a declared root cause, so
    // the sample includes a question that actually scores Diagnosis.
    freeTier: true,
  },
  {
    externalId: "qual-ev-two-wheeler-entry",
    title: "Should a two-wheeler maker enter electric scooters?",
    prompt:
      "An established Indian two-wheeler manufacturer is considering entering the electric scooter market. How would you structure the decision, and what would make you say no?",
    category: "transportation",
    difficulty: "Medium",
    interviewLevel: "BCG",
    type: "qualitative",
    framework: "market-entry",
    betterApproach:
      "Start with the strategic objective — why enter, and what does success look like — before sizing anything. Then industry conditions (market size and growth, competitors and their reaction, customer segments, barriers such as battery supply and charging), then how to enter: build, acquire, or partner.",
    sampleSolution:
      "The decision usually turns on whether existing assets transfer. Dealer network, brand trust and service reach carry over; battery chemistry, power electronics and charging partnerships do not. A 'no' is defensible if the capability gap needs a partner the client can't get on good terms, or if the segment's margins stay negative until volumes the client can't reach.",
    tags: "market entry,ev,strategy",
  },
  /**
   * The catalogue row for a decision simulation.
   *
   * Everything that makes it an exercise — dashboard, priced drilldowns, causal
   * model, debrief — lives in `lib/sim/scenarios`, keyed by this `externalId`.
   * What sits here is only what the library needs to show a card and filter it,
   * which is why there is no ideal range, no framework and no root cause: a
   * simulation is played, not answered, so `answerModeFor` never sees it.
   *
   * `betterApproach` and `sampleSolution` are required columns and are used by
   * nothing on this path — the debrief comes from the scenario — so they carry
   * the short version rather than being left blank.
   */
  {
    externalId: "metric-drop-food-delivery",
    title: "NukkadEats: orders are down 9% and nobody knows why",
    prompt:
      "Weekly orders at an Indian food-delivery app have fallen 9% over six weeks and the drop hasn't flattened. You have 8 analyst-days to find out why, then a quarter of engineering capacity and ₹12 crore to fix it. You will not be told whether you were right — you will see what happens to the business.",
    category: "product-management",
    difficulty: "Medium",
    interviewLevel: "PM",
    type: "simulation",
    betterApproach:
      "Split the north-star metric into its terms before hypothesising. Orders are sessions times conversion: if sessions are flat, every demand-side and national explanation is already weak, because a national cause cannot produce a regional pattern. Localise, then work down to what changed about the offer at the point customers drop out.",
    sampleSolution:
      "Sessions never moved, so this is a conversion problem, and the funnel puts it at checkout in tier-2 cities. What changed at checkout was the delivery ETA, which is set by rider supply — and a competitor had raised tier-2 rider payouts. The trap is that discounting genuinely lifts orders while handing back the contribution margin, so a candidate measured on orders alone can hit the number and lose the business case.",
    tags: "product management,metrics,root cause,food delivery,simulation",
  },
  /**
   * The beginner entry point to the simulation track.
   *
   * Easy in the sense the validator enforces — five data pulls, six causes one
   * level deep, four interventions — and it carries a concept primer, so a
   * student who has never met ROAS or CAC is taught them before being asked to
   * act on them.
   */
  {
    externalId: "ad-funnel-roas",
    title: "Kadak Coffee: the ads are working and the money is going",
    prompt:
      "A D2C coffee brand spends ₹10 lakh a month on ads. The CMO's dashboard reports a ROAS of 4.0 and wants to double the budget. Finance says every order loses money and wants it switched off. Both are reading correct numbers. Work out why, then spend a quarter fixing it — and watch what your decision does to the business.",
    category: "product-management",
    difficulty: "Easy",
    interviewLevel: "PM",
    type: "simulation",
    betterApproach:
      "Ask what a rupee of sales is actually worth before judging any advertising metric. ROAS is measured on revenue, so it cannot see gross margin; a campaign only breaks even once ROAS clears 1 ÷ gross margin. Compare customer acquisition cost with contribution per order — if CAC is larger, every extra rupee of spend buys more loss.",
    sampleSolution:
      "At 22% gross margin, break-even ROAS is 4.55, so the celebrated 4.0 was under water the whole time. 91% of ad-driven orders were the lowest-margin product, while organic customers chose the 41%-margin bundle a third of the time — a product-mix problem wearing a marketing problem's clothes. The traps are that the efficiency fixes are real but too small to close a margin gap, and that scaling spend, which the ROAS chart argues for, multiplies the loss.",
    tags: "product management,digital marketing,roas,cac,unit economics,coffee,simulation",
    // The guest tier's simulation — already the scenario the library shows
    // first, and the one written to be met cold.
    freeTier: true,
  },
  {
    externalId: "ab-test-readout",
    title: "Rangoli: the test says +6%, and the room wants it live on Monday",
    prompt:
      "An A/B test on the product page came back at +6% conversion, properly powered and signed off by data science. Design wants it live on Monday. Work out what the test actually measured before you ship it, then spend a month acting on what you find.",
    category: "product-management",
    difficulty: "Easy",
    interviewLevel: "PM",
    type: "simulation",
    betterApproach:
      "Separate three questions a test result runs together: is the number real, what caused it, and is it the number the decision needs. Significance answers only the first. Check whether the variant changed one thing or several, and whether the measurement window was long enough to see the costs as well as the benefits.",
    sampleSolution:
      "The variant bundled a redesigned page with a pre-ticked 'send me two sizes' box. The page alone was worth +1.4%; the pre-tick carried the rest of the +6% and drove returns from 6.1% to 9.8%. A return takes 12 to 16 days to come back and the test ran six, so the readout measured everything the change earned and none of what it cost. Shipped whole, conversion, orders and revenue all rise 6% and net contribution falls 6.7%.",
    tags: "product management,experimentation,ab testing,statistical significance,returns,fashion,e-commerce,simulation",
  },
  {
    externalId: "subscription-ltv-cac",
    title: "Padhai Plus: 18,000 new subscribers a month, and a bigger hole",
    prompt:
      "A test-prep subscription adds 18,000 members a month, reports an LTV:CAC of 4.6 and burns ₹34 lakh a month anyway. Find out why the ratios look healthy while the business doesn't, then spend a quarter fixing it.",
    category: "product-management",
    difficulty: "Easy",
    interviewLevel: "PM",
    type: "simulation",
    betterApproach:
      "Stop reading per-subscriber ratios and ask how big the base actually gets. A subscription base settles at new subscribers per month divided by churn rate, so churn sets the ceiling — and LTV:CAC can be excellent while that ceiling sits below your fixed costs.",
    sampleSolution:
      "At 18,000 joiners and 11% monthly churn the base caps out near 1.64 lakh, which at ₹177 of contribution each cannot cover ₹2.6 crore of fixed costs however efficient acquisition is. The cohort data localises the churn: 62% of leavers never completed a practice test in week one and retained at 19% against 79% for those who did. The trap is that more acquisition genuinely helps — it is the numerator — but costs about four times as much per unit of base as fixing the divisor.",
    tags: "product management,subscription,ltv,cac,churn,coaching,simulation",
  },
  {
    externalId: "channel-trade-spend",
    title: "Chaska: share is up five points and the profit is down a third",
    prompt:
      "A snack brand's quick-commerce share went from 4% to 11.5% in three quarters while monthly profit fell a third. The board wants to double the trade spend. Work out what the share actually cost before they do.",
    category: "product-management",
    difficulty: "Easy",
    interviewLevel: "PM",
    type: "simulation",
    betterApproach:
      "Follow one pack to the bank in each channel before judging any channel decision. What reaches you is MRP minus channel margin minus trade promotion, and the difference between two channels can be larger than your whole gross margin. Then ask what share of the new volume is genuinely new, because growth that moves a sale from a better channel to a worse one shows up as growth everywhere except the P&L.",
    sampleSolution:
      "A ₹60 pack realises ₹47.40 through a kirana and ₹34.80 through quick commerce, so against the same ₹26 of cost it contributes ₹21.40 against ₹8.80. 68% of quick-commerce buyers already bought the pack from a kirana and general-trade offtake fell 21% in exactly the pincodes quick commerce reached — so 3.4 lakh packs a month changed channel rather than being won, at ₹12.60 of contribution each. The right answer costs about three points of share.",
    tags: "product management,channel economics,trade promotion,market share,quick commerce,kirana,fmcg,simulation",
  },
  {
    externalId: "pricing-elasticity",
    title: "Suraksha Home: the competitor cut price — do we match?",
    prompt:
      "A competitor cut price 12% and your volume is down 9%. Sales wants to cut 15% to match. Work out how much extra volume that has to buy before you decide — and find out what actually moved the number.",
    category: "product-management",
    difficulty: "Medium",
    interviewLevel: "PM",
    type: "simulation",
    betterApproach:
      "Compute break-even volume before any price decision. A price cut comes straight out of contribution, so a 15% cut on a 37.5% margin destroys 40% of the margin and needs roughly 67% more volume to stand still. Compare that with measured elasticity, then check whether the volume loss is even about price by splitting it by channel.",
    sampleSolution:
      "Contribution is ₹499 − ₹312 = ₹187, falling to ₹112 at a 15% cut, so break-even needs about 67% more volume against an elasticity of 1.2 that offers 18%. The cut loses by arithmetic. The volume loss was channel-specific: modern trade fell 31% and general trade 2%, because trade promotion in modern trade had been cut 64% two quarters earlier. Because demand is inelastic, a 5% price rise would actually improve profit.",
    tags: "product management,pricing,elasticity,trade promotion,simulation",
  },
  {
    externalId: "market-sizing-gtm",
    title: "Ujala Solar: we planned for 10.8 lakh units and sold 4.3 lakh",
    prompt:
      "A rooftop solar kit missed its year-one plan by 60%. The CEO calls it an execution problem; the sales head says the number was never real. Decide who is right, then spend a quarter acting on it.",
    category: "product-management",
    difficulty: "Medium",
    interviewLevel: "PM",
    type: "simulation",
    betterApproach:
      "Ask what has to be true for one customer to buy, and check the SAM tested all of it. A uniform shortfall across every region points at the plan rather than at execution, because execution varies by region and arithmetic does not. Then judge any channel decision on net revenue, not gross.",
    sampleSolution:
      "The SAM counted households with power cuts who could afford ₹1,899 and never asked whether they had a roof — only 34% did. The real serviceable market was 1.84 crore, not 5.4 crore, so a 2% share is about 3.7 lakh units and the team actually beat a correctly sized plan. The answer is to resize the cost base and remove the constraint with a clamp-on variant, not to sell harder. Going direct to capture the 35% channel margin spends most of it back on fulfilment and fixed cost.",
    tags: "product management,market sizing,tam sam som,channel economics,solar,simulation",
  },
  {
    externalId: "marketplace-liquidity",
    title: "Ghar Sewa: customers waiting, professionals idle, both sides growing",
    prompt:
      "A home-services marketplace added 22% more bookings and 19% more professionals, and match rate fell from 88% to 79%. Growth wants ₹4 crore to push demand harder. Work out why adding to both sides made it worse.",
    category: "product-management",
    difficulty: "Medium",
    interviewLevel: "PM",
    type: "simulation",
    betterApproach:
      "Never read a marketplace metric at the level of the marketplace. A match happens in one zone, in one hour, for one service, so a platform-level match rate averages markets that have nothing to do with each other. Cut it by where and when before doing anything else, and put a number on what a failed request costs before comparing any two options.",
    sampleSolution:
      "79% is an average of 92% and 44%: three suburbs in the commute windows are 31% of requests and 78% of failures, because 71% of the new professionals signed up in central zones already matching at 92%. Utilisation is 31% there and 84% at peak in the deficit suburbs — idle and short at once. A failed booking costs ₹185 and a customer who repeats at 21% instead of 68%, so pushing demand 20% raises GMV about 12% and roughly triples the loss.",
    tags: "product management,marketplace,liquidity,match rate,utilisation,take rate,home services,simulation",
  },
  {
    externalId: "b2b-deal-tco",
    title: "Lekha: our most profitable customer wants 18% off",
    prompt:
      "Your largest account — 900 seats, ₹2.7 crore of ARR, 78% gross margin on the deck — wants 18% off to sign three years. Finance has just run a fully loaded cost to serve for the first time. Work out what the contract is actually worth before you answer.",
    category: "product-management",
    difficulty: "Medium",
    interviewLevel: "PM",
    type: "simulation",
    betterApproach:
      "Load every cost the account actually causes into its margin, including engineering that exists for one customer, before discussing price. Then cross the table and cost their total cost of ownership too: if most of what the product costs them is work it creates rather than what it charges, a discount is the least effective relief available and the most expensive one to give.",
    sampleSolution:
      "The 78% counts hosting only; fully loaded the account runs at 19.5%, and a third of the cost is a bespoke ERP connector booked as R&D. 40 of 900 seats drive 71% of documents and 64% of tickets while the contract charges by seat. Their own cost of ownership is ₹1.15 crore a quarter, our licence 59% of it — so 18% off relieves a tenth of their problem and takes contract contribution from ₹72 lakh to minus ₹37. Retiring the connector and repricing to metered volume relieves more than the discount would, at no cost to price.",
    tags: "product management,b2b saas,cost to serve,total cost of ownership,pricing,net revenue retention,manufacturing,simulation",
  },
];

export const achievements = [
  { slug: "first-attempt", title: "First Steps", description: "Complete your first guesstimate.", emoji: "🎯" },
  { slug: "mece-master", title: "MECE Master", description: "Score 85+ on Segmentation.", emoji: "🧩" },
  { slug: "sharp-shooter", title: "Sharp Shooter", description: "Land a final estimate within the ideal range.", emoji: "🎪" },
  { slug: "streak-3", title: "Warming Up", description: "Reach a 3-day practice streak.", emoji: "🔥" },
  { slug: "streak-7", title: "On a Roll", description: "Reach a 7-day practice streak.", emoji: "⚡" },
  { slug: "ten-solved", title: "Getting Serious", description: "Solve 10 guesstimates.", emoji: "📈" },
  { slug: "no-hints", title: "Independent Thinker", description: "Finish an attempt without using any hints.", emoji: "🧠" },
  { slug: "interview-ready", title: "Interview Ready", description: "Reach an overall score of 85+.", emoji: "🏆" },
  // Simulation track. Kept apart from the interview achievements above because
  // they are earned on a different exercise with a different rubric.
  { slug: "war-room", title: "War Room", description: "Complete your first decision simulation.", emoji: "🚨" },
  { slug: "sharp-diagnosis", title: "Sharp Diagnosis", description: "Score 85+ on Diagnosis in a simulation.", emoji: "🔎" },
  { slug: "frugal-analyst", title: "Frugal Analyst", description: "Find the cause at or under the par investigation.", emoji: "🎟️" },
  { slug: "capital-allocator", title: "Capital Allocator", description: "Score 85+ on Decision in a simulation.", emoji: "♟️" },
];
