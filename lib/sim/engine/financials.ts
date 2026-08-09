/**
 * Money, posted three ways at once.
 *
 * Every settlement writes to the P&L, the balance sheet and the cash flow in
 * the same call, because the single most common thing a student gets wrong is
 * believing a profitable month is a solvent one. Posting them together makes
 * the divergence visible rather than explaining it afterwards: revenue is
 * recognised when the sale happens, cash arrives `receivableDays` later, and a
 * month can be the best on record and still overdraw the account.
 *
 * Every number arrives from a `FinancialsConfig`. No rate, lag or horizon is
 * written here.
 */

import type { FinancialsConfig } from "@/lib/sim/configs/types";

/** Accrual view — what was earned. */
export interface ProfitAndLoss {
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  /** Contract-specific settlement, e.g. a buyback credit. Signed. */
  contractSettlement: number;
  operatingCost: number;
  netProfit: number;
}

/** Position — what is owned and owed. */
export interface BalanceSheet {
  cash: number;
  receivables: number;
  inventoryValue: number;
  payables: number;
  netAssets: number;
}

/** Movement — what actually landed in the bank. */
export interface CashFlow {
  collected: number;
  paid: number;
  net: number;
}

export interface PostedPeriod {
  pnl: ProfitAndLoss;
  balance: BalanceSheet;
  cashFlow: CashFlow;
}

/** Money owed to or by the business, dated by the tick it lands in. */
export interface LedgerEntry {
  dueTick: number;
  amount: number;
}

export interface Ledger {
  receivable: LedgerEntry[];
  payable: LedgerEntry[];
}

export function openLedger(): Ledger {
  return { receivable: [], payable: [] };
}

/** Lag in ticks. 30-day terms on a monthly tick is one tick, not thirty. */
export function lagInTicks(days: number, daysPerPeriod: number): number {
  if (daysPerPeriod <= 0) return 0;
  return Math.max(0, Math.round(days / daysPerPeriod));
}

/**
 * Post one period.
 *
 * Returns the three statements and the ledger carried forward. The caller keeps
 * the ledger between ticks; nothing is stored here.
 */
export function postPeriod(args: {
  tick: number;
  config: FinancialsConfig;
  ledger: Ledger;
  openingCash: number;
  revenue: number;
  costOfGoodsSold: number;
  contractSettlement: number;
  operatingCost: number;
  inventoryValue: number;
}): { posted: PostedPeriod; ledger: Ledger } {
  const { tick, config, ledger, openingCash } = args;

  const grossProfit = args.revenue - args.costOfGoodsSold;
  const netProfit = grossProfit + args.contractSettlement - args.operatingCost;

  const arLag = lagInTicks(config.receivableDays, config.daysPerPeriod);
  const apLag = lagInTicks(config.payableDays, config.daysPerPeriod);

  // This period's sale is collected later; this period's purchase is paid
  // later. The settlement and operating cost move in cash now.
  const receivable = [...ledger.receivable, { dueTick: tick + arLag, amount: args.revenue }];
  const payable = [...ledger.payable, { dueTick: tick + apLag, amount: args.costOfGoodsSold }];

  const collected = receivable
    .filter((e) => e.dueTick <= tick)
    .reduce((s, e) => s + e.amount, 0);
  const paid = payable.filter((e) => e.dueTick <= tick).reduce((s, e) => s + e.amount, 0);

  const netCash = collected - paid + args.contractSettlement - args.operatingCost;
  const cash = openingCash + netCash;

  const carried: Ledger = {
    receivable: receivable.filter((e) => e.dueTick > tick),
    payable: payable.filter((e) => e.dueTick > tick),
  };

  const receivables = carried.receivable.reduce((s, e) => s + e.amount, 0);
  const payables = carried.payable.reduce((s, e) => s + e.amount, 0);

  return {
    posted: {
      pnl: {
        revenue: args.revenue,
        costOfGoodsSold: args.costOfGoodsSold,
        grossProfit,
        contractSettlement: args.contractSettlement,
        operatingCost: args.operatingCost,
        netProfit,
      },
      balance: {
        cash,
        receivables,
        inventoryValue: args.inventoryValue,
        payables,
        netAssets: cash + receivables + args.inventoryValue - payables,
      },
      cashFlow: { collected, paid, net: netCash },
    },
    ledger: carried,
  };
}

/** Per-tick discount factor from an annual rate. */
export function periodDiscountRate(wacc: number, daysPerPeriod: number): number {
  const periodsPerYear = 365 / Math.max(1, daysPerPeriod);
  return Math.pow(1 + wacc, 1 / periodsPerYear) - 1;
}

/**
 * Rolling NPV: realised cash so far, plus the remaining periods discounted.
 *
 * Forward-looking on purpose, and it is what makes a decision that damages a
 * relationship show up immediately. A month can post a fine profit while the
 * expectation for every month after it falls, and a backward-looking total
 * would call that a good month.
 */
export function rollingNpv(args: {
  realisedCashFlows: number[];
  forwardEstimate: number;
  periodsRemaining: number;
  config: FinancialsConfig;
}): number {
  const { realisedCashFlows, forwardEstimate, periodsRemaining, config } = args;
  const rate = periodDiscountRate(config.wacc, config.daysPerPeriod);

  let npv = 0;
  realisedCashFlows.forEach((flow, t) => {
    npv += flow / Math.pow(1 + rate, t + 1);
  });

  const start = realisedCashFlows.length;
  for (let i = 0; i < periodsRemaining; i++) {
    npv += forwardEstimate / Math.pow(1 + rate, start + i + 1);
  }
  return npv;
}

/**
 * Cash conversion cycle in days: how long a rupee is tied up between paying for
 * stock and being paid for it.
 */
export function cashConversionCycle(args: {
  inventoryValue: number;
  receivables: number;
  payables: number;
  costOfGoodsSold: number;
  revenue: number;
  daysPerPeriod: number;
}): number {
  const { daysPerPeriod } = args;
  const daysInventory =
    args.costOfGoodsSold > 0 ? (args.inventoryValue / args.costOfGoodsSold) * daysPerPeriod : 0;
  const daysReceivable = args.revenue > 0 ? (args.receivables / args.revenue) * daysPerPeriod : 0;
  const daysPayable =
    args.costOfGoodsSold > 0 ? (args.payables / args.costOfGoodsSold) * daysPerPeriod : 0;
  return daysInventory + daysReceivable - daysPayable;
}
