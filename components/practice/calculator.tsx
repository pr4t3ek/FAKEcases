"use client";

import { useRef, useState } from "react";
import { Equal, Plus } from "lucide-react";
import { CALCULATOR_KEYS, evaluateExpression, resultForms } from "@/lib/calc";
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
  const inputRef = useRef<HTMLInputElement>(null);

  function onChange(v: string) {
    setExpr(v);
    setPreview(evaluateExpression(v));
  }

  /**
   * Type a key into the expression at the caret.
   *
   * At the caret rather than appended, so a key can fix the middle of a
   * half-typed sum, and focus returns to the field with the caret after what was
   * just inserted — otherwise every key press would send you back to the mouse.
   */
  function press(key: string) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? expr.length;
    const end = el?.selectionEnd ?? expr.length;
    const next = expr.slice(0, start) + key + expr.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + key.length, start + key.length);
    });
  }

  async function save() {
    const result = evaluateExpression(expr);
    if (result === null || !expr.trim()) return;
    const { exact, short } = resultForms(result);
    const resultText = short ? `${exact} (${short})` : exact;
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

  const shown = preview === null ? null : resultForms(preview);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
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

      {/* The operators, as keys. The panel is used mid-problem with a mouse in
          hand and often on a laptop where `*` is a two-key reach, and the same
          six characters were already being named in the help text below as
          things you were expected to type. */}
      <div className="grid grid-cols-6 gap-1.5">
        {CALCULATOR_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            aria-label={`Insert ${key}`}
            className="rounded-md border bg-muted/40 py-1.5 font-mono text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {key}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Equal className="h-3.5 w-3.5" />
        <span className="font-mono">
          {shown === null ? (
            "—"
          ) : (
            <>
              {shown.exact}
              {/* Only when it adds something — see `resultForms`. */}
              {shown.short && <span className="ml-2 text-xs">· {shown.short}</span>}
            </>
          )}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Also accepts units <span className="font-mono">k, L, cr</span>. Enter to save.
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
