import { Mail } from "lucide-react";
import { INSTITUTION_NAME } from "@/lib/config";

/**
 * What to do when you have forgotten your password: write to the admin.
 *
 * Not a form, which is why it is no longer named like one. The previous version
 * took an email address and did nothing with it — no provider is configured, and
 * a disabled input under a warning is still an input someone will try. A reset
 * here is a person doing it by hand from the admin panel, so the page's whole
 * job is to say who to ask and what they will need.
 *
 * **The official college address is the check.** Nothing here verifies anything;
 * the admin does, by seeing which mailbox the request arrived from. Saying so is
 * what makes the request usable rather than one more mail to reply to asking who
 * the sender is.
 *
 * The address itself is a setting, not a constant — see `TEXT_SETTING_DEFAULTS`
 * in lib/settings.ts. It is a real person's mailbox and will change hands.
 */
export function ContactAdminPanel({ adminEmail }: { adminEmail: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="font-medium">A reset is done by the admin, by hand.</p>
          <p className="mt-1 text-muted-foreground">
            Email{" "}
            <a
              href={`mailto:${adminEmail}?subject=EstimateIQ%20password%20reset`}
              className="break-all font-medium text-primary hover:underline"
            >
              {adminEmail}
            </a>{" "}
            <strong className="text-foreground">from your official {INSTITUTION_NAME} email
            address</strong> — that address is how the admin knows the request is yours. A request
            sent from anywhere else can&apos;t be acted on.
          </p>
        </div>
      </div>

      <ol className="space-y-2 rounded-lg border p-3 text-sm text-muted-foreground">
        <li className="flex gap-2.5">
          <span className="font-semibold text-foreground">1.</span>
          <span>You write in, from your college address.</span>
        </li>
        <li className="flex gap-2.5">
          <span className="font-semibold text-foreground">2.</span>
          <span>
            The admin resets your password to{" "}
            <strong className="text-foreground">your own email address</strong>. That is the
            password you sign in with.
          </span>
        </li>
        <li className="flex gap-2.5">
          <span className="font-semibold text-foreground">3.</span>
          <span>
            The app asks you to choose a new password before it lets you do anything else — so
            the temporary one stops working immediately.
          </span>
        </li>
      </ol>
    </div>
  );
}
