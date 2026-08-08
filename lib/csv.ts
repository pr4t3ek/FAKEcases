/**
 * Minimal RFC-4180-ish CSV parser (handles quoted fields, embedded commas,
 * escaped quotes, CRLF). Returns an array of row objects keyed by header.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}

/**
 * Both question types in one template, because the columns that matter differ.
 *
 * A guesstimate fills `idealLow`/`idealHigh` and leaves the case columns blank;
 * a case does the reverse. `expectedBuckets` takes a `|`-separated list — a JSON
 * array in a spreadsheet cell is more quoting than anyone wants — while
 * `rootCause` and `dataPack` are JSON, since they have real structure.
 */
export const QUESTION_CSV_TEMPLATE = `title,prompt,category,sector,difficulty,interviewLevel,type,idealLow,idealHigh,unit,framework,expectedBuckets,rootCause,dataPack,betterApproach,sampleSolution,tags,externalId
Number of ATMs in Chennai,Estimate the number of ATMs in Chennai.,finance,financial-services,Medium,McKinsey,guesstimate,3000,8000,ATMs,,,,,"Estimate bank branches and ATMs per branch, plus standalone/white-label ATMs.","~1 cr people, banked population, ATMs per 10k people ~5-8 -> ~5000 ATMs.","banking,india",atms-chennai
Why are Swiggy's margins falling?,"Swiggy's contribution margin per order in Bengaluru has fallen 30% over two years. Why?",startups,food-beverage,Hard,BCG,qualitative,,,,profitability,Revenue|Cost|Order volume|Competition,"{""path"":[""Cost"",""Delivery cost per order""],""note"":""Rider payouts rose faster than order value.""}","[{""topic"":[""cost"",""delivery""],""fact"":""Rider cost per order rose from Rs 42 to Rs 61.""}]","Split contribution margin into revenue per order and cost per order before drilling.","Delivery cost per order is the driver; order value stayed flat while rider payouts rose ~45%.","food-delivery,india",swiggy-margins
`;
