"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createCategory } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  _count: { questions: number };
}

export function CategoryManager({ categories }: { categories: AdminCategory[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim() || !slug.trim()) return;
    setBusy(true);
    try {
      await createCategory({ name, slug });
      toast.success("Category created");
      setName("");
      setSlug("");
      router.refresh();
    } catch {
      toast.error("Failed — slug must be lowercase-with-hyphens and unique.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            placeholder="Name (e.g. Agriculture)"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
            }}
          />
          <Input placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono" />
          <Button onClick={add} disabled={busy}><Plus className="h-4 w-4" /> Add</Button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Badge key={c.id} variant="secondary" className="gap-1.5 py-1">
            {c.name}
            <span className="text-muted-foreground">· {c._count.questions}</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}
