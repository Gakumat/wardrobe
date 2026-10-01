import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Handles both the token_hash link (works across browsers/devices) and the PKCE ?code= flow.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const supabase = await createClient();

  let ok = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (ok) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const allowed = (process.env.ALLOWED_EMAIL ?? "").trim().toLowerCase();
    if (user?.email?.toLowerCase() === allowed) {
      return NextResponse.redirect(`${origin}/`);
    }
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(`${origin}/login`);
}
