import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { initialsFor } from "@/lib/avatar";
import { parseTargetLevels } from "@/lib/profile-schema";
import { COLLEGE_OTHER } from "@/lib/config/colleges";
import type { InterviewLevel } from "@/lib/types";
import { AppHeader } from "@/components/app/app-header";
import { ProfileForm } from "@/components/profile/profile-form";
import { PasswordForm } from "@/components/profile/password-form";
import { PlanCard } from "@/components/profile/plan-card";
import { DeleteAccountCard } from "@/components/profile/delete-account-card";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getSessionUser();
  // The dashboard's exact two-step: no session is a sign-in problem, a guest is
  // a sign-up one, and they are different answers.
  if (!user) redirect("/login");
  if (user.isGuest) redirect("/signup");

  const profile = await db.profile.findUnique({ where: { userId: user.id } });

  // `collegeId` is null both when nothing was chosen and when "Other" was, so
  // the written-in name is what tells the two apart on the way back into the
  // form. Storing it that way is what keeps "has a real college" a single null
  // check everywhere else.
  const collegeId = user.collegeId ?? (profile?.collegeOther ? COLLEGE_OTHER : "");

  return (
    <div className="min-h-screen">
      <AppHeader user={user} />
      <main className="container py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Your profile</h1>
          <p className="mt-1 text-muted-foreground">
            Everything here is optional except your name, and only your goals change what the
            app does.
          </p>
        </div>

        <div className="max-w-3xl space-y-6">
          <PlanCard proUntil={user.proUntil} />
          <ProfileForm
            email={user.email}
            avatarUrl={user.image}
            initials={initialsFor(user.name, user.email)}
            initial={{
              name: user.name ?? "",
              phone: profile?.phone ?? "",
              city: profile?.city ?? "",
              bio: profile?.bio ?? "",
              profession: profile?.profession ?? "",
              collegeId,
              collegeOther: profile?.collegeOther ?? "",
              gradYear: profile?.gradYear ? String(profile.gradYear) : "",
              experience: profile?.experience ?? "",
              targetLevels: parseTargetLevels(profile?.targetLevels) as InterviewLevel[],
              targetCompanies: profile?.targetCompanies ?? "",
            }}
          />
          <PasswordForm />
          {/* The confirmation is typing the address, so an account without one
              has no way to complete it. Every signed-up account has an email —
              `signup` requires it — so this guard is the type talking, not a
              case a person can reach. */}
          {user.email && <DeleteAccountCard email={user.email} />}
        </div>
      </main>
    </div>
  );
}
