/** India-only seed content for CASE CLOSED. All figures in Indian context / ₹. */

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
  // The analytics track. Its own category rather than more rows under Product
  // Management, for the reason Finance is its own: these scenarios are a
  // sequence teaching one discipline, and a candidate preparing for a data
  // interview should be able to find them as a set rather than pick them out of
  // sixteen. `listCategories(surface)` derives visibility from what a category
  // actually holds, so this appears on /simulations and stays off /library
  // without any further wiring.
  { slug: "data-analytics", name: "Data & Analytics", icon: "Sigma", order: 16 },
  // The operations track. Its own category for the reason Finance and Data &
  // Analytics are: these war rooms teach one discipline — where output is
  // actually decided, and what a service promise costs to keep — and a
  // candidate preparing for an operations interview should be able to find them
  // as a set rather than pick them out of a shelf of industries.
  { slug: "operations", name: "Operations", icon: "Gauge", order: 17 },
  // The supply-chain track, split from Operations rather than folded into it:
  // one is about what happens inside the four walls and the other about what
  // happens between them, and a candidate preparing for a distribution or
  // planning interview is preparing for a different conversation.
  { slug: "supply-chain", name: "Supply Chain", icon: "Truck", order: 18 },
];

export interface SeedQuestion {
  externalId: string;
  title: string;
  prompt: string;
  category: string; // slug
  /**
   * Industry the question is set in — a `SECTORS` value from `lib/types.ts`.
   *
   * Required here even though the column is nullable: an authored question
   * always knows what business it is about, and a seed that could quietly omit
   * it would leave holes in the filter that nothing catches. `tests/sectors`
   * pins every row against the vocabulary.
   */
  sector: string;
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
    sector: "consumer-goods",
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
    sector: "food-beverage",
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
  },
  {
    externalId: "autos-bangalore",
    title: "Number of auto-rickshaws in Bangalore",
    prompt: "Estimate the number of auto-rickshaws operating in Bangalore.",
    category: "transportation",
    sector: "transportation",
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
    sector: "telecom",
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
    sector: "food-beverage",
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
    sector: "food-beverage",
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
    sector: "consumer-goods",
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
    sector: "transportation",
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
    sector: "media-entertainment",
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
    sector: "education",
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
    sector: "retail",
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
    sector: "retail",
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
    sector: "healthcare",
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
    sector: "healthcare",
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
    sector: "financial-services",
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
    sector: "telecom",
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
    sector: "education",
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
    sector: "education",
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
    sector: "transportation",
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
    sector: "automotive",
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
    sector: "consumer-goods",
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
    sector: "financial-services",
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
    sector: "automotive",
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
    sector: "consumer-goods",
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

  // ── Guesstimates adapted from a campus consulting casebook ─────────────
  // Same terms as the cases further down: the estimation path is the useful
  // part and is nobody's property, the wording and the named places are
  // rewritten, and the arithmetic is re-derived rather than copied.
  //
  // These six deliberately break the mould the other 24 share. Those are all
  // national market sizes; four of these ask for the revenue of ONE named site,
  // which is the shape a candidate actually meets across a table and the shape
  // the catalogue had none of. The last two are not estimates from nothing at
  // all: the headcount one converts a volume into people through a service-time
  // calculation, and the perfume one is a constrained optimisation whose data
  // is given in the prompt and has a determinate answer.
  //
  // No data packs, following the 24 above. A guesstimate is worked from the
  // candidate's own assumptions, and an interviewer releasing anchor figures on
  // request would be answering the question for them.
  {
    externalId: "duty-free-alcohol-delhi",
    title: "Annual duty-free alcohol sales at a Delhi airport terminal",
    prompt:
      "Estimate the annual revenue from alcohol at the duty-free shop in Delhi airport's international terminal. Assume there is one shop and that only departing international passengers can use it.",
    category: "revenue-estimation",
    sector: "retail",
    difficulty: "Medium",
    interviewLevel: "BCG",
    idealLow: 5_000_000_000,
    idealHigh: 15_000_000_000,
    unit: "₹/year",
    betterApproach:
      "Reach international passengers from the supply side — runways × departures an hour × hours × days × seats × occupancy — rather than asserting a footfall, because every term there is checkable and a footfall guess is not. Then narrow twice: what share buy duty-free alcohol at all, and what share buy it here rather than at the destination shop on the way back. Finish on basket size, where the customs allowance caps bottles per head and the price reflects people trading up to make the tax saving worth having.",
    sampleSolution:
      "~2 international runways at a departure every 5 minutes ≈ 600 departures/day → ~2.1 lakh flights/year × ~250 seats × ~70% occupancy ≈ 3.7 cr passengers. Tourists buy far more than business travellers, so ~20% are in the market, and roughly half of those buy outbound rather than at the destination → ~37 lakh buyers. At ~1.5 bottles each and ~₹1,500 a bottle ≈ ₹800–900 cr a year. Illustrative, not exact.",
    tags: "duty free,airport,alcohol,revenue",
  },
  {
    externalId: "airport-fnb-revenue",
    title: "Yearly food and beverage revenue at a new Mumbai airport",
    prompt:
      "A second airport is opening near Mumbai and will take a share of the existing airport's traffic. Estimate its annual food and beverage revenue from passengers. Ignore anything earned from tickets.",
    category: "revenue-estimation",
    sector: "transportation",
    difficulty: "Medium",
    interviewLevel: "GeneralMBA",
    idealLow: 2_000_000_000,
    idealHigh: 6_000_000_000,
    unit: "₹/year",
    betterApproach:
      "List the passenger-side revenue lines before sizing any of them — food and beverage, retail rent, parking, lounges, advertising — so the interviewer can pick one and you are not caught having sized the wrong thing. For F&B, anchor on the incumbent airport's footfall and the share that diverts, narrow to passengers who actually buy, then split the basket by price point rather than averaging it: a sandwich and a sit-down meal are different decisions.",
    sampleSolution:
      "The incumbent handles ~5 cr passengers a year and ~40% divert → ~2 cr. Airport food is dear enough that only the hungry and the well-off buy, so ~20% → ~40 lakh buyers. Split ~60% snacks at ~₹150 and ~40% meals at ~₹500 ≈ ₹116 cr of food. Drinks are the trap: they typically run to about 60% of an airport F&B bill, so grossing up lands near ₹300–350 cr a year. Sizing food and stopping is how candidates come in a third light.",
    tags: "airport,food,concessions,revenue",
  },
  {
    externalId: "hypermarket-first-month",
    title: "First-month sales of a new hypermarket in south Bangalore",
    prompt:
      "A hypermarket chain is opening a store in a fast-growing south Bangalore suburb. Estimate its sales in the first month. One comparable hypermarket already trades in the same catchment.",
    category: "retail",
    sector: "retail",
    difficulty: "Medium",
    interviewLevel: "GeneralMBA",
    idealLow: 15_000_000,
    idealHigh: 50_000_000,
    unit: "₹/month",
    betterApproach:
      "Work down from the city to the catchment rather than up from the country, and filter in the order that actually removes people: area, then age, then income, saying why each cut is the right one. Convert to households before spending anything — a hypermarket trolley is filled per household, not per person, and forgetting the division inflates the answer four-fold. Then split the catchment with the incumbent, and treat month one as inflated: opening promotions and people coming once to look are real sales that do not repeat.",
    sampleSolution:
      "Bangalore ~1.3 cr across ~30 major localities → ~4 lakh in the catchment. ~50% are 18–60 (younger have no income, older shop closer to home), and ~40% of those are middle-to-high income → ~84,000 people → ~21,000 households at ~4 each. Opening offers take ~60% of them from the incumbent → ~12,600 households spending ~₹2,000–3,000 on the storable half of a grocery basket ≈ ₹2.5–4 cr in month one. Illustrative, not exact.",
    tags: "grocery,retail,households,footfall",
  },
  {
    externalId: "perfume-order-quantity",
    title: "Optimal order quantity for a luxury perfume outlet",
    prompt:
      "You run an outlet reselling luxury perfumes. You order once, at the start of the year, and the range is out of fashion by the next one — unsold bottles go back to the manufacturer at an agreed price. A bottle costs you ₹80, sells at ₹150, and is returned at ₹50. Demand is lumpy: a 20% chance of 1,000 bottles, a 50% chance of 1,500, and a 30% chance of 2,000. How many do you order?",
    category: "retail",
    sector: "retail",
    difficulty: "Hard",
    interviewLevel: "GeneralMBA",
    idealLow: 1_500,
    idealHigh: 2_000,
    unit: "bottles",
    betterApproach:
      "Name the two ways to be wrong before computing anything: order short and forgo ₹70 of margin a bottle, order long and eat ₹30 on every one returned. Because demand is discrete rather than smooth, the optimum has to sit on one of the three demand levels, so no formula is needed — work out expected profit at 1,000, 1,500 and 2,000 and compare. Resist clearing surplus stock with a sale: not discounting is precisely what a luxury brand is paying its stockists for, which is why the return-to-manufacturer clause exists.",
    sampleSolution:
      "Order 1,000 → ₹70,000 whatever demand does, since you sell out every time. Order 1,500 → ₹55,000 if demand is 1,000 (500 returned at −₹30) and ₹105,000 otherwise; expected ₹95,000. Order 2,000 → ₹40,000, ₹90,000 and ₹140,000 across the three levels; expected ₹95,000 again. The two tie on expected profit, so break the tie on something the arithmetic does not price: 2,000 never stocks out, and a luxury customer turned away is the expensive kind.",
    tags: "retail,inventory,expected value,optimisation",
  },
  {
    externalId: "delivery-support-headcount",
    title: "Customer-care executives needed by a food-delivery app in Delhi NCR",
    prompt:
      "A food-delivery app operating in Delhi NCR wants to know how many customer-care executives it needs to cover its queues around the clock, before any of the routine queries are automated away. Estimate the headcount.",
    category: "demand-estimation",
    sector: "food-beverage",
    difficulty: "Medium",
    interviewLevel: "Big4",
    idealLow: 10,
    idealHigh: 30,
    unit: "executives",
    betterApproach:
      "Two steps that are tempting to run together and shouldn't be: size the daily query volume, then convert volume into people. Volume is orders a day times the share that raise a query. People come from service time — queries in a shift × handling time ÷ the minutes one person actually has — which is why the orders have to be spread across the day first. Staffing is set by the peak, not the average, and a day averaged flat understaffs both dinner rushes.",
    sampleSolution:
      "Delhi NCR ~1.2 cr people, ~80% online, ~1% on this app ≈ 1 lakh registered, ~10% ordering on a given day ≈ 10,000 orders. Traffic follows meals, not the clock: roughly 35% / 20% / 40% / 5% across the four six-hour blocks. About 20% of orders raise a query → ~2,000 a day, ~1,100 falling in an 8am–8pm shift and ~900 overnight. At ~5 minutes a query, the day shift needs 1,100 × 5 ÷ 720 ≈ 8 on the floor and the night shift ≈ 7 — about 15 seats, before rostering cover for breaks, leave and attrition.",
    tags: "food delivery,support,staffing,capacity",
  },
  {
    externalId: "tennis-balls-bangalore",
    title: "Tennis balls sold in Bangalore per year",
    prompt:
      "Estimate how many tennis balls are sold in Bangalore in a year. Count every use they are put to, not only tennis.",
    category: "demand-estimation",
    sector: "consumer-goods",
    difficulty: "Medium",
    interviewLevel: "GeneralMBA",
    idealLow: 500_000,
    idealHigh: 4_000_000,
    unit: "tennis balls/year",
    betterApproach:
      "Go demand-side. The supply side means guessing at brands, price points and plants, and compounding the error at every step. The count is matches played divided by how many matches a ball survives, summed across uses — and in India the largest use is not tennis but street cricket, where a ball is as often lost as worn out, so its life is shorter. Split players by how often they play rather than by professional and amateur: frequency is what consumes balls, and a label does not.",
    sampleSolution:
      "Tennis: ~1.3 cr people and perhaps 0.3% playing → ~40,000 players; regulars three times a week and the rest weekly → ~64,000 sessions → ~16,000 matches a week at four a side; ~3 balls a match and ~5 matches to a ball ≈ 5 lakh a year. Street cricket: ~15 lakh males aged 8–25, ~20% playing weekly in sides of ten → ~15,000 matches a week, a ball lost or dead in ~3 → ~2.5 lakh a year. Add pets and casual play and it lands near 8–12 lakh. The total swings several times over on the play-frequency assumption, which is why the split is what gets marked, not the number.",
    tags: "cricket,sport,demand,consumption",
  },

  // ── Qualitative ────────────────────────────────────────────────────────
  // Answered with an issue tree and a recommendation rather than a number, so
  // no ideal range and no unit.
  //
  // Two shapes live here. A brainstorm case declares neither a data pack nor a
  // root cause: structure and reasoning are scored and there is no diagnosis to
  // grade, which is the EV entry case below and nothing else now. A diagnostic
  // case releases facts only when the branch is asked about and declares the
  // branch that holds the problem, so it scores Diagnosis as well — that is the
  // rest of them.
  {
    externalId: "qual-food-delivery-margin",
    title: "Falling delivery margins at a food-delivery platform",
    prompt:
      "A food-delivery platform in India has seen its per-order contribution margin fall over the last four quarters, even though order volumes are steady. Why might that be happening, and what would you look at first?",
    category: "startups",
    sector: "food-beverage",
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
  },
  {
    externalId: "qual-ev-two-wheeler-entry",
    title: "Should a two-wheeler maker enter electric scooters?",
    prompt:
      "An established Indian two-wheeler manufacturer is considering entering the electric scooter market. How would you structure the decision, and what would make you say no?",
    category: "transportation",
    sector: "automotive",
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
   * Eight qualitative cases adapted from a campus consulting casebook.
   *
   * Adapted, not reproduced: the analytical shape of an interview case is the
   * useful part and is nobody's property, but the wording and the named
   * companies are. Every prompt, better approach and sample solution here is
   * written fresh, every real organisation is replaced by an invented one, and
   * the surface figures are shifted. Nothing is quoted.
   *
   * Five carry no `framework`. The five in `lib/config/frameworks.ts` mirror the
   * casebook's own section structure, and a customer-journey, process or
   * stakeholder case is not one of them — so rather than mislabel them,
   * `detectFramework` is left to infer from what the candidate actually builds.
   * Guided mode simply has no tree to offer on those, which it handles.
   */
  {
    externalId: "qual-clinic-turnout",
    title: "Falling turnout at a city's free neighbourhood clinics",
    prompt:
      "A state health department runs 240 free Nagar Clinics across Pune, offering consultations, basic lab tests and free medicines. Eight years in, patient turnout is far below what was planned — and it is low at every clinic, not at a handful. Work out why, and say what you would do about it.",
    category: "healthcare",
    sector: "healthcare",
    difficulty: "Medium",
    interviewLevel: "Big4",
    type: "qualitative",
    expectedBuckets: [
      "Pre-visit",
      "Awareness",
      "Accessibility",
      "During the visit",
      "Doctor availability",
      "Waiting time",
      "Post-visit",
      "Reports",
      "Medicines",
      "Follow-up",
    ],
    dataPack: [
      {
        // Stems, not inflections: topics are matched as substrings of what the
        // candidate typed, so "aware" catches "are patients aware?" while
        // "awareness" would not.
        topic: ["aware", "know", "publicity", "marketing", "information"],
        fact: "Awareness is above 90% in the target population — people know the clinics exist and what they offer.",
      },
      {
        topic: ["access", "accessibility", "distance", "location", "reach", "travel"],
        fact: "The 240 clinics are spread evenly across the city; almost everyone in the target group is within a 15-minute walk of one.",
      },
      {
        topic: ["doctor", "staff", "available", "consultation", "appointment"],
        fact: "Doctors are present for the full advertised hours at nearly every clinic.",
      },
      {
        topic: ["wait", "queue", "crowd", "waiting time"],
        fact: "Median wait for a consultation is about 12 minutes, which patients rate as acceptable.",
      },
      {
        topic: ["infrastructure", "equipment", "lab", "diagnostics", "facility"],
        fact: "Lab equipment is installed and working, and samples are collected on site.",
      },
      {
        topic: ["report", "reports", "test report", "result", "turnaround"],
        fact: "Blood and imaging reports are compiled by hand and take 6 to 9 days, and the patient has to come back in person to collect them.",
      },
      {
        topic: ["medicine", "medicines", "pharmacy", "stock", "prescription"],
        fact: "Prescribed medicines are in stock and dispensed free during the same visit.",
      },
      {
        topic: ["follow up", "follow-up", "return", "retention", "repeat", "reminder"],
        fact: "There is no reminder system of any kind, so a patient who does not come back is never contacted.",
      },
      {
        topic: ["cost", "fee", "charge", "price", "pay"],
        fact: "Every service is free at the point of use — there is no fee at any stage.",
      },
      {
        topic: ["quality", "satisfaction", "trust", "perception"],
        fact: "Patients who complete a course of treatment rate the clinics highly; the problem is how few complete one.",
      },
    ],
    rootCause: {
      path: ["Post-visit", "Reports"],
      note: "Everything up to and including the consultation works. Lab reports take 6–9 days and must be collected in person, so treatment stalls after the first visit and patients do not return — the loss is entirely post-visit.",
    },
    betterApproach:
      "Walk the patient journey in order — before the visit, during it, after it — and clear each stage against evidence before moving on. A failure that is uniform across 240 clinics is systemic, which rules out explanations that would vary by location, so awareness and accessibility are worth testing early and dropping quickly. Turnout is a repeat-visit metric, so the stage most likely to be responsible is the one that decides whether anyone comes back.",
    sampleSolution:
      "Awareness, access, doctor availability, waiting time and medicine supply all check out. The break is after the visit: hand-compiled lab reports take 6–9 days and have to be collected in person, so a course of treatment stalls before it finishes and there is no reminder to pull the patient back. Digitising results so they reach patients by SMS, and adding a simple recall system that also tells them when reports are ready, addresses the stage that is actually losing them.",
    tags: "clinic,patient journey,public health,customer journey",
  },
  {
    externalId: "qual-pizza-satisfaction",
    title: "Satisfaction slipping at a wood-fired pizza kitchen",
    prompt:
      "Forno Rustica is a single wood-fired pizza kitchen in Pune doing dine-in, takeaway and delivery. Its customer satisfaction score, collected on a 1–5 scale, has fallen over the past month — but only on delivery orders. Nothing about how the score is measured has changed. Find the cause and recommend a fix.",
    category: "retail",
    sector: "food-beverage",
    difficulty: "Medium",
    interviewLevel: "Bain",
    type: "qualitative",
    expectedBuckets: [
      "Pre-ordering",
      "App and website",
      "Ordering",
      "Payment",
      "Delivery",
      "Delivery time",
      "Distance",
      "Food on arrival",
      "Rider conduct",
      "Post-delivery",
    ],
    dataPack: [
      {
        topic: ["app", "website", "ordering", "ui", "ux", "menu", "browse"],
        fact: "The app and website are unchanged this quarter, and drop-off and error rates through the ordering flow are flat.",
      },
      {
        topic: ["payment", "checkout", "upi", "card"],
        fact: "Payment failures are steady at well under 1% of orders.",
      },
      {
        topic: ["packaging", "temperature", "quality", "taste", "food", "condition"],
        fact: "Recipe and packaging are unchanged, but complaints do mention pizzas arriving lukewarm.",
      },
      {
        topic: ["rider", "delivery partner", "conduct", "behaviour", "staff"],
        fact: "Complaints about rider conduct are rare and have not increased.",
      },
      {
        topic: ["delivery time", "time", "late", "eta", "speed", "delay"],
        fact: "Average delivery time has gone from about 28 minutes to about 44 minutes over the last month.",
      },
      {
        topic: ["distance", "radius", "area", "geography", "location", "where"],
        fact: "Average delivery distance is up sharply — orders now come in from roughly twice the earlier radius.",
      },
      {
        topic: ["kitchen", "prep", "capacity", "oven", "dispatch", "cooking"],
        fact: "Prep time per pizza is unchanged and the oven is not a bottleneck.",
      },
      {
        topic: ["demand", "orders", "volume", "popularity", "marketing", "promotion"],
        fact: "Order volume is up about 35% this month. Several local food influencers posted about the place.",
      },
      {
        topic: ["competition", "competitor", "rival", "new entrant"],
        fact: "No competitor has opened or closed nearby during the period.",
      },
      {
        topic: ["dine-in", "dine in", "takeaway", "segment", "channel"],
        fact: "Dine-in and takeaway satisfaction scores are unchanged.",
      },
      {
        topic: ["promise", "expectation", "advertised", "eta shown"],
        fact: "The delivery time promised at checkout has not been updated since the kitchen opened.",
      },
    ],
    rootCause: {
      path: ["Delivery", "Distance"],
      note: "Ordering, payment, rider conduct and the food itself are unchanged. Influencer posts widened the catchment, so the average delivery distance roughly doubled; delivery time rose from 28 to 44 minutes against an unchanged promise, and the pizza arrives lukewarm. Popularity, not a service failure, is what broke the score.",
    },
    betterApproach:
      "Split the order into pre-ordering, ordering, delivery and post-delivery, and use the fact that only delivery scores moved to discard three of them quickly. Inside delivery, ask how, when, where and by whom before guessing. When time turns out to be the problem, remember it is distance over speed against a promised figure — so check whether the promise moved, whether speed fell, or whether the distance grew, rather than assuming the operation got worse.",
    sampleSolution:
      "Nothing in the kitchen or the app changed. Influencer coverage widened the catchment, so orders started arriving from about twice the radius; distance drove delivery time from 28 to 44 minutes against a promise nobody updated, and a wood-fired pizza travelling that far arrives lukewarm. This is a success failure, and the fixes follow from that: cap the delivery radius or reprice distant orders, reset the quoted time so expectations match reality, and compensate the customers already affected. Over a longer horizon the real answer is capacity closer to the new demand — a second outlet or a cloud kitchen in the high-demand pockets.",
    tags: "customer journey,restaurant,delivery,satisfaction",
  },
  {
    externalId: "qual-sfb-universal-licence",
    title: "A small finance bank steps up to a universal licence",
    prompt:
      "Uttara Small Finance Bank has met every RBI condition to convert into a universal bank. The board wants an asset-liability strategy for the transition: what it should lend, how it should fund itself, and what it should stay away from.",
    category: "finance",
    sector: "financial-services",
    difficulty: "Medium",
    interviewLevel: "BCG",
    type: "qualitative",
    framework: "growth",
    expectedBuckets: [
      "Assets",
      "Loans",
      "Investments",
      "Liabilities",
      "Deposits",
      "Borrowings",
      "Existing customers",
      "New customers",
      "Due diligence",
      "Risk",
    ],
    dataPack: [
      {
        topic: ["portfolio", "book", "existing", "mix", "current lending"],
        fact: "The book is roughly 45% MSME, a large microfinance portfolio lent to self-help groups in unbanked rural districts, and a small home-loan book.",
      },
      {
        topic: ["rationale", "objective", "why", "reason", "priority sector"],
        fact: "The board's stated reasons are to escape the priority-sector lending floor that binds small finance banks, and to widen the footprint beyond its home states.",
      },
      {
        topic: ["deposit", "casa", "savings", "current account", "fixed deposit", "funding"],
        fact: "Deposits are overwhelmingly term deposits priced above what the large banks pay; the CASA share is thin.",
      },
      {
        topic: ["borrowing", "refinance", "wholesale", "market borrowing"],
        fact: "Refinance lines from development institutions fund about a fifth of the book and cost more than retail deposits.",
      },
      {
        topic: ["npa", "default", "asset quality", "provision", "delinquency"],
        fact: "Gross NPAs are near 2.4%, concentrated in the unsecured microfinance book.",
      },
      {
        topic: ["vehicle", "auto loan", "education loan", "personal loan", "new product"],
        fact: "The bank has never underwritten vehicle, education or personal loans and has no scorecard for any of them.",
      },
      {
        topic: ["agent", "branch", "distribution", "network", "reach", "channel"],
        fact: "It has a dense field-agent network across rural districts and very few urban branches.",
      },
      {
        topic: ["agriculture", "farm", "agri", "rural credit"],
        fact: "Agricultural credit in its districts is still largely informal — moneylenders rather than banks.",
      },
      {
        topic: ["capital", "adequacy", "profit", "solvency"],
        fact: "Capital adequacy is comfortably above the regulatory floor and the bank has been profitable for five consecutive years.",
      },
      {
        topic: ["home loan", "mortgage", "housing"],
        fact: "The home-loan book is small but its losses have been negligible, and demand in its districts is unmet.",
      },
    ],
    betterApproach:
      "Take the balance sheet as the structure — assets on one side, liabilities on the other — and treat the licence as a change in what is allowed on each, not as a growth wish list. On assets, separate what can be sold to existing customers from what needs a new customer entirely, because the first rides on distribution the bank already has and the second does not. On liabilities, remember that a universal licence is mostly a funding opportunity. Then test each candidate product against the capability it actually requires.",
    sampleSolution:
      "The transferable asset is distribution: a dense rural agent network, MSME underwriting experience and a self-help-group relationship base. Agricultural credit and larger MSME lending extend that directly, and the small home-loan book is the natural third leg given its loss record. Vehicle, education and personal loans are the ones to refuse for now — they need scorecards and collection machinery the bank has never built, they do not bundle with anything it already sells, and its NPAs are already concentrated in unsecured lending. The bigger prize is on the liability side: a universal licence opens current accounts and cheaper deposits, and replacing costly refinance with CASA does more for the margin than any new loan product would.",
    tags: "banking,asset liability,lending,growth",
  },
  {
    externalId: "qual-foreign-campus-policy",
    title: "Bringing foreign university campuses to an Indian state",
    prompt:
      "A western Indian state wants international universities to open campuses within its borders over the next six to seven years, and is offering subsidised land, capital support and an operating subsidy for the early years. Advise the government on how to go about it — and on what a university would need to see before it says yes.",
    category: "education",
    sector: "education",
    difficulty: "Medium",
    interviewLevel: "GeneralMBA",
    type: "qualitative",
    framework: "market-entry",
    expectedBuckets: [
      "Need-delivery gap",
      "Higher education",
      "Skill education",
      "Financial feasibility",
      "Revenue",
      "Cost",
      "Operational feasibility",
      "Fit of the provider",
      "Risks",
      "Benchmarking",
    ],
    dataPack: [
      {
        // "quality" belongs to the metrics entry below, not here: on a tie in
        // topic length `factFor` keeps the first match, so listing it twice
        // answered "how do you measure quality?" with the project's rationale.
        topic: ["objective", "rationale", "why", "goal", "capacity"],
        fact: "The state's aim is quality rather than capacity — it believes international providers raise the standard of what is taught.",
      },
      {
        topic: ["timeline", "when", "horizon", "deadline"],
        fact: "The government wants the first campuses operating within six to seven years.",
      },
      {
        topic: ["incentive", "subsidy", "support", "land", "grant"],
        fact: "On offer: subsidised land, capital support for construction, and an operating subsidy for the first few years.",
      },
      {
        topic: ["gap", "need", "shortage", "supply", "demand", "benchmark"],
        fact: "Benchmarked against comparable states, the shortfall is concentrated in higher education and skill-based training rather than in schools.",
      },
      {
        topic: ["quality", "metric", "outcome", "enrolment", "pass rate", "ratio", "curriculum"],
        fact: "The metrics the state tracks are enrolment rates, student-teacher ratio, pass rates, employability in international job markets, and curriculum standard.",
      },
      {
        topic: ["revenue", "fee", "tuition", "students", "willingness", "afford"],
        fact: "Roughly one student in twelve in the state can afford international-tier fees, and that share is growing.",
      },
      {
        topic: ["cost", "fixed cost", "setup", "infrastructure", "salary", "licence", "faculty"],
        fact: "Setup costs are dominated by land, buildings and faculty salaries; recurring costs are course material, amenities and licensing.",
      },
      {
        topic: ["margin", "payback", "roi", "return", "profitability"],
        fact: "Providers modelling the opportunity expect about a 20% margin and an eleven-year payback.",
      },
      {
        topic: ["compet", "other states", "alternative", "rival", "hub"],
        fact: "Two neighbouring states and several offshore education hubs are courting the same universities with comparable packages.",
      },
      {
        topic: ["risk", "regulation", "legal", "political", "social", "visa"],
        fact: "Faculty visas, degree-recognition rules and repatriation of surplus are the three issues providers raise most often.",
      },
      {
        topic: ["product mix", "segment", "level", "school", "college"],
        fact: "The state is open to any level, but school-stage provision is already adequate on its own benchmarks.",
      },
    ],
    betterApproach:
      "This is a market entry seen from the wrong side of the table: the state is not entering anything, so structure it as the entry decision the university will make and ask what the state can change about it. Establish the gap first, because a subsidy aimed at a segment that is already served buys nothing. Then take financial and operational feasibility from the provider's point of view, and finish on the risks — a payback that long is decided by political and legal stability as much as by the numbers.",
    sampleSolution:
      "Start by locating the gap: schools are adequately served on the state's own benchmarks, so the target is higher education and skill-based training, and the incentives should be conditioned on those rather than offered flat. From the provider's side an eleven-year payback at a 20% margin is not obviously good or bad — it is only meaningful against what the neighbouring states and offshore hubs offer, so benchmarking is the analysis that decides the answer. Because the payback runs beyond a decade, the differentiator is rarely the money: it is degree recognition, faculty visas and the right to repatriate surplus. Fixing those is cheaper than outbidding a neighbour and is the part a government is uniquely able to offer.",
    tags: "education,students,market entry,policy",
  },
  {
    externalId: "qual-football-club-revenue",
    title: "Mapping the revenue streams of a football club",
    prompt:
      "Konkan City FC plays in India's top domestic football league. Its owners want a complete map of where the club's money comes from, and an honest read on where there is room to grow it. Assume a normal season with no disruption to attendance.",
    category: "revenue-estimation",
    sector: "media-entertainment",
    difficulty: "Easy",
    interviewLevel: "Bain",
    type: "qualitative",
    framework: "growth",
    expectedBuckets: [
      "Matchday",
      "Ticket sales",
      "Stadium capacity",
      "Occupancy",
      "Broadcasting",
      "Viewership",
      "Commercial",
      "Sponsorship",
      "Merchandising",
      "Transfers",
      "Prize money",
    ],
    dataPack: [
      {
        topic: ["ticket", "matchday", "gate", "attendance", "occupancy"],
        fact: "Home matches run at 96–99% occupancy, so there is almost no headroom left in the current stadium.",
      },
      {
        topic: ["price", "ticket price", "pricing"],
        fact: "Ticket prices are already the highest in the league, and the team finished mid-table last season.",
      },
      {
        topic: ["matches", "fixtures", "games", "season", "number of matches"],
        fact: "The league guarantees 11 home fixtures. Anything beyond that has to be earned by progressing in cup competitions.",
      },
      {
        topic: ["capacity", "stadium", "expansion", "seats"],
        fact: "The stadium seats about 22,000. Expanding it is possible but needs a large capital outlay and municipal clearance.",
      },
      {
        topic: ["broadcast", "tv", "rights", "media", "streaming"],
        fact: "Broadcast money is negotiated centrally by the league and split by a fixed formula — the club cannot sell its own rights.",
      },
      {
        topic: ["viewership", "audience", "slot", "timing", "schedule"],
        fact: "Viewership turns on the opponent and the kick-off slot, both of which the league's scheduler controls.",
      },
      {
        topic: ["sponsor", "sponsorship", "partnership", "brand", "commercial", "shirt"],
        fact: "Shirt and stadium sponsorship are locked in for two more seasons. Pre-season tours and brand shoots are not.",
      },
      {
        topic: ["merchandise", "merchandising", "kit", "jersey", "retail"],
        fact: "Merchandising is licensed to a third party for a flat fee rather than a revenue share.",
      },
      {
        topic: ["transfer", "transfers", "player", "scouting", "academy", "loan"],
        fact: "Net transfer spend has been negative for three seasons — the club buys more than it sells — and the academy has produced one first-team player in five years.",
      },
      {
        topic: ["prize", "prize money", "trophy", "league position", "performance"],
        fact: "Prize money scales steeply with final league position and cup progress.",
      },
    ],
    betterApproach:
      "List every stream before decomposing any of them, and check the list is complete before going deep — matchday, broadcasting, commercial, transfers and prize money is the usual spine. Then decompose one at a time into things that can actually be moved: tickets are capacity times occupancy times price times number of matches, and it is worth asking which of those four the club controls at all. A stream the league negotiates centrally is context, not a lever.",
    sampleSolution:
      "Matchday is close to maxed out: occupancy is at 96–99%, prices already lead the league, and the fixture count is fixed, so the only real lever is capacity — which means capital and clearances. Broadcasting is set centrally and effectively out of the club's hands. That pushes the answer toward the streams the club still controls: renegotiating merchandising off a flat licence fee onto a revenue share, monetising pre-season and brand work while the shirt deal is locked, and treating recruitment as a revenue line rather than a cost — better scouting and a functioning academy turn three seasons of negative net transfer spend around. Prize money ties all of it back to performance on the pitch.",
    tags: "revenue streams,stadium,sponsorship,broadcasting",
  },
  {
    externalId: "qual-airline-otp",
    title: "On-time performance at a newly privatised airline",
    prompt:
      "Bharat Air was privatised last year. It runs on-time performance of about 62% while its private competitors sit near 91%, and the gap shows up on domestic and international routes alike. Find where the time is going, and recommend fixes for this quarter and for the next three years.",
    category: "transportation",
    sector: "transportation",
    difficulty: "Medium",
    interviewLevel: "GeneralMBA",
    type: "qualitative",
    expectedBuckets: [
      "Before landing",
      "During landing",
      "Turnaround",
      "Deplaning",
      "Cleaning and maintenance",
      "Refuelling",
      "Boarding",
      "Take-off",
      "Crew",
    ],
    dataPack: [
      {
        topic: ["definition", "otp", "measure", "metric", "on-time"],
        fact: "On-time performance counts flights arriving and departing within 15 minutes of schedule.",
      },
      {
        topic: ["route", "region", "domestic", "international", "network", "segment"],
        fact: "The shortfall is uniform — no region, route type or time of day stands out.",
      },
      {
        topic: ["air traffic", "congestion", "atc", "slot", "runway", "landing strip"],
        fact: "Slot and runway allocation is set by the airports, and competitors flying the same slots manage 91%.",
      },
      {
        topic: ["taxi", "gate", "aerobridge", "bus", "stand"],
        fact: "Only about a third of arrivals get an aerobridge; the rest use buses, which adds 6 to 8 minutes at each end.",
      },
      {
        topic: ["deplaning", "disembark", "passenger", "luggage", "cabin bag"],
        fact: "Cabin-baggage limits are not enforced at the gate, and deplaning runs slow because of the volume of bags in the cabin.",
      },
      {
        topic: ["boarding", "zone", "sequence", "gate process"],
        fact: "Boarding is unzoned and takes about 9 minutes longer than the competitor benchmark.",
      },
      {
        topic: ["cleaning", "maintenance", "servicing", "turnaround", "outsourced", "contract"],
        fact: "Cleaning and light maintenance are outsourced on a contract with no turnaround-time penalty, and the median clean overruns its slot by 11 minutes.",
      },
      {
        topic: ["refuel", "refuelling", "fuel"],
        fact: "Refuelling is on the critical path only for quick turnarounds and is broadly on benchmark.",
      },
      {
        topic: ["crew", "pilot", "staff", "roster", "reporting"],
        fact: "Crew reporting is the single largest cause of first-departure delay in the morning bank, and the roster carries no buffer.",
      },
      {
        topic: ["fleet", "aircraft", "age", "technical", "cancellation"],
        fact: "Fleet age and technical cancellations are in line with competitors.",
      },
    ],
    rootCause: {
      path: ["Turnaround", "Boarding"],
      note: "Nothing off the aircraft explains it: competitors fly the same slots and hold 91%, and the fleet is comparable. The time is lost on the ground — unzoned boarding running 9 minutes long, unenforced cabin baggage slowing deplaning, and an outsourced clean with no time penalty overrunning by 11. A delay that is uniform across the network is a process failure, not a route problem.",
    },
    betterApproach:
      "Treat one aircraft as a loop rather than a flight — approach, landing, taxi, deplaning, servicing, boarding, take-off — and walk it in order, because a delay anywhere in the loop propagates through the day. Test the external explanations first and be willing to discard them: if competitors fly the same slots and airports, congestion cannot account for a 29-point gap. That leaves the ground, where the airline controls its own process, and the question becomes which stage is off benchmark and by how much.",
    sampleSolution:
      "Slots, airports and fleet are shared with competitors who manage 91%, so the loss is on the ground. Three stages are off benchmark: boarding runs about 9 minutes long because it is unzoned, deplaning drags because cabin-baggage limits are not enforced, and the outsourced clean overruns by 11 minutes under a contract with no time penalty. Crew reporting compounds it by starting the morning bank late with no roster buffer. The near-term fixes are cheap and process-level — zoned boarding, gate enforcement of cabin bags, a turnaround-time penalty written into the ground-handling contract, and buffer in the crew roster. The longer-term ones cost money: more aerobridge access and enough crew depth that a single absence does not delay a departure.",
    tags: "airline,operations,turnaround,process",
  },
  {
    externalId: "qual-partner-running-late",
    title: "The partner who was late",
    prompt:
      "A senior partner at your firm — someone who is never late — walked into a client meeting well behind schedule this morning. A colleague wants to work out what happened, without asking the partner directly and without embarrassing anybody. How would you narrow it down?",
    category: "transportation",
    sector: "transportation",
    difficulty: "Hard",
    interviewLevel: "BCG",
    type: "qualitative",
    expectedBuckets: [
      "Before the commute",
      // "During the commute", not "Commute" — and the root-cause path below uses
      // the same wording for the same reason. `labelMatches` matches runs of
      // whole words in either direction, so a bare "Commute" is also contained
      // in "Before the commute", and a candidate who correctly eliminated that
      // sibling was recorded as having cleared the branch holding the answer.
      "During the commute",
      "After arriving",
      "Internal causes",
      "External causes",
      "Vehicle",
      "Driver",
      "Route",
      "Stoppages",
    ],
    dataPack: [
      {
        topic: ["home", "weekend", "morning", "before", "personal", "family"],
        fact: "He left home at the usual time this morning, and nothing unusual happened over the weekend.",
      },
      {
        topic: ["office", "building", "lift", "floor", "compound", "arrival"],
        fact: "He was seen entering the building only a few minutes before he walked into the room, so whatever happened, happened before he arrived.",
      },
      {
        topic: ["traffic", "accident", "external", "news", "road", "weather", "congestion"],
        fact: "No accident, closure or unusual congestion was reported on any route into the district this morning.",
      },
      {
        topic: ["car", "vehicle", "breakdown", "internal"],
        fact: "The car is new, bought a few months ago after his promotion, and gave no trouble.",
      },
      {
        topic: ["driver", "chauffeur"],
        fact: "The same driver has worked for him for the last seven years and reported for duty on time.",
      },
      {
        topic: ["route", "detour", "path", "way"],
        fact: "The route was the usual one: home, then a coffee-chain outlet, then his daughter's school, then the office.",
      },
      {
        topic: ["stoppage", "stoppages", "stop", "halt", "waiting"],
        fact: "The stop at the coffee outlet normally takes about 10 minutes. Today it took 35. Every other stop took its usual time.",
      },
      {
        topic: ["queue", "order", "service", "staff", "payment", "counter"],
        fact: "The queue was normal, service was not slow, and the order was placed and collected without any trouble.",
      },
      {
        topic: ["incident", "argument", "dispute", "acquaintance", "after ordering", "customer"],
        fact: "His daughter went inside with him today, which she does not usually do, and there was an incident with another customer that took a while to settle.",
      },
      {
        topic: ["school", "daughter", "drop"],
        fact: "The school drop took its usual few minutes.",
      },
      {
        topic: ["ask", "enquire", "who", "source", "information"],
        fact: "The driver is approachable and talks freely. Asking the partner's own team would get back to him within the hour.",
      },
    ],
    rootCause: {
      path: ["During the commute", "Stoppages"],
      note: "Not before the commute and not after arriving: he left on time and reached the building minutes before the meeting. Nothing external was reported, and the car and driver are both ruled out. The whole delay sits in one stoppage — the coffee stop ran 35 minutes instead of 10, because his daughter was with him and an incident with another customer had to be settled.",
    },
    betterApproach:
      "Bracket the time first — before the commute, during it, after arriving — because that costs one question and eliminates two thirds of the space. Then split causes into external and internal, since external ones can be checked without talking to anybody. What makes this case unusual is that the information has a source and the source has feelings: work out who can be asked, in what order, and how, before deciding what to ask. Keep the tone conversational; the interviewer is playing a colleague, not setting an exam.",
    sampleSolution:
      "He left home on time and reached the building minutes before the meeting, so the delay is inside the commute. Nothing external was reported, and the car is new and the driver long-serving, which clears the internal mechanical branch and leaves route and stoppages. The route was unchanged, and one stoppage explains the whole gap: the coffee stop ran 35 minutes against a usual 10, because his daughter came inside with him and an incident with another customer had to be settled. The transferable lesson is about sourcing, not structure — the driver could be asked without the question ever reaching the partner, and the team could not.",
    tags: "structured problem solving,commute,hypothesis,elimination",
  },
  {
    externalId: "qual-fmcg-sustainability",
    title: "Sustainability strategy for an FMCG major",
    prompt:
      "You are the chief sustainability officer at Sundara Foods, an Indian food-processing FMCG company. The board wants a plan to cut the carbon footprint of the business — quick wins this financial year, and a serious programme over five years. Sundara owns only the manufacturing step; farmers, aggregators, distributors and retailers are all separate parties.",
    category: "consumer-goods",
    sector: "consumer-goods",
    difficulty: "Hard",
    interviewLevel: "GeneralMBA",
    type: "qualitative",
    expectedBuckets: [
      "Value chain",
      "Farming and raw material",
      "Manufacturing",
      "Transport and storage",
      "Retail",
      "Stakeholders",
      "Customers",
      "Investors",
      "Government",
      "Value chain partners",
    ],
    dataPack: [
      {
        // Deliberately NOT "carbon" or "emissions". `factFor` returns the
        // LONGEST matched topic, so a generic word that appears in half the
        // questions about this case would answer "where do the emissions come
        // from?" with the definition of the exercise.
        topic: ["scope", "definition", "sustainability", "objective", "mean by"],
        fact: "For this exercise sustainability means carbon — the board is asking about CO2-equivalent emissions, not water or packaging waste.",
      },
      {
        topic: ["timeframe", "short term", "long term", "horizon", "when"],
        fact: "Short term means the current financial year. Long term means a five-year horizon.",
      },
      {
        topic: ["total", "footprint", "baseline", "how much", "quantum"],
        fact: "Sundara's footprint is about 1.7 million tonnes of CO2 equivalent a year across the chain it sells through.",
      },
      {
        topic: ["split", "breakdown", "stage", "contribution", "where", "biggest"],
        fact: "Roughly 32% comes from farming and raw-material aggregation, 12% from manufacturing, 16% from transport, 18% from retail, and the rest from storage.",
      },
      {
        topic: ["control", "ownership", "own", "operate", "boundary"],
        fact: "Sundara owns the manufacturing step only. Every other stage is contracted to a separate party.",
      },
      {
        topic: ["customer", "consumer", "demand", "green", "provenance", "premium"],
        fact: "A growing segment of buyers asks about provenance and per-product footprint, and a small price premium is achievable where it can be proven.",
      },
      {
        topic: ["investor", "shareholder", "lender", "esg", "capital", "impact"],
        fact: "Two of Sundara's largest lenders now price debt against ESG disclosure, and impact funds screen on it before investing.",
      },
      {
        topic: ["government", "regulation", "policy", "cap and trade", "credit", "tax"],
        fact: "Several states are moving to cap-and-trade schemes, under which a company that stays below its cap can sell the balance.",
      },
      {
        // "measure" rather than "measurement": topics are matched as substrings
        // of what the candidate typed, so the shorter stem catches "measured",
        // "measuring" and "measurement" alike.
        topic: ["measure", "track", "data", "monitoring", "report", "audit"],
        fact: "Nothing today logs emissions as goods move between the parties — each partner reports its own number, in its own format, once a year.",
      },
      {
        topic: ["supplier", "farmer", "partner", "incentive", "procurement", "contract"],
        fact: "Supplier contracts are annual and price-only; nothing in them references emissions.",
      },
      {
        topic: ["employee", "staff", "workforce", "culture"],
        fact: "There is no internal sustainability team beyond the CSO; the role was created this year.",
      },
    ],
    betterApproach:
      "Pin down what is being asked before structuring anything: sustainability means several different things, and short and long term mean nothing until someone gives you dates. Then run two passes rather than one. The value chain tells you where the emissions physically are; the stakeholder view tells you which of those you can actually move, and what each party would want in return. The gap between the two is the strategy — and note early that owning 12% of the footprint means almost every lever runs through somebody else's contract.",
    sampleSolution:
      "Manufacturing is only 12% of the footprint, so a plan confined to Sundara's own operations cannot succeed — roughly nine tenths of the problem sits with farmers, hauliers, warehouses and retailers, and the only instrument reaching them is the contract. The quick win is therefore measurement, not abatement: nothing currently logs emissions as goods change hands, and a central per-product ledger is achievable this financial year and unlocks everything else. It also pays for itself three ways, which is what makes it fundable — customers pay a small premium for provenance they can verify, two large lenders already price debt against ESG disclosure, and verified numbers are the precondition for selling surplus allowances under the state cap-and-trade schemes now arriving. The five-year programme then follows: emissions clauses and incentives written into supplier contracts at renewal, starting with farming and aggregation where a third of the footprint sits.",
    tags: "sustainability,carbon,value chain,stakeholders",
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
    sector: "food-beverage",
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
    sector: "food-beverage",
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
  },
  {
    externalId: "ab-test-readout",
    title: "Rangoli: the test says +6%, and the room wants it live on Monday",
    prompt:
      "An A/B test on the product page came back at +6% conversion, properly powered and signed off by data science. Design wants it live on Monday. Work out what the test actually measured before you ship it, then spend a month acting on what you find.",
    // The analytics track's first rung. Filed here rather than under Product
    // Management because reading an experiment is the discipline the rest of
    // the track builds on, and it was the only statistical scenario in the
    // catalogue before the track existed.
    category: "data-analytics",
    sector: "retail",
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
    externalId: "sahyog-agency-recovery",
    title: "Sahyog Finance: the best agency got 60% of the book, and recovery fell",
    prompt:
      "One of four collections agencies recovers eight points better than the others, so ops moved 60% of the overdue book to it. Recovery then went down. Work out what that league table was really measuring, then spend a month acting on it.",
    category: "data-analytics",
    sector: "financial-services",
    difficulty: "Easy",
    interviewLevel: "PM",
    type: "simulation",
    betterApproach:
      "Before you act on a difference between group averages, ask whether the groups were comparable at all. Find the variable that best predicts the outcome, and check whether it is spread evenly across the groups. If it is not, redo the comparison holding that variable fixed. Then set the gap you find against how much a single group bounces on its own. A difference smaller than the noise inside one group is not one you can act on. That is exactly what an ANOVA checks.",
    sampleSolution:
      "Recovery is decided by how old the arrear is: 60.9% at 0–30 days against 11.1% at 90-plus. That 49.8-point spread belongs to the bucket, not the collector. New arrears had gone to Shreeji since 2022, under a rule nobody revisited. So 42% of its book sat in the 0–30 bucket, against 24–27% for the others. Take the pooled bucket rates and apply each agency's own mix. The league table comes back exactly: 33.2%, 35.1%, 41.4%, 33.5%, with every agency performing the same. Inside one bucket the four land within 1.6 points, while one agency's own monthly swing is 2.8 points. So the variation between agencies is smaller than the variation within one of them. Moving 60% of the book therefore bought a mix, not a skill. Accounts per officer rose 68%, contact rate fell 59.4% → 51.8%, and recovery went 35.6% → 33.8%. Fix it with a like-for-like allocation, and by working the 0–30 bucket before it rolls. Moving the rest of the book to Shreeji is the worst option on the board.",
    tags: "data analytics,anova,variance,confounding,segmentation,collections,nbfc,lending,statistics,simulation",
  },
  {
    externalId: "chalo-multiple-comparisons",
    title: "Chalo Fitness: fourteen ways to read one test, and the one that said yes",
    prompt:
      "A home-screen redesign shipped on a +11.3% booking-rate win in one segment. Three months on, churn is up and contribution is down ₹9 lakh a month. Work out what that result was really worth, then spend a month acting on it.",
    category: "data-analytics",
    sector: "technology",
    difficulty: "Easy",
    interviewLevel: "PM",
    type: "simulation",
    betterApproach:
      "Ask how many comparisons produced the number before you ask whether the number is significant. A p-value's guarantee holds for one question chosen in advance, and it weakens fast as you add more. So divide the threshold by the number of comparisons, and see whether the result still passes. Check whether the end date was fixed before the test or after the result. Then ask the question nobody asks: on the metric that came back flat, did the test have the power to find anything? 'Not significant' and 'no effect' are different statements, and the second is a claim the data usually cannot support.",
    sampleSolution:
      "The experiment was clean: one change, randomised, correctly instrumented. The reading was not. The primary metric came back flat. So the team cut the data fourteen ways and reported the one cell that crossed. That was booking rate among 25–34s on Android in metros: +11.3%, p = 0.032. Fourteen comparisons at a 5% threshold carry a 51% chance of at least one false positive (1 − 0.95¹⁴). A corrected bar would be 0.05 ÷ 14 = 0.0036. The test was also stopped on day 9 against a written 21-day plan, the afternoon it first crossed. By day 12 the cell was back above 0.05. A pre-registered replication returned +0.4%, CI −3.1% to +3.9%. The mirror error is the expensive one. 30-day retention came back −1.8% at p = 0.19, and everyone treated that as 'no effect'. But the test could only detect 3%, and the same design clears significance at 45 days. The mechanism was the streak widget going to the top of the screen and pushing the class browser two taps down. Week-1 booking fell 51% → 46%, and week-1 bookers reach day 90 at 68% against 31%. Churn went 5.6% → 6.2%, so the base fell 8.9% through joiners ÷ churn. Building more of the widget is the worst option on the board, because an attended class costs ₹96 and does not make anyone renew.",
    tags: "data analytics,experimentation,multiple comparisons,p-hacking,bonferroni,statistical power,optional stopping,churn,subscription,fitness,simulation",
  },
  {
    externalId: "kavach-fraud-threshold",
    title: "Kavach Pay: the model is 99.4% accurate, and payment success is falling",
    prompt:
      "A fraud model shipped on 99.4% accuracy and 94% precision. Six months on, fraud losses have barely moved, payment success has fallen and merchants are routing volume away. Work out what those numbers were measuring, then spend a month acting on it.",
    // The analytics track's fourth rung, and the one the ladder in CHANGES.md
    // entry 16 named next. Filed here rather than under Finance despite the
    // payments setting, for the same reason Rangoli is: the technique is what
    // is being taught, and the industry is where it happens to be taught.
    category: "data-analytics",
    sector: "financial-services",
    difficulty: "Easy",
    interviewLevel: "PM",
    type: "simulation",
    betterApproach:
      "Ask what the base rate is before you read any classifier metric. When the thing you are looking for is rare, every metric that includes the true-negative box goes blind — accuracy most of all, and a model that flags nothing will often beat a real one on it. So take the confusion matrix apart: precision and recall separately, measured on production traffic rather than a rebalanced holdout, because precision is the one headline metric that moves with prevalence. Then price both kinds of error in rupees, since the threshold is a business decision and cannot be chosen without them. And check whether a flag has to mean allow or decline, because a third action changes what an error costs rather than how many you make.",
    sampleSolution:
      "Fraud is 0.06% of transactions, so accuracy is measuring the 1.97 crore true negatives and nothing else. The model scores 99.41%; a model that flagged nothing would score 99.94%, so the metric the launch was approved on ranks it below doing nothing. Underneath: 4,524 frauds caught against 1,09,055 genuine payments declined — precision 4.0%, and 24.1 customers blocked per fraudster stopped. The 94% in the deck was measured on a holdout rebalanced to 50/50, and precision is the one metric that cannot be carried across a rebalanced set, though recall and specificity can. The costs were wrong the other way: the room worked from the ₹4,200 average ticket, but Kavach carries ₹1,180 after recovery, against ₹85 to handle a decline — so the declines were already the larger line, ₹92.7 lakh against ₹87.1 lakh. Raising recall to 62% is therefore the worst option on the board: it saves ₹33.7 lakh of fraud and spends ₹1.30 crore handling declines. Calibrate so a score is a probability, cut at the cost-optimal point around 0.90, and challenge the mid band with an OTP instead of declining it — the only lever that raises recall and cuts hard declines at once. Contribution goes from ₹1.27 crore a month to about ₹1.80 crore.",
    tags: "data analytics,classification,confusion matrix,precision,recall,base rate,class imbalance,threshold,calibration,fraud detection,upi,payments,simulation",
  },
  {
    externalId: "vyapar-mitra-activation",
    title: "Vyapar Mitra: 38% more signups and the same 11,000 paying shops",
    prompt:
      "A billing app for small shops ran a ₹1.4 crore campaign, lifted installs 38% at a flat cost per install, and added almost no paying customers. The CEO wants to double the campaign; the head of sales wants to cut the price. Work out where the people are going, then spend a month acting on it.",
    category: "product-management",
    sector: "technology",
    difficulty: "Easy",
    interviewLevel: "PM",
    type: "simulation",
    betterApproach:
      "Before buying more of the top of a funnel, measure what share of it reaches the bottom — and then ask a second question most people skip: is any step downstream already full? Rates multiply, ceilings do not, so a number that refuses to move under a 38% increase is usually a capacity problem rather than a conversion one. Split conversion by segment rather than reading it blended, and separate a compliance requirement from the product decision wrapped around it: the law says what must be true of a filed invoice, not what must be true before somebody may open the app.",
    sampleSolution:
      "Onboarding blocks the first invoice behind a GST number and a photographed registration certificate that a human must approve, and both halves bind. Only 6,300 of 17,500 installs submit anything, and a four-person team approves about 4,200 a month — so activation is the smaller of the two and has been pinned at 4,200 for a year. Approved shops convert at 22%, everyone else at 0.8%, so 24% of installs produce 90% of paying customers. The campaign lifted installs 38% and submissions 38%, approvals by nothing, and a base that settles at joiners ÷ churn moved 10,590 → 11,000 while marketing spend rose 41%. Cutting the price to ₹199 lifts conversion 3.1 points and cuts ARPU 33.4% — more customers, less money — and a setup walkthrough sends more applicants at a queue that already turns 2,100 away. Letting shops raise draft invoices first and verifying the GSTIN against the API instead of by hand takes activation from 24% to about 59% and contribution from ₹6.66 lakh a month to ₹23.6 lakh.",
    tags: "product management,activation,onboarding,funnel,bottleneck,capacity,conversion,churn,saas,kirana,gst,simulation",
  },
  {
    externalId: "subscription-ltv-cac",
    title: "Padhai Plus: 18,000 new subscribers a month, and a bigger hole",
    prompt:
      "A test-prep subscription adds 18,000 members a month, reports an LTV:CAC of 4.6 and burns ₹34 lakh a month anyway. Find out why the ratios look healthy while the business doesn't, then spend a quarter fixing it.",
    category: "product-management",
    sector: "education",
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
    sector: "food-beverage",
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
    sector: "consumer-goods",
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
    sector: "energy",
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
    sector: "technology",
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
    externalId: "setu-roadmap-value",
    title: "Setu: three quarters of shipping the most-requested features, and NRR at 94%",
    prompt:
      "A logistics software company ranked its roadmap by how many accounts asked for each item, shipped down that list with 91% on-time delivery for three quarters, and watched net revenue retention fall from 103% to 94%. The CEO wants a public feature-voting portal; engineering wants six more people. Work out what the request queue was actually measuring, then spend a quarter acting on it.",
    category: "product-management",
    sector: "technology",
    difficulty: "Medium",
    interviewLevel: "Product",
    type: "simulation",
    betterApproach:
      "Rank work by the revenue at risk behind a request rather than by how many people made it — the two only agree when every customer is the same size. Before trusting any demand signal, ask who is structurally able to appear in it: a signal can be precise, well instrumented and unrepresentative at once. Then check whether the metric you are trying to move even responds in the segment you are serving, because effort spent on customers already near their retention floor buys nothing however well it is executed.",
    sampleSolution:
      "Request count runs inversely to account size: 12 enterprise accounts are 46% of ARR and 0.5% of requests (2.4 per crore) while 610 long-tail accounts are 20% of ARR and 90% of requests (985 per crore). The cause is two good decisions colliding — named CSMs for big accounts, so only 4% of their asks become tickets, and a roadmap process built on the ticket system because that is where the data was. Coverage is 11% enterprise against 72% tail; long-tail churn is 4.6% against a 4.2% floor no feature moves, while enterprise churn is 6.1% against a floor of 0.8%, so nearly all recoverable churn sits in the tier being ignored. A voting portal amplifies the bias — the twelve accounts will not vote either — and six engineers add 22% coverage on every tier for ₹1.5 crore a quarter. Re-ranking on ARR at risk and putting a squad on the enterprise commitment list takes coverage past 84%, enterprise churn to 1.9%, and quarterly NRR back above 100%.",
    tags: "product management,prioritisation,roadmap,net revenue retention,revenue concentration,opportunity cost,selection bias,b2b saas,logistics,simulation",
  },
  {
    externalId: "sehat-plus-service-level",
    title: "Sehat Plus: 87% availability on 24% more stock",
    prompt:
      "A 240-store pharmacy chain promises 96% availability and delivers 87.4%, while holding ₹31.2 crore of stock — 24% more than a year ago, because safety stock was already raised from 11 days to 14 and the fill rate fell anyway. The CFO has been told to release ₹6 crore of working capital. Work out what the average is hiding, then spend a quarter acting on it.",
    category: "retail",
    sector: "healthcare",
    difficulty: "Medium",
    interviewLevel: "GeneralMBA",
    type: "simulation",
    betterApproach:
      "Never read a service level at the level of the business. Availability is a promise about one item, so an aggregate averages items that behave nothing alike and destroys the information it was carrying — split it by how variable demand is before doing anything else. Then apply one test to every candidate cause: did it move differently across the two sides of the split? A degradation that hit both halves equally cannot explain a gap that opened on only one of them.",
    sampleSolution:
      "A national rule holds every SKU at 14 days of average demand. Chronic refills have a coefficient of variation of 0.14, so 14 days is about six standard deviations of cover and they sit at 98.2%; acute and seasonal lines have 0.71, so the same 14 days is about one, and they sit at 71.2% while being 40% of demand and 91% of the ₹13.61 crore a quarter that goes unserved. Blended that is 87.4% on stock turning 9.5 times — both perfectly respectable aggregates, which is why nobody could find it. Lead time did rise from 6 days to 8, but identically on both classes, so it cannot explain the split; raising cover to 21 days everywhere lifts the reported fill rate about three points and costs ₹6.5 crore of working capital, leaving the quarter slightly worse. Sizing safety stock on variability — about 4 days chronic, 26 acute — and holding the acute buffer forward in stores on a twice-weekly cycle takes blended availability past 96% on ₹4.3 crore *less* inventory.",
    tags: "supply chain,inventory,fill rate,service level,safety stock,coefficient of variation,inventory turns,pharmacy,retail,simulation",
  },
  {
    externalId: "plant-constraint-throughput",
    title: "Trishul Gears: every machine is busy and one dispatch in five is late",
    prompt:
      "A gear plant reports 92% overall equipment effectiveness and 89% machine utilisation, and delivers 79% of its orders on time — 3.06 lakh gears made against an order book of 3.80 lakh. The works manager wants a second CNC hobber, the production head wants a third shift, sales wants an expediting cell. You have 6 analyst-days to find what is actually limiting the plant, then 4 people-weeks and ₹5 crore.",
    category: "operations",
    sector: "automotive",
    difficulty: "Medium",
    interviewLevel: "GeneralMBA",
    type: "simulation",
    betterApproach:
      "Never read a plant one machine at a time. Utilisation and OEE are per-step measurements, so a plant average hides the only step that decides anything — compare each work centre's available hours against the hours this year's order book needs from it, and exactly one will be above 1.0. Then treat the two questions separately: throughput is set by the constraint's hours, while delivery is set by the length of the queue in front of it, which is Little's law rather than effort.",
    sampleSolution:
      "Heat treatment is the only constrained step — a load factor of 1.24 against 0.84 or less everywhere else. The furnace has 5,760 hours and treats for 3,917: 1,010 hours of changeover across 168 batches, 448 idle for want of staged material, 385 of maintenance. Because every cell is measured on its own utilisation, they keep releasing work into a queue 19.4 days deep, which fixes the lead time at 34 days and takes OTIF to 74%. Quick changeover buys back about 770 furnace hours already paid for, and releasing material at the furnace's pace collapses the queue — together worth about ₹5.2 crore of net contribution. The second hobber adds parts to the queue and ₹56 lakh of fixed cost; the third shift genuinely adds constraint hours but manning caps it at 10% for ₹1.43 crore a year, and expediting only reorders the queue: expedited lines gained 9 days last year while everything behind them lost 6.",
    tags: "operations,manufacturing,theory of constraints,bottleneck,throughput,little's law,wip,otif,changeover,auto components,simulation",
  },
  {
    externalId: "cost-of-poor-quality",
    title: "Sunidhi Knits: the inspection team doubled and so did the rejects",
    prompt:
      "A Tirupur knitwear exporter doubled its final-inspection team to catch more of the 11.4% it rejects. Rejects found went up, air freight went up 31%, and claims barely moved. The quality department costs ₹2.9 crore a year. You have 6 analyst-days to find out where the defects are actually made, then 4 people-weeks and ₹4 crore.",
    category: "operations",
    sector: "manufacturing",
    difficulty: "Medium",
    interviewLevel: "GeneralMBA",
    type: "simulation",
    betterApproach:
      "Separate where a defect is found from where it is made, because only the second is a place you can act on. Then price the four boxes of the cost of quality — prevention, appraisal, internal failure, external failure — and notice that three of them are booked outside the quality department, so nobody has ever seen the total. Inspection moves a defect between boxes; only prevention removes it from all four.",
    sampleSolution:
      "Traced to origin, 78% of rejects are made at two unwatched stations: six knitting machines on needle beds past 4,000 hours (44%) and sleeve attach on line 4 (34%). Nothing checks either, so every defect is found after ₹296 of value is in the piece — against about ₹7 to catch it at the machine. That timing is the whole cost structure: ₹4.02 crore of pieces downgraded from ₹430 to ₹172, ₹1.22 crore of rework, ₹1.66 crore of air freight because rework takes eleven days against a four-day window, and ₹3.11 crore of customer claims — ₹12.91 crore in total against ₹17.33 crore of net contribution. Doubling the audit team was appraisal: it found 12% more defects, cut escapes a third, and raised rework 19% and air freight 31%. Source checks plus rebuilding the six machines takes the defect rate from 11.4% to about 4.5%, worth ₹5.8 crore. Tightening the AQL is the trap that improves every quality metric by giving away ₹258 a piece.",
    tags: "operations,quality,cost of poor quality,prevention,inspection,rework,first pass yield,garment export,simulation",
  },
  {
    externalId: "bullwhip-demand-signal",
    title: "Zaika Beverages: shoppers bought the same juice all year and the plant did not",
    prompt:
      "Consumer offtake moves 6% a month; the factory schedule moves 38%. That swing cost ₹6.08 crore of overtime and idle time, ₹1.90 crore of expedited freight and ₹2.34 crore of near-expiry returns, and 8.4% of demand still went unserved on 47 days of stock. Sales says demand is volatile, the director wants three depots, commercial wants more safety stock. You have 6 analyst-days, then 4 people-weeks and ₹4.5 crore.",
    category: "supply-chain",
    sector: "food-beverage",
    difficulty: "Medium",
    interviewLevel: "McKinsey",
    type: "simulation",
    betterApproach:
      "Measure the same demand at every point in the chain before accepting that it is volatile. Offtake, distributor orders and the plant's schedule on one chart, each indexed to its own average, tells you how much of the variability is the market's and how much the company manufactured. Then look for the three usual makers of it — how the sales force is measured, what the trade schemes do to order timing, and which series the plan is fitted to — because all three are policies rather than facts.",
    sampleSolution:
      "Offtake moves ±6%, distributor orders ±22%, the plant's schedule ±38%: 6.3× amplification across three steps, every one of them internal. 61% of primary sales land in the last six days of the month because 84% of the sales incentive pays at a monthly target; a quarterly loading scheme runs a week at 3.11× and leaves the next six 42% down while offtake does not move, and 68% of near-expiry returns come from that stock; and the plan is fitted to primary sales, so the company forecasts its own scramble — the same crude method on secondary sales scores 9% error against 31%. Each point of swing costs about ₹21 lakh, so the swing is ₹7.98 crore against ₹9.41 crore of net contribution. Planning and replenishing from secondary sales and flattening the trade calendar is worth about ₹11 crore. Three more depots buy space that is empty eleven months a year, and raising safety stock is almost exactly a wash — it buffers an amplification the company could simply stop creating.",
    tags: "supply chain,bullwhip effect,demand amplification,forecasting,trade promotion,inventory,distribution,fmcg,beverages,simulation",
  },
  {
    externalId: "b2b-deal-tco",
    title: "Lekha: our most profitable customer wants 18% off",
    prompt:
      "Your largest account — 900 seats, ₹2.7 crore of ARR, 78% gross margin on the deck — wants 18% off to sign three years. Finance has just run a fully loaded cost to serve for the first time. Work out what the contract is actually worth before you answer.",
    category: "product-management",
    sector: "technology",
    difficulty: "Medium",
    interviewLevel: "PM",
    type: "simulation",
    betterApproach:
      "Load every cost the account actually causes into its margin, including engineering that exists for one customer, before discussing price. Then cross the table and cost their total cost of ownership too: if most of what the product costs them is work it creates rather than what it charges, a discount is the least effective relief available and the most expensive one to give.",
    sampleSolution:
      "The 78% counts hosting only; fully loaded the account runs at 19.5%, and a third of the cost is a bespoke ERP connector booked as R&D. 40 of 900 seats drive 71% of documents and 64% of tickets while the contract charges by seat. Their own cost of ownership is ₹1.15 crore a quarter, our licence 59% of it — so 18% off relieves a tenth of their problem and takes contract contribution from ₹72 lakh to minus ₹37. Retiring the connector and repricing to metered volume relieves more than the discount would, at no cost to price.",
    tags: "product management,b2b saas,cost to serve,total cost of ownership,pricing,net revenue retention,manufacturing,simulation",
  },
  /**
   * The finance track: one scenario per financial statement, in the order a
   * beginner meets them.
   *
   * Filed under `finance` rather than `product-management` — the first nine
   * simulations are all product economics, and a learner filtering the library
   * for Finance should find these. `Big4` is the closest interview level the
   * catalogue carries to the financial-analyst role these are played in.
   */
  {
    externalId: "product-cost-absorption",
    title: "Mithila Foods: the costing sheet says kill the biscuit that pays the rent",
    prompt:
      "A biscuit maker's costing sheet shows its biggest product — half of all sales — losing ₹1.48 crore a year, and the board wants it discontinued by September. The plant is already running flat out and the profit is ₹4.67 crore short of target. You have 6 analyst-days to work out what that sheet is measuring, then 4 people-weeks and ₹6 crore to act on it.",
    category: "finance",
    sector: "food-beverage",
    difficulty: "Easy",
    interviewLevel: "Big4",
    type: "simulation",
    betterApproach:
      "Separate the two kinds of cost before deciding anything about a product. Only costs that move with volume belong to a product; fixed cost charged to it by an allocation rule belongs to the rule. So ask the question about the bank account — if this stopped tomorrow, which payments stop? — and decide on contribution. Then ask what is actually scarce: when a plant is full, the ranking that matters is contribution per hour of the constrained machine, not margin per rupee of sales.",
    sampleSolution:
      "Fixed cost is charged on share of revenue, so glucose — 50.9% of sales — absorbs ₹11.92 crore against ₹10.44 crore of contribution and prints a ₹1.48 crore loss. Only ₹1.90 crore of that would ever stop being paid, so discontinuing it takes EBITDA from ₹4.77 crore to minus ₹3.77 crore, and re-charges ₹10 crore of factory to the two products left until cream shows a loss too — the absorption death spiral. The real problem is that the same sheet schedules a full line: glucose earns ₹33,786 a running hour against premium's ₹60,636, while premium has run at a 71% fill rate for two years. Re-planning the schedule on contribution per hour and cutting the 826 hours of changeover is worth about ₹3.6 crore without dropping a product, against ₹0.26 crore for the overhead cut the chairman wants.",
    tags: "finance,cost accounting,contribution,absorption costing,fixed cost,product mix,capacity,biscuits,simulation",
  },
  {
    externalId: "pnl-profit-squeeze",
    title: "Kirti Apparel: revenue is up 22% and profit is down 62%",
    prompt:
      "A 60-store apparel chain grew revenue 22% and lost nearly two thirds of its profit. Three people in the room have three explanations and none of them has separated the 46 stores that traded all year from the 14 that opened in April. You have 6 analyst-days to read the P&L properly, then a quarter of capacity and ₹6 crore to act on what you find.",
    category: "finance",
    sector: "retail",
    difficulty: "Easy",
    interviewLevel: "Big4",
    type: "simulation",
    betterApproach:
      "Never diagnose a consolidated profit and loss statement. Revenue rises whenever a business adds a location, so the first move is to split the statement into units that traded in both periods and units that did not — otherwise every ratio below the top line is an average of two different businesses. Only then ask which subtotal the problem sits above.",
    sampleSolution:
      "The 46 mature stores contributed ₹15.64 crore against ₹14.48 crore last year, so like-for-like the business improved. The 14 stores opened in April contributed minus ₹1.09 crore, and brought ₹0.90 crore of fit-out depreciation, ₹0.55 crore of interest and ₹1.20 crore of launch advertising with them — essentially the whole ₹2.90 crore fall in net profit. They are also exactly on the ramp curve every one of this chain's 31 openings has followed. The trap is cutting advertising: it saves ₹1.70 crore, gives back about ₹1.65 crore of gross profit, and removes the launch campaigns from the fourteen stores that need them most.",
    tags: "finance,accounting,profit and loss,gross margin,ebitda,like-for-like,retail,apparel,simulation",
  },
  {
    externalId: "cash-conversion-cycle",
    title: "Nirmal Pipes: a record profit and no money for payroll",
    prompt:
      "A pipe manufacturer posted its best ever profit — ₹4.19 crore, up 57% — and has ₹41 lakh in the bank against a ₹1.9 crore payroll. Both statements are true and neither is an accounting error. You have 6 analyst-days to find where the money went, then 4 sprints and ₹3 crore.",
    category: "finance",
    sector: "manufacturing",
    difficulty: "Easy",
    interviewLevel: "Big4",
    type: "simulation",
    betterApproach:
      "Bridge profit to cash before arguing about either. Operating cash flow is EBITDA less the increase in working capital, so a profitable company with a rising receivables or inventory balance can consume cash indefinitely. Then decompose the working capital into the only three places it can be — days you collect in, days you hold stock for, days you take to pay — and price each one.",
    sampleSolution:
      "EBITDA of ₹9.48 crore against a ₹31.4 crore increase in working capital gives minus ₹21.9 crore of operating cash and minus ₹26.8 crore of free cash flow. The cash conversion cycle went from 61 days to 180: infra customers pay 60 days after a certification running 55 to 80 days late, taking DSO from 52 to 118, while procurement bought a 2% early-settlement discount that cut DPO from 62 to 34 — borrowing at an implied 26.6% a year against an overdraft costing 11.5%. Billing against delivered quantity, a right the contracts already contain, plus a return to 60-day supplier terms takes the hole from ₹27 crore to about ₹10 crore. Drawing more overdraft moves no operational number at all.",
    tags: "finance,accounting,cash flow,working capital,cash conversion cycle,dso,dpo,manufacturing,simulation",
  },
  {
    externalId: "balance-sheet-leverage",
    title: "Deccan Ceramics: our best ever EBITDA, and the bank wants a word",
    prompt:
      "A tile manufacturer posted record EBITDA the same week its auditor raised a going-concern note and its lender asked about the interest-cover covenant. The managing director wants to announce the EBITDA; the finance director wants to refinance. Work out why both of them can be right, then spend 4 sprints and ₹16 crore.",
    category: "finance",
    sector: "manufacturing",
    difficulty: "Medium",
    interviewLevel: "Big4",
    type: "simulation",
    betterApproach:
      "A profit and loss statement cannot see capital, so judge an expansion by dividing operating profit by the capital it took to earn. Then decompose that return into margin and turnover, because the two look identical in the ratio and have nothing in common as decisions. Keep the liquidity question separate from the return question — they have different causes and different fixes.",
    sampleSolution:
      "ROCE fell from 14.8% to 8.1%, and the decomposition puts it entirely in the denominator: EBIT margin went 11.4% to 10.6% while capital turnover went 1.30 to 0.76. ₹161.6 crore of new capital produced ₹3.0 crore of extra operating profit — about 1.9% incremental against debt at 9.9% — because the third kiln runs at 46% and ₹34.8 crore of land and idle plant is in nobody's plan. The liquidity crisis is a separate fact: ₹64 crore reclassified as current when the moratorium ended, with no transaction, taking the current ratio from 2.11 to 0.93. The instructive traps are that refinancing fixes the current ratio and moves ROCE by nothing, and a ₹40 crore rights issue halves debt-to-equity and moves ROCE by nothing, because capital employed is equity plus debt.",
    tags: "finance,accounting,balance sheet,ratio analysis,roce,dupont,liquidity,leverage,covenant,manufacturing,simulation",
  },
  /**
   * The finance track's capstone, and the only row in it whose question is
   * about a decision that has not been taken yet.
   *
   * The three above read statements that have already been printed. This one
   * hands the candidate a Rs 100 crore facility request due at a bank the next
   * morning, so the exercise is a forecast rather than a diagnosis — which is
   * why the metric that settles it is the INCREMENTAL return on capital rather
   * than the average one its sibling teaches.
   */
  {
    externalId: "capital-allocation-ask",
    title: "Pragati Precision: record EBITDA, and the CEO wants a hundred crore more",
    prompt:
      "An auto-components maker posted its best ever EBITDA — up 35% on revenue past ₹400 crore — and the CEO walks into a bank tomorrow to request a ₹100 crore facility to buy a competitor. The deck contains no return calculation and nobody has read the covenant page. You have 6 analyst-days before the meeting, then 5 people-weeks and ₹18 crore.",
    category: "finance",
    sector: "automotive",
    difficulty: "Hard",
    interviewLevel: "Big4",
    type: "simulation",
    betterApproach:
      "Judge an expansion on the capital it consumed, not on the profit it added, and judge the NEXT one on what the last one returned. An average return grades everything a company has ever built; the incremental return — the change in operating profit divided by the change in capital employed — is the honest forecast of what the next rupee will earn, and the two can point in opposite directions. Then check separately whether the money is even available, because a covenant decides that before a return does.",
    sampleSolution:
      "ROCE fell from 23.3% to 8.9% and the decomposition puts it in the denominator: the EBIT margin moved 10.9% to 10.0% while capital turnover fell 2.13 to 0.89. The number that answers the question is the incremental one — ₹5 crore of extra operating profit on ₹300 crore of new capital is 1.7%, against debt costing 10.1% — because the new stamping line runs at 38% against a plan of 75% after its OEM platform slipped a model year. On the deck's own generous numbers the acquisition returns 8.0% on ₹100 crore, taking group ROCE to 8.7% and interest cover from 1.14x to 1.06x, and clause 14.3 bars incremental debt below 2.00x interest cover, so the facility cannot be written at all. The instructive traps are that refinancing to ten years fixes debt service cover and moves ROCE by nothing — and does not move interest cover either, because principal was never in that ratio — and that an ₹80 crore rights issue more than halves gearing and moves ROCE by exactly zero, because capital employed is equity plus debt.",
    tags: "finance,accounting,capital allocation,roce,incremental return,cost of capital,interest coverage,covenant,dupont,m&a,automotive,manufacturing,simulation",
  },
  /**
   * The catalogue's first TURNAROUND, and the only row here whose scenario does
   * not run the war-room format.
   *
   * Nothing in this row says so. The format is a property of the scenario in
   * `lib/sim/scenarios/cash-runway-turnaround.ts`, matched by `externalId`, so
   * the catalogue keeps describing what a question is ABOUT and the exercise
   * stays where the exercise lives. `betterApproach` and `sampleSolution` are
   * still written for a reader rather than a player, exactly as above.
   */
  {
    externalId: "cash-runway-turnaround",
    title: "Sutradhar: four quarters of cash and three ways to spend it",
    prompt:
      "A logistics SaaS has ₹12 crore in the bank, loses ₹3 crore a quarter and has four quarters of runway. Nothing is hidden — the board is not asking what is wrong, it is asking what you will do, and it asks again after every quarter. Allocate four times and watch where it leaves the company two years out.",
    category: "product-management",
    sector: "technology",
    difficulty: "Medium",
    interviewLevel: "PM",
    type: "simulation",
    betterApproach:
      "Start from the deadline rather than the ideas: cash divided by net burn is the only number that cannot be argued with. Then split a loss into the two ways of closing it — earn more or spend less — and check what each cost line actually buys before cutting it. Treat customers as a balance, not a rate: one you have paid to acquire and can lose permanently, so anything that shrinks it is spending capital rather than saving cash.",
    sampleSolution:
      "₹12 crore against ₹3 crore a quarter is four quarters. Burn is 65% salaries and only 10% engineering, so the cost side cannot close a ₹3 crore gap without cutting the thing that earns the revenue. The two real levers are price — ₹36,000 a quarter unchanged in three years for software the customer runs their shipping on — and retention, because marketing buys 200 customers a quarter while churn takes 180, so ₹1.8 crore a quarter is being spent to stand still. Support is funded for exactly the 2,000 customers that exist, so any growth pushes the service ratio below 1 and raises churn a quarter later. The trap is switching acquisition off: it saves ₹1.35 crore a quarter immediately, the largest single improvement to cash on the board, and it drains the customer balance that every future quarter's revenue depends on — good-looking for two quarters and a smaller company for good.",
    tags: "product management,finance,saas,unit economics,runway,burn,churn,retention,pricing,turnaround,technology,simulation",
  },
  /**
   * The first CONFIG-DRIVEN simulator, and the only row whose exercise is not an
   * authored scenario at all.
   *
   * `lib/sim/scenarios/*` holds hand-written causal models; this one's rules live
   * in `lib/sim/configs/buyback.ts` as parameters, and the run page resolves it
   * through a second registry. The catalogue does not care about the difference
   * — a question is still a question — which is the point of keeping the two
   * registries behind one `externalId`.
   */
  {
    externalId: "buyback-contract",
    title: "Meraki Textiles: twelve months, one supplier, and a clause you can abuse once",
    prompt:
      "You order from a single supplier under a buyback clause: whatever you cannot sell, they repurchase — up to a share of your order, at a price they quote each month. Over-ordering is free until it isn't. Twelve months, two decisions a month, and a supplier that is learning what kind of buyer you are.",
    category: "product-management",
    sector: "manufacturing",
    difficulty: "Hard",
    interviewLevel: "GeneralMBA",
    type: "simulation",
    betterApproach:
      "Read a buyback clause as a relationship rather than a term sheet. The clause transfers risk, so the supplier prices it against how much risk you have been transferring — which means the cheapest way to a good month is also the most expensive way to a good year. Watch three things the P&L will not show you: how much of your order is coming back, how close your order is to the supplier's capacity, and the gap between a profitable month and a collected one.",
    sampleSolution:
      "Ordering to demand rather than to the upside is worth more than any pricing move available. Over-ordering captures every unit of a good month at the supplier's expense, and the supplier's belief about you falls with the stock it takes back — so the buyback price and the covered share both drop, permanently, for the rest of the year. Two second-order traps: ordering past about 80% of the supplier's capacity makes the queue non-linear, so lead times climb and stock arrives too late to sell; and 30-day receivables against 45-day payables mean the first profitable month is still a cash-negative one.",
    tags: "supply chain,operations,contracts,buyback,newsvendor,inventory,working capital,npv,simulation",
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
