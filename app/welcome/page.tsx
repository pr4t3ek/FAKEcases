import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/app/app-header";
import { WelcomeSteps } from "@/components/onboarding/welcome-steps";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.isGuest) redirect("/signup");
  // Answered, or deliberately skipped — either way they've been asked, and
  // replaying the URL shouldn't ask again.
  //
  // Unless the batch is still missing. `profileCompletedAt` means "has been
  // asked", and it was set on every account that went through this step before
  // the batch existed — so honouring it first would bounce exactly the people
  // `requireBatch` sends here, in a loop between this page and the dashboard.
  // The batch outlives the flag, so it is checked ahead of it.
  if (user.batch && user.profileCompletedAt) redirect("/dashboard");

  return (
    <div className="min-h-screen">
      <AppHeader user={user} />
      <main className="container max-w-xl py-10">
        <WelcomeSteps
          initialName={user.name?.split(" ")[0] || "there"}
          initialBatch={user.batch ?? ""}
        />
      </main>
    </div>
  );
}
