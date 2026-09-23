// AI access for Edge Functions only. Keys live in Supabase secrets and are never
// sent to the browser.
//
//   AI_PROVIDER = gemini | groq | openrouter | anthropic   (default: anthropic)
//   AI_API_KEY  = the key for that provider
//   AI_MODEL    = optional model override (defaults below)
//
// Gemini, Groq and OpenRouter are called through their OpenAI-compatible
// chat-completions endpoints; Anthropic through its official SDK.
import Anthropic from "npm:@anthropic-ai/sdk@0.128.0";

type Provider = "anthropic" | "gemini" | "groq" | "openrouter";

const PROVIDER_ALIASES: Record<string, Provider> = {
  anthropic: "anthropic",
  claude: "anthropic",
  gemini: "gemini",
  google: "gemini",
  groq: "groq",
  openrouter: "openrouter",
};

const rawProvider = (Deno.env.get("AI_PROVIDER") ?? "anthropic").trim().toLowerCase();
export const AI_PROVIDER: Provider | null = PROVIDER_ALIASES[rawProvider] ?? null;

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-opus-5",
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
};

const OPENAI_COMPAT_URL: Record<Exclude<Provider, "anthropic">, string> = {
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

export const AI_MODEL = Deno.env.get("AI_MODEL") ?? (AI_PROVIDER ? DEFAULT_MODELS[AI_PROVIDER] : "unknown");

export function aiConfigured(): boolean {
  return Boolean(Deno.env.get("AI_API_KEY"));
}

export class AiRefusalError extends Error {}

function apiKey(): string {
  const key = Deno.env.get("AI_API_KEY");
  if (!key) throw new Error("AI_API_KEY is not set in the Edge Function secrets.");
  if (!AI_PROVIDER) {
    throw new Error(`AI_PROVIDER "${rawProvider}" is not supported. Use gemini, groq, openrouter or anthropic.`);
  }
  return key;
}

interface JsonRequest {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

/** One model call that must return a JSON object matching `schema`. */
export async function generateJson<T>(opts: JsonRequest): Promise<T> {
  const key = apiKey();
  return AI_PROVIDER === "anthropic" ? await anthropicJson<T>(key, opts) : await openAiCompatJson<T>(key, opts);
}

// ---------------------------------------------------------------- Anthropic

let anthropic: Anthropic | null = null;

function describeAnthropic(e: unknown): Error {
  if (e instanceof Anthropic.AuthenticationError) return new Error("AI_API_KEY was rejected by Anthropic (401). Check the key, or set AI_PROVIDER if it is for another provider.");
  if (e instanceof Anthropic.PermissionDeniedError) return new Error(`Anthropic denied access (403): ${e.message}`);
  if (e instanceof Anthropic.NotFoundError) return new Error(`Model "${AI_MODEL}" is not available to this API key (404). Set AI_MODEL to a model you can use.`);
  if (e instanceof Anthropic.RateLimitError) return new Error("Anthropic rate limit reached (429). Try again shortly.");
  if (e instanceof Anthropic.APIError) {
    if (/credit balance/i.test(e.message)) {
      return new Error("The Anthropic account behind AI_API_KEY has no credits. Add credits at console.anthropic.com → Plans & Billing, then try again.");
    }
    const inner = e.message.match(/"message":"([^"]+)"/)?.[1];
    return new Error(`Anthropic API error ${e.status ?? ""}: ${inner ?? e.message}`);
  }
  return e instanceof Error ? e : new Error(String(e));
}

async function anthropicJson<T>(key: string, opts: JsonRequest): Promise<T> {
  anthropic ??= new Anthropic({ apiKey: key });
  const params = {
    model: AI_MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    messages: [{ role: "user" as const, content: opts.prompt }],
    output_config: {
      effort: opts.effort ?? "low",
      format: { type: "json_schema" as const, schema: opts.schema },
    },
    // Server-side refusal fallback: a declined request is re-run on Anthropic's
    // recommended fallback model instead of failing.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  };
  // deno-lint-ignore no-explicit-any
  let response: any;
  try {
    // `fallbacks: "default"` is newer than the SDK typings.
    // deno-lint-ignore no-explicit-any
    response = await anthropic.beta.messages.create(params as any);
  } catch (e) {
    // If this account/API version rejects the fallback option, retry without it.
    if (e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) {
      const { betas: _b, fallbacks: _f, ...plain } = params;
      try {
        // deno-lint-ignore no-explicit-any
        response = await anthropic.messages.create(plain as any);
      } catch (e2) {
        throw describeAnthropic(e2);
      }
    } else {
      throw describeAnthropic(e);
    }
  }
  if (response.stop_reason === "refusal") throw new AiRefusalError("The model declined this request.");
  if (response.stop_reason === "max_tokens") throw new Error("Model output was truncated (max_tokens).");
  const text = response.content
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { type: string; text?: string }) => b.text ?? "")
    .join("");
  return JSON.parse(text) as T;
}

// ------------------------------------------------ Gemini / Groq / OpenRouter

const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  groq: "Groq",
  openrouter: "OpenRouter",
};

/** Pull the first JSON object out of a reply (tolerates ```json fences or stray prose). */
function extractJson(text: string): unknown {
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("The model did not return valid JSON.");
  }
}

async function openAiCompatJson<T>(key: string, opts: JsonRequest): Promise<T> {
  const provider = AI_PROVIDER as Exclude<Provider, "anthropic">;
  const label = PROVIDER_LABEL[provider];
  // JSON mode is widely supported; the schema itself goes in the system prompt.
  const system = `${opts.system}

Respond with a single JSON object only — no prose, no markdown fences. It must match this JSON Schema exactly (all required keys present, no extra keys):
${JSON.stringify(opts.schema)}`;

  const body = {
    model: AI_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: opts.prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: opts.maxTokens ?? 8000,
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(OPENAI_COMPAT_URL[provider], {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status === 503) {
      // Free tiers are rate limited; back off briefly and retry.
      if (attempt < 2) {
        const wait = Number(res.headers.get("retry-after")) * 1000 || 2000 * (attempt + 1) ** 2;
        await new Promise((r) => setTimeout(r, Math.min(wait, 20_000)));
        continue;
      }
      throw new Error(`${label} rate limit reached (${res.status}). The free tier allows a limited number of requests per minute — try again shortly.`);
    }
    const raw = await res.text();
    if (!res.ok) {
      let msg = raw.slice(0, 300);
      try {
        const j = JSON.parse(raw);
        msg = (Array.isArray(j) ? j[0] : j)?.error?.message ?? msg;
      } catch {
        /* keep raw */
      }
      if (res.status === 401 || res.status === 403 || /api key not valid|invalid api key/i.test(msg)) {
        throw new Error(`AI_API_KEY was rejected by ${label} (${res.status}). Check that the key is a ${label} key and AI_PROVIDER=${provider}.`);
      }
      if (res.status === 404 || /not found|does not exist|decommissioned/i.test(msg)) {
        throw new Error(`Model "${AI_MODEL}" is not available on ${label}. Set AI_MODEL to a current model. (${msg})`);
      }
      throw new Error(`${label} API error ${res.status}: ${msg}`);
    }
    const data = JSON.parse(raw);
    const choice = data.choices?.[0];
    if (choice?.finish_reason === "length") throw new Error("Model output was truncated (max_tokens).");
    if (choice?.finish_reason === "content_filter" || choice?.finish_reason === "SAFETY") {
      throw new AiRefusalError("The model declined this request.");
    }
    const text: string = choice?.message?.content ?? "";
    if (!text) throw new Error(`${label} returned an empty response.`);
    return extractJson(text) as T;
  }
  throw new Error(`${label} request failed.`);
}
