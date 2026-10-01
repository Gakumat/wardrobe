import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { resolveModel } from "./config";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: Anthropic | null = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ClaudeError(
      "The Anthropic API key isn't set yet. Add ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables.",
    );
  }
  client ??= new Anthropic();
  return client;
}

export class ClaudeError extends Error {}

/** The model to use for this user: their Settings choice if allowed, else the default. */
export async function modelFor(supabase: SupabaseClient) {
  const { data } = await supabase.from("preferences").select("model").maybeSingle();
  return resolveModel(data?.model);
}

type ParseArgs<S extends z.ZodType> = {
  model: string;
  system: string;
  content: Anthropic.ContentBlockParam[] | string;
  schema: S;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
  /** Earlier turns, for multi-turn refinement (chat). */
  history?: Anthropic.MessageParam[];
};

/** One structured-output call. Returns data validated against `schema`, or throws ClaudeError. */
export async function parseJSON<S extends z.ZodType>({
  model,
  system,
  content,
  schema,
  maxTokens = 8000,
  effort = "medium",
  history = [],
}: ParseArgs<S>): Promise<z.infer<S>> {
  const anthropic = getClient();
  try {
    const response = await anthropic.messages.parse({
      model,
      max_tokens: maxTokens,
      system,
      output_config: {
        effort,
        format: zodOutputFormat(schema),
      },
      messages: [...history, { role: "user", content }],
    });
    if (response.stop_reason === "refusal") {
      throw new ClaudeError("Claude declined this request. Try rephrasing or a different photo.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new ClaudeError("Claude's answer was cut off. Please try again.");
    }
    if (!response.parsed_output) {
      throw new ClaudeError("Claude returned something unexpected. Please try again.");
    }
    return response.parsed_output as z.infer<S>;
  } catch (err) {
    if (err instanceof ClaudeError) throw err;
    if (err instanceof Anthropic.AuthenticationError) {
      throw new ClaudeError("The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in Vercel.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new ClaudeError("Too many requests at once. Wait a moment and retry.");
    }
    if (err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message)) {
      throw new ClaudeError("Your Anthropic account is out of credit. Top up at console.anthropic.com.");
    }
    if (err instanceof Anthropic.APIError) {
      throw new ClaudeError(`Claude API error (${err.status ?? "network"}). Please retry.`);
    }
    throw err;
  }
}
