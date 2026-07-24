"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { QUESTION_CSV_TEMPLATE } from "@/lib/csv";
import type { ImportResult } from "@/lib/questions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ImportPanel() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(dryRun: boolean) {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, format, dryRun }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      if (!dryRun) {
        toast.success(`Imported: ${data.created} created, ${data.updated} updated`);
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([QUESTION_CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "estimateiq-questions-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setText(await file.text());
    setFormat(file.name.endsWith(".json") ? "json" : "csv");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
        <strong>India-only:</strong> imported questions must use Indian context and ₹. Required columns:
        title, prompt, category, difficulty, interviewLevel, idealLow, idealHigh, betterApproach,
        sampleSolution. Optional: unit, tags, sourceUrl, externalId (used to de-duplicate on re-import).
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5">
          {(["csv", "json"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`rounded px-3 py-1 text-sm ${format === f ? "bg-primary text-primary-foreground" : ""}`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4" /> Template
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
          <Upload className="h-4 w-4" /> Upload file
          <input type="file" accept=".csv,.json" className="hidden" onChange={onFile} />
        </label>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={format === "csv" ? "Paste CSV here…" : "Paste a JSON array of questions…"}
        className="min-h-[160px] font-mono text-xs"
      />

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => run(true)} disabled={busy || !text.trim()}>
          Preview / validate
        </Button>
        <Button
          onClick={() => run(false)}
          disabled={busy || !result || result.validCount === 0}
        >
          Commit import
        </Button>
      </div>

      {result && (
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Badge variant="success">{result.validCount} valid</Badge>
            {result.errors.length > 0 && <Badge variant="destructive">{result.errors.length} with errors</Badge>}
            {(result.created > 0 || result.updated > 0) && (
              <Badge variant="secondary">{result.created} created · {result.updated} updated</Badge>
            )}
          </div>
          {result.errors.length > 0 && (
            <div className="mt-3 space-y-1 text-xs">
              {result.errors.slice(0, 20).map((e) => (
                <div key={e.row} className="text-destructive">
                  Row {e.row}: {e.errors.join("; ")}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
