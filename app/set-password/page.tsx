import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export const dynamic = "force-dynamic";

/**
 * Where `requirePasswordChange` sends someone after an admin reset.
 *
 * Deliberately not gated by `requirePasswordChange` itself — this is the way
 * out, and a gate here would be a redirect loop. Anyone who arrives without the
 * flag set is simply sent on: the page has nothing to ask them.
 */
export default async function SetPasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.isGuest) redirect("/signup");
  if (!user.mustChangePassword) redirect("/dashboard");

  return (
    <AuthShell
      title="Choose a new password"
      description="Your password was reset by the admin. Pick your own before you carry on."
    >
      <SetPasswordForm />
    </AuthShell>
  );
}
