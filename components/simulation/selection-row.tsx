"use client";

import { X } from "lucide-react";

/**
 * What you have currently selected, and a way to unselect it.
 *
 * Both pickers in this flow toggle, and neither said so — the only signal was a
 * highlight on one chip among a dozen, which a student who clicked the wrong
 * one had no reason to read as "click again to remove". Stating the selection
 * separately turns an invisible affordance into an obvious one.
 *
 * Deliberately not a "clear all": removing one at a time is the correction
 * people actually want after a misclick.
 */
export function SelectionRow({
  selected,
  onRemove,
  emptyHint,
  label = "Selected",
}: {
  selected: { id: string; label: string }[];
  onRemove: (id: string) => void;
  emptyHint: string;
  label?: string;
}) {
  if (selected.length === 0) {
    return <p className="mt-3 text-xs italic text-muted-foreground">{emptyHint}</p>;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}:</span>
      {selected.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${item.label}`}
          className="group inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-destructive/10 hover:border-destructive"
        >
          {item.label}
          <X className="h-3 w-3 text-muted-foreground group-hover:text-destructive" />
        </button>
      ))}
    </div>
  );
}
