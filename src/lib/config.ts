// Single place to change the Claude model. Settings can override per user,
// but only to a model in MODEL_ALLOWLIST.
export const DEFAULT_MODEL = "claude-sonnet-5-5";

export const MODEL_ALLOWLIST = [
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5 (balanced)" },
  { id: "claude-opus-5-5", label: "Opus 5.5 (best, pricier)" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5 (fastest, cheapest)" },
] as const;

export type ModelId = (typeof MODEL_ALLOWLIST)[number]["id"];

export function resolveModel(preferred?: string | null): ModelId {
  const hit = MODEL_ALLOWLIST.find((m) => m.id === preferred);
  return hit ? hit.id : DEFAULT_MODEL;
}

export const FALLBACK_LOCATION = {
  name: "Melbourne",
  lat: -37.8136,
  lon: 144.9631,
};

export const STORAGE_BUCKET = "items";
export const SIGNED_URL_TTL = 60 * 60; // seconds
