"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { DIFFICULTIES, INTERVIEW_LEVELS, INTERVIEW_LEVEL_LABELS } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Category {
  slug: string;
  name: string;
}

export function FilterBar({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.push(`/library?${next.toString()}`);
    },
    [params, router],
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
  const activeDifficulty = params.get("difficulty") ?? "";
  const activeLevel = params.get("level") ?? "";
  const hasFilters = activeCategory || activeDifficulty || activeLevel || search;

  const selectClass =
    "h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search guesstimates…"
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={selectClass}
          value={activeCategory}
          onChange={(e) => setParam("category", e.target.value)}
        >
          <option value="">All categories</option>
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
          <option value="">Any level</option>
          {INTERVIEW_LEVELS.map((l) => (
            <option key={l} value={l}>
              {INTERVIEW_LEVEL_LABELS[l]}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={() => {
              setSearch("");
              router.push("/library");
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
