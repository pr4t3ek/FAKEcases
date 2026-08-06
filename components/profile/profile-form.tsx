"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateProfile } from "@/app/actions/user";
import { profileLimits } from "@/lib/config";
import type { InterviewLevel } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import {
  CollegeSelect,
  ExperienceSelect,
  Field,
  GradYearSelect,
  ProfessionSelect,
  TargetLevels,
} from "@/components/profile/fields";

export interface ProfileFormValues {
  name: string;
  phone: string;
  city: string;
  bio: string;
  profession: string;
  collegeId: string;
  collegeOther: string;
  gradYear: string;
  experience: string;
  targetLevels: InterviewLevel[];
  targetCompanies: string;
}

/**
 * The whole profile, saved in one go.
 *
 * `useState` + `useTransition` + toast + `router.refresh()` — the idiom used
 * everywhere outside the auth pages. `useActionState` is the auth one, and it
 * doesn't fit: nothing here redirects, and the page has to stay put so the
 * header can pick up a changed name on refresh.
 *
 * The avatar is deliberately outside the form. It saves on pick, because a
 * photo you chose and then lost to an unsaved form is worse than one extra
 * round trip.
 */
export function ProfileForm({
  initial,
  email,
  avatarUrl,
  initials,
}: {
  initial: ProfileFormValues;
  email: string | null;
  avatarUrl: string | null;
  initials: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const result = await updateProfile(form);
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't save your profile.");
        return;
      }
      toast.success("Profile saved");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-5 p-5">
        <div>
          <h2 className="font-semibold">You</h2>
          <p className="text-sm text-muted-foreground">
            How you appear across the app.
          </p>
        </div>

        <AvatarPicker src={avatarUrl} initials={initials} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name" htmlFor="name">
            <Input
              id="name"
              value={form.name}
              maxLength={profileLimits.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="Email" htmlFor="email" hint="Sign-in address — not editable here.">
            <Input id="email" value={email ?? ""} readOnly disabled />
          </Field>
          <Field label="Phone" htmlFor="phone" hint="Optional. Nothing sends to it.">
            <Input
              id="phone"
              inputMode="tel"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
          <Field label="City" htmlFor="city">
            <Input
              id="city"
              placeholder="Bengaluru"
              value={form.city}
              maxLength={profileLimits.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </Field>
        </div>

        <Field label="About you" htmlFor="bio" hint={`${form.bio.length}/${profileLimits.bio}`}>
          <Textarea
            id="bio"
            rows={3}
            placeholder="A line or two — where you are in your prep, what you're aiming at."
            value={form.bio}
            maxLength={profileLimits.bio}
            onChange={(e) => set("bio", e.target.value)}
          />
        </Field>
      </Card>

      <Card className="space-y-5 p-5">
        <div>
          <h2 className="font-semibold">Background</h2>
          <p className="text-sm text-muted-foreground">
            Where you&apos;re coming from. All of it optional.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ProfessionSelect value={form.profession} onChange={(v) => set("profession", v)} />
          <ExperienceSelect value={form.experience} onChange={(v) => set("experience", v)} />
        </div>

        <div className="grid items-start gap-4 sm:grid-cols-2">
          <CollegeSelect
            collegeId={form.collegeId}
            collegeOther={form.collegeOther}
            onCollegeId={(v) => set("collegeId", v)}
            onCollegeOther={(v) => set("collegeOther", v)}
          />
          <GradYearSelect value={form.gradYear} onChange={(v) => set("gradYear", v)} />
        </div>
      </Card>

      <Card className="space-y-5 p-5">
        <div>
          <h2 className="font-semibold">Goals</h2>
          <p className="text-sm text-muted-foreground">
            The one section that changes what the app does, rather than what it shows.
          </p>
        </div>

        <TargetLevels value={form.targetLevels} onChange={(v) => set("targetLevels", v)} />

        <Field
          label="Target companies"
          htmlFor="targetCompanies"
          hint="Free text — nothing filters on this yet."
        >
          <Input
            id="targetCompanies"
            placeholder="McKinsey, Flipkart, Zomato"
            value={form.targetCompanies}
            maxLength={profileLimits.targetCompanies}
            onChange={(e) => set("targetCompanies", e.target.value)}
          />
        </Field>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
