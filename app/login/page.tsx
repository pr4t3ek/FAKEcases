import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user && !user.isGuest) redirect("/dashboard");

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to continue your interview prep."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create a free account
          </Link>
        </>
      }
    >
      <AuthForm mode="login" />
    </AuthShell>
  );
}
