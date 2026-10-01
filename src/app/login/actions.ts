"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { step: "email" | "sent"; email?: string; error?: string };

function isAllowed(email: string) {
  const allowed = (process.env.ALLOWED_EMAIL ?? "").trim().toLowerCase();
  return allowed !== "" && email === allowed;
}

export async function sendLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!isAllowed(email)) {
    return { step: "email", error: "That email isn't allowed on this wardrobe." };
  }
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback`, shouldCreateUser: false },
  });
  if (error) return { step: "email", email, error: error.message };
  return { step: "sent", email };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
