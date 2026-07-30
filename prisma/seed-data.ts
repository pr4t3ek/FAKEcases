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
  /** "guesstimate" (default) | "qualitative". */
  type?: string;
  /** Framework slug this case is written against, for qualitative questions. */
  framework?: string;
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
    betterApproach:
      "Split contribution margin into revenue per order (commission rate, delivery fee, ad income) and cost per order (rider payout, discounts, packaging, support). Isolate which side moved before hypothesising why, and check whether the mix of cities or order values shifted underneath a stable total volume.",
    sampleSolution:
      "Steady volume with falling margin points at price or cost per order rather than demand. Common culprits in India: rider payouts rising with fuel and competition for supply, deeper discounting to hold share, and a mix shift toward smaller orders in tier-2 cities where the fixed delivery cost is spread over a lower basket.",
    tags: "profitability,unit economics,delivery",
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
];
