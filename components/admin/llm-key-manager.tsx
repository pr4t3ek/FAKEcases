"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, KeyRound, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * The API keys each provider tries, in order.
 *
 * The card exists because of how the free tier is metered: Gemini's ceiling is
 * per key and shared by every user of the deployment, so one key is one cohort's
 * afternoon. Adding the second has to be possible between lectures, which is the
 * same argument `LimitsCard` makes for the turn budgets.
 *
 * NOTHING HERE EVER HOLDS A KEY. A secret travels one way — typed into the field
 * below, straight into `addLlmKey`, encrypted server-side — and comes back only
 * as `hint`, the first and last four characters. There is deliberately no way to
 * read a stored key back out: an admin who has lost one gets a new one from the
 * provider, which is what they would have to do anyway.
 */

export interface KeyRow {
  id: string;
  provider: string;
  hint: string;
  order: number;
  source: "env" | "db";
  spent: boolean;
  disabled: boolean;
  lastError: string | null;
}

const PROVIDERS: { id: string; label: string; note: string }[] = [
  {
    id: "gemini",
    label: "Gemini",
    note: "Free tier: 250 requests/day per key, shared by everyone on this deployment.",
  },
  { id: "nvidia", label: "NVIDIA NIM", note: "Metered credits. A 402 retires the key for the day." },
  { id: "openai", label: "OpenAI", note: "Paid. No free tier." },
  { id: "anthropic", label: "Anthropic", note: "Paid. No free tier." },
];

export function LlmKeyManager({
  keys,
  authSecretReady,
}: {
  keys: KeyRow[];
  /** False when AUTH_SECRET is unset or still the shipped default. */
  authSecretReady: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "That didn't work.");
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  function add(provider: string) {
    const secret = drafts[provider]?.trim();
    if (!secret) return;
    run(
      () => import("@/app/actions/admin").then((m) => m.addLlmKey(provider, secret)),
      "Key added to the rotation",
    );
    setDrafts((d) => ({ ...d, [provider]: "" }));
  }

  return (
    <Card className="space-y-5 p-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <KeyRound className="h-4 w-4" />
          API keys
        </h2>
        <p className="text-sm text-muted-foreground">
          Tried top to bottom. A key that is rate limited, out of quota or rejected hands the
          turn to the next one before the app falls back to another provider — so a spent free
          tier costs nobody their session.
        </p>
      </div>

      {!authSecretReady && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <strong>Set <code>AUTH_SECRET</code> first.</strong> Stored keys are encrypted under
          it, and its shipped default is published in this repository — so keys saved now would
          not really be protected. Until then the app reads the numbered environment variables
          (<code>GEMINI_API_KEY</code>, <code>GEMINI_API_KEY_2</code>, …) instead.
        </div>
      )}

      {PROVIDERS.map((provider) => {
        const rows = keys
          .filter((k) => k.provider === provider.id)
          .sort((a, b) => a.order - b.order);

        return (
          <div key={provider.id} className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <div className="text-sm font-medium">{provider.label}</div>
              <div className="text-xs text-muted-foreground">{provider.note}</div>
            </div>

            {rows.length === 0 && (
              <div className="text-xs text-muted-foreground">No keys — this provider is off.</div>
            )}

            {rows.map((row, i) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
              >
                <span className="w-5 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                <code className="text-sm">{row.hint}</code>

                {row.source === "env" && (
                  <Badge variant="secondary" title="Read from the environment, not editable here">
                    env
                  </Badge>
                )}
                {row.disabled && <Badge variant="destructive">rejected</Badge>}
                {row.spent && !row.disabled && <Badge variant="secondary">spent today</Badge>}

                {row.lastError && (
                  <span className="w-full text-xs text-muted-foreground">{row.lastError}</span>
                )}

                {row.source === "db" && (
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={pending || i === 0}
                      title="Try this key earlier"
                      onClick={() =>
                        run(
                          () =>
                            import("@/app/actions/admin").then((m) =>
                              m.reorderLlmKey(row.id, "up"),
                            ),
                          "Rotation reordered",
                        )
                      }
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={pending || i === rows.length - 1}
                      title="Try this key later"
                      onClick={() =>
                        run(
                          () =>
                            import("@/app/actions/admin").then((m) =>
                              m.reorderLlmKey(row.id, "down"),
                            ),
                          "Rotation reordered",
                        )
                      }
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    {(row.disabled || row.spent) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={pending}
                        title="Put this key back in the rotation"
                        onClick={() =>
                          run(
                            () =>
                              import("@/app/actions/admin").then((m) => m.reviveLlmKey(row.id)),
                            "Key back in the rotation",
                          )
                        }
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      disabled={pending}
                      title="Remove from the rotation"
                      onClick={() =>
                        run(
                          () => import("@/app/actions/admin").then((m) => m.removeLlmKey(row.id)),
                          "Key removed",
                        )
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="password"
                autoComplete="off"
                placeholder={`Paste a ${provider.label} key`}
                value={drafts[provider.id] ?? ""}
                disabled={!authSecretReady || pending}
                onChange={(e) => setDrafts((d) => ({ ...d, [provider.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") add(provider.id);
                }}
                className="h-8 max-w-sm flex-1"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!authSecretReady || pending || !drafts[provider.id]?.trim()}
                onClick={() => add(provider.id)}
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
              </Button>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
