"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { step: "email" | "code"; email?: string; error?: string; info?: string };

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
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { step: "email", email, error: error.message };
  return {
    step: "code",
    email,
    info: "Check your email. Tap the link, or type the 6-digit code here (use the code if you're in the home-screen app).",
  };
}

export async function verifyCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const token = String(form.get("token") ?? "").replace(/\s/g, "");
  if (!isAllowed(email)) return { step: "email", error: "That email isn't allowed." };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { step: "code", email, error: error.message };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
