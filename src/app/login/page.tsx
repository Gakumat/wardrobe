"use client";

import { useActionState } from "react";
import { sendLink, verifyCode, type LoginState } from "./actions";

export default function LoginPage() {
  const [linkState, linkAction, linkPending] = useActionState<LoginState, FormData>(sendLink, {
    step: "email",
  });
  const [codeState, codeAction, codePending] = useActionState<LoginState, FormData>(verifyCode, {
    step: "code",
  });

  const onCodeStep = linkState.step === "code";

  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="font-serif text-5xl">Wardrobe</h1>
      <p className="mt-2 text-muted">Your clothes, restyled daily.</p>

      {!onCodeStep ? (
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
        <form action={codeAction} className="mt-10 space-y-3">
          <p className="text-sm text-muted">{linkState.info}</p>
          <input type="hidden" name="email" value={linkState.email} />
          <input
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="input text-center text-2xl tracking-[0.4em]"
            required
          />
          <button className="btn-primary w-full" disabled={codePending}>
            {codePending ? "Checking…" : "Sign in"}
          </button>
          {codeState.error && <p className="text-sm text-warn">{codeState.error}</p>}
        </form>
      )}
    </main>
  );
}
