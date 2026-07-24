import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { importQuestions } from "@/lib/questions";
import { parseCsv } from "@/lib/csv";

const schema = z.object({
  text: z.string().min(1),
  format: z.enum(["csv", "json"]),
  dryRun: z.boolean().default(true),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { text, format, dryRun } = parsed.data;

  let rows: unknown[];
  try {
    if (format === "json") {
      const data = JSON.parse(text);
      rows = Array.isArray(data) ? data : [data];
    } else {
      rows = parseCsv(text);
    }
  } catch {
    return NextResponse.json({ error: "Could not parse the file. Check the format." }, { status: 400 });
  }

  const result = await importQuestions(rows, { dryRun });
  if (!dryRun) {
    revalidatePath("/admin");
    revalidatePath("/library");
  }
  return NextResponse.json(result);
}
