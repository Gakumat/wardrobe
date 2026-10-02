"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FlatLay } from "@/components/flat-lay/FlatLay";
import { Icon } from "@/components/Icon";
import { requestOutfit } from "@/components/outfit/useGenerate";
import { useLocation } from "@/lib/location";
import type { OutfitView } from "@/lib/schema/outfit";
import { useSpeech } from "@/lib/useSpeech";

type Message = { role: "user" | "assistant"; content: string; outfit?: OutfitView | null; error?: boolean };

const KEY = "wardrobe.chat";
const EXAMPLES = [
  "Client meeting at 10, then drinks in Fitzroy, cycling home after dark",
  "Working from home, then a long walk and dinner at a friend's place",
  "Wedding at 3pm in a garden, dancing later",
  "Lazy Sunday: markets, coffee, maybe a movie",
];
const REFINE = ["Warmer", "Less formal", "More colour", "Different shoes"];

function outfitSummary(o: OutfitView) {
  const visible = o.pieces.filter((p) => p.visible).map((p) => p.name);
  return `[Outfit "${o.explanation?.title ?? ""}": ${visible.join(", ")}]`;
}

export function DayChat({ fallback }: { fallback: { lat: number; lon: number; name: string } | null }) {
  const place = useLocation(fallback);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const speech = useSpeech(setText);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(messages));
    } catch {}
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const lastOutfit = [...messages].reverse().find((m) => m.outfit)?.outfit ?? null;

  const send = async (raw: string) => {
    const content = raw.trim();
    if (!content || busy) return;
    if (speech.listening) speech.stop();
    const next: Message[] = [...messages.filter((m) => !m.error), { role: "user", content }];
    setMessages(next);
    setText("");
    setBusy(true);
    try {
      const history = next.map((m) => ({
        role: m.role,
        content: m.role === "assistant" && m.outfit ? `${m.content}\n${outfitSummary(m.outfit)}` : m.content,
      }));
      const res = await requestOutfit({
        source: "chat",
        place,
        chat: { messages: history.slice(-12), baseOutfitId: lastOutfit?.id ?? null },
      });
      setMessages([...next, { role: "assistant", content: res.reply ?? "Here's what I'd wear.", outfit: res.outfit }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col px-5">
      <div className="flex-1 space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Tell me what your day looks like: where you&apos;re going, what you&apos;re doing, how you&apos;re
              getting around. I&apos;ll plan an outfit that works from start to finish.
            </p>
            <div className="space-y-2">
              {EXAMPLES.map((ex) => (
                <button key={ex} onClick={() => send(ex)} className="card block w-full px-4 py-3 text-left text-sm">
                  “{ex}”
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-accent-ink">
              {m.content}
            </p>
          ) : (
            <div key={i} className="max-w-[92%] space-y-3">
              <p
                className={`rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed ${
                  m.error ? "bg-warn/10 text-warn" : "bg-surface-2"
                }`}
              >
                {m.content}
              </p>
              {m.outfit && (
                <Link href={`/outfit/${m.outfit.id}`} className="card block overflow-hidden">
                  <FlatLay pieces={m.outfit.pieces} className="rounded-none" />
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="font-medium">{m.outfit.explanation?.title}</span>
                    <span className="text-sm text-muted">Full styling →</span>
                  </div>
                </Link>
              )}
            </div>
          ),
        )}

        {busy && (
          <p className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-md bg-surface-2 px-4 py-2.5 text-sm text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> Planning your day… (20–40s)
          </p>
        )}
        <div ref={end} />
      </div>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] space-y-2 bg-bg pb-3 pt-2">
        {lastOutfit && !busy && (
          <div className="flex flex-wrap gap-1.5">
            {REFINE.map((r) => (
              <button key={r} className="chip py-1.5" onClick={() => send(r)}>
                {r}
              </button>
            ))}
            <button className="chip py-1.5 text-muted" onClick={() => setMessages([])}>
              Start over
            </button>
          </div>
        )}
        {speech.error && <p className="text-xs text-warn">{speech.error}</p>}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <textarea
            className="input max-h-40 min-h-12 resize-none"
            rows={1}
            placeholder={speech.listening ? "Listening…" : lastOutfit ? "Refine it: “use the green jacket”" : "Describe your day"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
          />
          {speech.supported && (
            <button
              type="button"
              onClick={() => (speech.listening ? speech.stop() : speech.start(text))}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${
                speech.listening ? "animate-pulse border-warn bg-warn text-white" : "border-line bg-surface text-ink"
              }`}
              aria-label={speech.listening ? "Stop listening" : "Speak"}
            >
              <Icon name="mic" />
            </button>
          )}
          <button
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink disabled:opacity-40"
            disabled={busy || !text.trim()}
            aria-label="Send"
          >
            <Icon name="send" />
          </button>
        </form>
      </div>
    </div>
  );
}
