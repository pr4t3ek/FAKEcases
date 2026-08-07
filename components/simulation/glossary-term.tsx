"use client";

/**
 * A term the scenario defined, explained where it is used.
 *
 * The concept primer holds every definition already, but it opens once on
 * arrival and then lives behind a header button — so by the time a student is
 * looking at a panel labelled "CAC", the sentence that explains CAC is two
 * clicks away and in a different place. This puts it on the word.
 *
 * The glossary travels by context rather than by prop, because the hover targets
 * are scattered across the dashboard, the metric map, the header and the commit
 * panel, and threading it through `SimDashboard → SimPanelView → PanelShell`
 * would be four signature changes to deliver one object.
 *
 * A label with no authored term renders exactly as it did before — no underline,
 * no trigger. Promising an explanation that does not exist is worse than staying
 * quiet, which is also why `buildGlossary` refuses to match on substrings.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { buildGlossary, EMPTY_GLOSSARY, type Glossary } from "@/lib/sim/glossary";
import type { SimTeaching } from "@/lib/sim/types";

const GlossaryContext = createContext<Glossary>(EMPTY_GLOSSARY);

export function GlossaryProvider({
  teaching,
  children,
}: {
  teaching: SimTeaching | null | undefined;
  children: ReactNode;
}) {
  const glossary = useMemo(() => buildGlossary(teaching), [teaching]);
  return <GlossaryContext.Provider value={glossary}>{children}</GlossaryContext.Provider>;
}

export function useGlossary(): Glossary {
  return useContext(GlossaryContext);
}

export function GlossaryTerm({
  term,
  children,
  className,
}: {
  /** What to look up. Defaults to the rendered text when that is a plain string. */
  term?: string;
  children: ReactNode;
  className?: string;
}) {
  const glossary = useGlossary();
  // The explicit key first, then the rendered text. A metric-map node passes its
  // driver id, which is an exact join; if the scenario annotated the term by
  // name instead, the label still finds it.
  const glossaryKey = typeof children === "string" ? children : null;
  const entry = glossary.lookup(term) ?? glossary.lookup(glossaryKey);

  if (!entry) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          // Nothing happens on click — the tooltip opens on hover and on focus.
          // It is a button so it is reachable from the keyboard at all, and the
          // default is suppressed so one of these inside a <label> does not
          // hijack the click that should focus the input.
          onClick={(e) => e.preventDefault()}
          className={cn(
            "cursor-help rounded-sm text-left underline decoration-dotted decoration-muted-foreground/60 underline-offset-4",
            "hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      {/* Same order as the primer card: the plain sentence first, the formula
          second, and what it changes last. A student who does not know the term
          gets nothing from the arithmetic until the words have landed. */}
      <TooltipContent>
        <div className="flex flex-wrap items-baseline gap-1.5">
          <span className="text-sm font-semibold">{entry.term}</span>
          {entry.full && <span className="text-[11px] text-muted-foreground">{entry.full}</span>}
        </div>
        <p className="mt-1 text-xs leading-relaxed">{entry.plain}</p>
        {entry.formula && (
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-[11px]">
            <Calculator className="h-3 w-3 shrink-0 text-muted-foreground" />
            {entry.formula}
          </div>
        )}
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Why it matters: </span>
          {entry.matters}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
