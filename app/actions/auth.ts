"use server";

import { redirect } from "next/navigation";
import { login, signup, clearSession } from "@/lib/auth";

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const result = await login(email, password);
  if (!result.ok) return { error: result.error };
  redirect("/dashboard");
}

export async function signupAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "");
  const result = await signup(email, password, name);
  if (!result.ok) return { error: result.error };
  // Straight to the questions rather than the dashboard. They are skippable in
  // one click, so this costs someone in a hurry nothing, and asking later —
  // once the dashboard is already open — is asking never.
  redirect("/welcome");
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/");
}
