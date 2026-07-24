import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user && !user.isGuest) redirect("/dashboard");

  return (
    <AuthShell
      title="Create your account"
      description="Save your progress, streaks and evaluations."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
