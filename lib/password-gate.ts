import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";

/**
 * The half of an admin password reset that makes the temporary password
 * temporary.
 *
 * A reset sets the password to the account's own email address, which is a
 * value anyone holding a class roster can guess. That is a deliberate trade —
 * the admin has to be able to say the new password out loud over email — and
 * this is what pays for it: from the moment the reset lands, the account can
 * reach exactly one page until it chooses a real password.
 *
 * ## Wider than `requireBatch`, on purpose
 *
 * The batch gate exempts `/admin`, `/host` and `/profile` so nobody can be
 * locked out of the surface that fixes their problem. That argument does not
 * apply here, and applying it would defeat the gate: the point is that a
 * guessable password opens *nothing*, and the way out — `/set-password` — is
 * always one redirect away and needs no permission at all. So this one is
 * called from the admin panel and the classroom console too.
 *
 * Guests are exempt for the ordinary reason: they have no password to reset.
 */
export function requirePasswordChange(
  user: Pick<User, "isGuest" | "mustChangePassword">,
): void {
  if (user.isGuest || !user.mustChangePassword) return;
  redirect("/set-password");
}
