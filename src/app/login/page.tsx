"use client";

import { useActionState } from "react";
import { sendLink, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendLink, { step: "email" });

  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="font-serif text-5xl">Wardrobe</h1>
      <p className="mt-2 text-muted">Your clothes, restyled daily.</p>

      {state.step === "sent" ? (
        <div className="card mt-10 space-y-2 p-5 text-sm">
          <p className="font-medium">Check your email</p>
          <p className="text-muted">
            Tap the sign-in link from {state.email}. Open it in the same browser you&apos;re using now
            (press and hold the link → Open in Safari).
          </p>
        </div>
      ) : (
        <form action={action} className="mt-10 space-y-3">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="input"
            defaultValue={state.email}
          />
          <button className="btn-primary w-full" disabled={pending}>
            {pending ? "Sending…" : "Email me a sign-in link"}
          </button>
          {state.error && <p className="text-sm text-warn">{state.error}</p>}
        </form>
      )}
    </main>
  );
}
