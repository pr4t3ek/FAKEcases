import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { normaliseRoomCode } from "@/lib/rooms/code";
import { seatFor } from "@/lib/rooms";
import { AuthShell } from "@/components/auth/auth-shell";
import { JoinForm } from "@/components/rooms/join-form";

export const dynamic = "force-dynamic";

/**
 * The same door with the code already filled in, so a projected link works.
 *
 * Deliberately says nothing about whether the code is real. Rendering "no such
 * room" here would hand out exactly the oracle `joinRoom`'s single refusal
 * message exists to close — the form is shown either way, and the answer comes
 * from the action.
 *
 * The one thing it does check is whether this visitor is ALREADY seated: asking
 * a student for a password they have already given, because they closed the tab
 * and clicked the link again, is a wall in the middle of a class.
 */
export default async function JoinWithCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalised = normaliseRoomCode(code);

  const user = await getSessionUser();
  if (user) {
    const seated = await seatFor(user.id, normalised);
    if (seated) redirect(`/room/${seated.room.code}`);
  }

  return (
    <AuthShell
      title="Join a classroom room"
      description="Check the code, then enter the password your professor read out."
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
      <JoinForm defaultCode={normalised} />
    </AuthShell>
  );
}
