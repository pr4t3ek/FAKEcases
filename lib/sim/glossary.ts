/**
 * The scenario's vocabulary, indexed for lookup at the point of use.
 *
 * The primer already holds every definition a scenario needs, but it is a modal
 * that opens once on arrival — so the explanation of CAC is behind two clicks at
 * the moment a student is staring at a panel labelled "CAC". This turns the same
 * authored content into an index the UI can hit by label or by driver id.
 *
 * Pure and DB-free, like the rest of `lib/sim/`, so the matching rules are
 * testable. The matching is deliberately conservative: a wrong definition
 * attached to a familiar word is worse than no definition at all, so nothing
 * here does fuzzy or partial matching — only exact matches on a normalised key.
 */

import type { SimPrimerTerm, SimTeaching } from "./types";

export interface GlossaryEntry {
  term: string;
  /** Expanded, when the term is an acronym. */
  full?: string;
  plain: string;
  /**
   * Present only when the scenario also shows its metric map.
   *
   * A formula names its input drivers, and `showMetricMap` is opt-in precisely
   * because on a hard scenario the shape of the model is most of the answer
   * (see `SimTeaching`). Leaking "orders = sessions × conversion" through a
   * tooltip would hand over exactly what the map is withholding.
   */
  formula?: string;
  matters: string;
}

export interface Glossary {
  /** The entry for a UI label or driver id, or null. */
  lookup(key: string | null | undefined): GlossaryEntry | null;
  /** How many terms are indexed. Zero for a scenario with no primer. */
  size: number;
}

/**
 * The glossary for a scenario that teaches no vocabulary.
 *
 * `SimTeaching` is optional — one scenario assumes fluency and authors none — so
 * every consumer has to work with nothing, and returning this rather than null
 * means no caller needs a branch.
 */
export const EMPTY_GLOSSARY: Glossary = { lookup: () => null, size: 0 };

/**
 * Fold a label into a lookup key.
 *
 * Case and spacing vary between a primer term ("Conversion rate") and the label
 * on a panel ("conversion rate"), and a trailing "?" or ":" is common on panel
 * titles. Nothing else is stripped — in particular no plural or substring
 * handling, because "Orders" matching "Order value" would be a wrong answer
 * rendered confidently.
 */
function normalise(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[?:.,]+$/, "");
}

function toEntry(term: SimPrimerTerm, withFormula: boolean): GlossaryEntry {
  return {
    term: term.term,
    full: term.full,
    plain: term.plain,
    formula: withFormula ? term.formula : undefined,
    matters: term.matters,
  };
}

/**
 * Build the index.
 *
 * Every term is reachable three ways: by its own name, by its expansion when it
 * has one ("CAC" and "Customer acquisition cost" appear in different places),
 * and by the driver it annotates — `SimPrimerTerm.driver` is already authored
 * across the scenarios and joins exactly to `MetricMapNode.id`, which is what
 * makes the metric map hoverable with no heuristics at all.
 *
 * First writer wins on a collision, so an authored term always beats an
 * expansion that happens to collide with it.
 */
export function buildGlossary(teaching: SimTeaching | null | undefined): Glossary {
  const terms = teaching?.primer?.terms;
  if (!terms?.length) return EMPTY_GLOSSARY;

  const withFormula = teaching!.showMetricMap;
  const index = new Map<string, GlossaryEntry>();

  const add = (key: string | undefined, entry: GlossaryEntry) => {
    if (!key) return;
    const k = normalise(key);
    if (k && !index.has(k)) index.set(k, entry);
  };

  for (const term of terms) {
    const entry = toEntry(term, withFormula);
    add(term.term, entry);
    add(term.full, entry);
    // Driver ids are camelCase identifiers, so they cannot collide with a
    // human label once normalised — "grossMarginRate" folds to itself.
    add(term.driver, entry);
  }

  return {
    lookup(key) {
      if (!key) return null;
      return index.get(normalise(key)) ?? null;
    },
    size: terms.length,
  };
}
