import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";

/**
 * The half of "batch is mandatory" that a form cannot enforce.
 *
 * `profileCoreSchema` refuses a save without a batch, but every account created
 * before the field existed already has none, and no amount of validation reaches
 * them — they simply never submit the form again. So the student surfaces ask
 * on the way in: no batch, no app, until one is picked.
 *
 * ## Who is exempt, and why each exemption is load-bearing
 *
 * **Guests.** A class joins a classroom room as guests by design (`joinRoom`
 * mints the row after the password verifies), so gating them would break
 * `/join` and `/room/[code]` outright — the exact flow a professor runs a
 * lecture on. A guest has no board row to label either: `rankableUser` filters
 * them out of every standing, so there is nothing here worth collecting yet.
 * They are asked at signup instead, which is when the row becomes rankable.
 *
 * **The surfaces this is NOT called from.** `/admin`, `/host`, `/profile` and
 * `/welcome` stay reachable with no batch, and that is deliberate rather than an
 * oversight to tidy up later. An admin who cannot open the admin panel cannot
 * fix whatever locked them out; a professor meeting a form mid-class is a worse
 * failure than a missing label on a board; and gating `/welcome` — where the
 * answer is given — would be a redirect loop.
 *
 * Redirects to `/welcome`, which renders the step whenever the batch is missing,
 * regardless of `profileCompletedAt`. That flag means "has been asked", and this
 * question outlives it.
 */
export function requireBatch(user: Pick<User, "isGuest" | "batch">): void {
  if (user.isGuest || user.batch) return;
  redirect("/welcome");
}
