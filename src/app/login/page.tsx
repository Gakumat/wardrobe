"use client";

import { useActionState, useEffect, useState } from "react";
import { sendLink, signInWithPassword, type LoginState } from "./actions";

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export default function LoginPage() {
  const [mode, setMode] = useState<"link" | "password">("link");
  const [linkState, linkAction, linkPending] = useActionState<LoginState, FormData>(sendLink, { step: "email" });
  const [pwState, pwAction, pwPending] = useActionState<LoginState, FormData>(signInWithPassword, { step: "email" });

  // Inside the home-screen app, email links would open Safari instead, so default to password.
  useEffect(() => {
    if (isStandalone()) setMode("password");
  }, []);

  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="font-serif text-5xl">Wardrobe</h1>
      <p className="mt-2 text-muted">Your clothes, restyled daily.</p>

      {mode === "link" && linkState.step === "sent" ? (
        <div className="card mt-10 space-y-2 p-5 text-sm">
          <p className="font-medium">Check your email</p>
          <p className="text-muted">
            Tap the sign-in link sent to {linkState.email}. Open it in the same browser you&apos;re using now
            (press and hold the link, then choose Open in Safari).
          </p>
        </div>
      ) : mode === "link" ? (
        <form action={linkAction} className="mt-10 space-y-3">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="input"
            defaultValue={linkState.email}
          />
          <button className="btn-primary w-full" disabled={linkPending}>
            {linkPending ? "Sending…" : "Email me a sign-in link"}
          </button>
          {linkState.error && <p className="text-sm text-warn">{linkState.error}</p>}
        </form>
      ) : (
        <form action={pwAction} className="mt-10 space-y-3">
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            placeholder="you@example.com"
            className="input"
            defaultValue={pwState.email}
          />
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Password"
            className="input"
          />
          <button className="btn-primary w-full" disabled={pwPending}>
            {pwPending ? "Signing in…" : "Sign in"}
          </button>
          {pwState.error && <p className="text-sm text-warn">{pwState.error}</p>}
        </form>
      )}

      <button
        className="mt-6 text-sm text-muted underline"
        onClick={() => setMode((m) => (m === "link" ? "password" : "link"))}
      >
        {mode === "link" ? "Sign in with a password instead" : "Email me a link instead"}
      </button>
    </main>
  );
}
