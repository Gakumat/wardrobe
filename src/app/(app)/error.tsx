"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4 px-5 pt-16 text-center">
      <h1 className="font-serif text-3xl">Something went wrong</h1>
      <p className="text-sm text-muted">{error.message || "Please try again."}</p>
      <button className="btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
