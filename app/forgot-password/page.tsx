import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ContactAdminPanel } from "@/components/auth/contact-admin-panel";
import { loadTextSettings } from "@/lib/settings";

// The address is an admin-editable setting, so this page must not be cached
// with last term's admin on it.
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const { adminContactEmail } = await loadTextSettings();

  return (
    <AuthShell
      title="Forgotten your password?"
      description="Password resets go through the admin — here's how to ask for one."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <ContactAdminPanel adminEmail={adminContactEmail} />
    </AuthShell>
  );
}
