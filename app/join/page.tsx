import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { JoinForm } from "@/components/rooms/join-form";

export const dynamic = "force-dynamic";

/**
 * The student's door, reached by typing the URL off a projector.
 *
 * Public: no session is required and none is created until a password verifies.
 * `AuthShell` rather than `AppHeader` because a student arriving here has no
 * account and no business being shown a nav bar for one.
 */
export default function JoinPage() {
  return (
    <AuthShell
      title="Join a classroom room"
      description="Enter the code and password your professor read out."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="underline underline-offset-4 hover:text-primary">
            Sign in first
          </Link>{" "}
          so this counts towards your profile.
        </>
      }
    >
      <JoinForm />
    </AuthShell>
  );
}
