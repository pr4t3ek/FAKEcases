"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import {
  COMPANY_LEVELS,
  DIFFICULTIES,
  INTERVIEW_LEVEL_LABELS,
  SECTOR_LABELS,
  isCompanyLevel,
  type InterviewLevel,
  type QuestionSurface,
  type Sector,
} from "@/lib/types";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Category {
  slug: string;
  name: string;
}

export function FilterBar({
  categories,
  sectors,
  surface = "practice",
}: {
  categories: Category[];
  /**
   * Passed in rather than read from `SECTORS`, because which sectors are worth
   * offering depends on the surface — three of them are carried only by war
   * rooms. Same reasoning as `categories`.
   */
  sectors: Sector[];
  /**
   * Which catalogue is being filtered. Decides where the filters navigate, and
   * whether the format dropdown appears at all — the war rooms page holds
   * exactly one format, so a "which format?" select there would be a control
   * with one option.
   */
  surface?: QuestionSurface;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const basePath = surface === "simulation" ? "/simulations" : "/library";

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.push(`${basePath}?${next.toString()}`);
    },
    [params, router, basePath],
  );

  // Debounced search sync.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== search) setParam("q", search);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const activeCategory = params.get("category") ?? "";
  const activeSector = params.get("sector") ?? "";
  const activeDifficulty = params.get("difficulty") ?? "";
  const activeLevel = params.get("level") ?? "";
  const activeType = params.get("type") ?? "";
  const hasFilters =
    activeCategory || activeSector || activeDifficulty || activeLevel || activeType || search;

  /**
   * A goal chip on the dashboard can still link to `?level=PM`, which is a real
   * filter the server honours but not one this control offers. Rendering it as
   * an extra option means the select states what is actually applied instead of
   * falling back to "All companies" while the grid shows a filtered list.
   */
  const orphanLevel =
    activeLevel && !isCompanyLevel(activeLevel) ? (activeLevel as InterviewLevel) : null;

  const selectClass =
    "h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions…"
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* Without this a case is only reachable by scrolling past every
            guesstimate. Simulations are no longer an option here: they have
            their own catalogue, and leaving them in this list would have been
            a filter that navigates you off the page you are on. */}
        {surface === "practice" && (
          <select
            className={selectClass}
            value={activeType}
            onChange={(e) => setParam("type", e.target.value)}
          >
            <option value="">All exercises</option>
            <option value="guesstimate">Guesstimates</option>
            <option value="qualitative">Cases (issue tree)</option>
          </select>
        )}
        {/* Two axes, two controls. `sector` is what the business is; `category`
            is what you are being asked to do with it. They used to share one
            dropdown, which is why "Market Sizing" sat between "Healthcare" and
            "Retail" as though it were an industry. */}
        <select
          className={selectClass}
          value={activeSector}
          onChange={(e) => setParam("sector", e.target.value)}
        >
          <option value="">All sectors</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {SECTOR_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={activeCategory}
          onChange={(e) => setParam("category", e.target.value)}
        >
          <option value="">All topics</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={activeDifficulty}
          onChange={(e) => setParam("difficulty", e.target.value)}
        >
          <option value="">Any difficulty</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={activeLevel}
          onChange={(e) => setParam("level", e.target.value)}
        >
          {/* Companies only. `INTERVIEW_LEVELS` also carries PM, Product and
              General MBA, which are roles rather than employers — they stay in
              the vocabulary (the authoring contract and profile goals both use
              it) and out of a control labelled "company". */}
          <option value="">All companies</option>
          {COMPANY_LEVELS.map((l) => (
            <option key={l} value={l}>
              {INTERVIEW_LEVEL_LABELS[l]}
            </option>
          ))}
          {orphanLevel && (
            <option value={orphanLevel}>{INTERVIEW_LEVEL_LABELS[orphanLevel]}</option>
          )}
        </select>
        {hasFilters && (
          <button
            onClick={() => {
              setSearch("");
              router.push(basePath);
            }}
            className={cn(
              "inline-flex h-10 items-center gap-1 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground",
            )}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
