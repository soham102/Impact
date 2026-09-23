// Server-side Supabase client. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// injected automatically into hosted Edge Functions; the service-role key
// never leaves this environment.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the Edge Function environment.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type Caller = { kind: "service" } | { kind: "user"; userId: string };

/** Identify who invoked the function: the scheduler (service-role key or
 *  CRON_SECRET) or a signed-in user (their access token). */
export async function getCaller(req: Request, admin: SupabaseClient): Promise<Caller | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") === cronSecret) return { kind: "service" };
  if (token && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return { kind: "service" };
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { kind: "user", userId: data.user.id };
}

/** Invoke another Edge Function in this project with service credentials. */
export async function invokeFunction(name: string, body: unknown): Promise<unknown> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { status: res.status, body: text.slice(0, 500) };
  }
}

/** `select ... where column in (values)` split into URL-safe chunks. */
export async function selectIn<T = Record<string, unknown>>(
  admin: SupabaseClient,
  table: string,
  columns: string,
  column: string,
  values: string[],
  size = 100,
): Promise<{ data: T[]; error: string | null }> {
  const out: T[] = [];
  for (let i = 0; i < values.length; i += size) {
    const { data, error } = await admin.from(table).select(columns).in(column, values.slice(i, i + size));
    if (error) return { data: out, error: error.message };
    out.push(...((data ?? []) as T[]));
  }
  return { data: out, error: null };
}
