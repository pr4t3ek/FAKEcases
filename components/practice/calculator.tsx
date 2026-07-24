"use client";

import { useState } from "react";
import { Equal, Plus } from "lucide-react";
import { evaluateExpression } from "@/lib/calc";
import { formatIndianNumber, toIndianWords } from "@/lib/utils";
import { addCalculation } from "@/app/actions/practice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UiCalculation } from "./types";

export function Calculator({
  attemptId,
  calculations,
  onAdd,
}: {
  attemptId: string;
  calculations: UiCalculation[];
  onAdd: (c: UiCalculation) => void;
}) {
  const [expr, setExpr] = useState("");
  const [preview, setPreview] = useState<number | null>(null);

  function onChange(v: string) {
    setExpr(v);
    setPreview(evaluateExpression(v));
  }

  async function save() {
    const result = evaluateExpression(expr);
    if (result === null || !expr.trim()) return;
    const resultText = `${formatIndianNumber(result)} (${toIndianWords(result)})`;
    // optimistic
    const temp: UiCalculation = { id: `tmp-${Date.now()}`, expression: expr, resultText };
    onAdd(temp);
    setExpr("");
    setPreview(null);
    try {
      const saved = await addCalculation(attemptId, expr, result, resultText);
      onAdd({ ...temp, id: saved.id });
    } catch {
      /* keep optimistic entry */
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={expr}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="e.g. 2cr * 0.7 / 2"
          className="font-mono"
          aria-label="Calculator expression"
        />
        <Button size="icon" variant="secondary" onClick={save} aria-label="Save calculation">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Equal className="h-3.5 w-3.5" />
        <span className="font-mono">
          {preview === null ? "—" : `${formatIndianNumber(preview)}  ·  ${toIndianWords(preview)}`}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Supports <span className="font-mono">+ - * / ( )</span> and units{" "}
        <span className="font-mono">k, L, cr</span>. Enter to save.
      </p>

      {calculations.length > 0 && (
        <div className="space-y-1.5 border-t pt-3">
          <div className="text-xs font-medium text-muted-foreground">Saved calculations</div>
          {calculations.map((c) => (
            <div key={c.id} className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
              <span className="font-mono">{c.expression}</span>
              <span className="mx-1.5 text-muted-foreground">=</span>
              <span className="font-mono font-medium">{c.resultText}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
